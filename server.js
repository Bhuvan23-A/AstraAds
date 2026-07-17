import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAdCampaign } from './aiService.js';
import { getDatabase, initializeDatabase } from './database.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Auto-subscribe Meta pages to Webhook App
async function subscribeAllPages() {
  try {
    const db = await getDatabase();
    const rows = await db.all('SELECT * FROM page_configs');
    console.log(`[Meta Subscriptions] Running auto-subscription check for ${rows.length} pages...`);
    for (const row of rows) {
      const subscribeUrl = `https://graph.facebook.com/v19.0/${row.page_id}/subscribed_apps`;
      const subscribeResponse = await fetch(subscribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscribed_fields: 'leadgen',
          access_token: row.access_token
        })
      });
      const result = await subscribeResponse.json();
      if (result.success || result.success === true) {
        console.log(`[Meta Subscriptions] Successfully subscribed Page ID ${row.page_id} (${row.client_name}) to AstraAds App.`);
      } else {
        console.warn(`[Meta Subscriptions] Page subscription response for ${row.page_id}:`, result);
      }
    }
  } catch (error) {
    console.error('[Meta Subscriptions] Auto-subscription error:', error.message);
  }
}

// Initialize database on start
initializeDatabase().then(async () => {
  console.log('SQLite Database ready.');
  await subscribeAllPages();
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// Resolve directories for serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Route: POST /api/campaigns/generate
 * Pipes onboarding details (and target platforms) to aiService.js and returns structured JSON campaign output.
 */
app.post('/api/campaigns/generate', async (req, res) => {
  try {
    const { businessName, products, targetAudience, monthlyBudget, primaryGoal, platforms } = req.body;
    
    // Simple validation of required parameters
    if (!businessName || !products || !targetAudience || !monthlyBudget || !primaryGoal) {
      return res.status(400).json({ 
        error: 'Missing required onboarding parameters. All fields (businessName, products, targetAudience, monthlyBudget, primaryGoal) are required.' 
      });
    }

    const campaignData = await generateAdCampaign({
      businessName,
      products,
      targetAudience,
      monthlyBudget,
      primaryGoal,
      platforms: platforms || ['Google Search']
    });

    res.json(campaignData);
  } catch (error) {
    console.error('Error generating campaign:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate ad campaign. Please verify your API key and try again.',
      details: error.message 
    });
  }
});

/*
/*
 * Route: POST /api/campaigns/launch
 * Mock route acting as user approval/deployment receipt.
 * Evaluates active connected ad account IDs linked from the connection manager.
 *
app.post('/api/campaigns/launch', async (req, res) => {
  try {
    const { campaign_name, budget_allocation, targeting, ad_creative, linked_accounts, primaryGoal } = req.body;
    
    if (!campaign_name) {
      return res.status(400).json({ 
        error: 'Invalid campaign payload. Launch requires a complete campaign dataset.' 
      });
    }

    const dailyBudget = budget_allocation?.daily_budget;
    const strategy = budget_allocation?.strategy || 'Multi-platform standard';

    // Parse connected account channels
    const activeDestinations = [];
    const logs = [];
    let metaCampaignId = null;

    // --- Live Meta Ads Graph API Call ---
    const metaAccessToken = process.env.META_ACCESS_TOKEN;
    const metaAdAccountIdRaw = process.env.META_AD_ACCOUNT_ID;

    let metaAdAccountId = metaAdAccountIdRaw;
    if (metaAdAccountId && !metaAdAccountId.startsWith('act_')) {
      metaAdAccountId = `act_${metaAdAccountId}`;
    }

    if (metaAccessToken && metaAdAccountId) {
      try {
        console.log(`[META Graph API] Attempting to create live campaign: "${campaign_name}" on account ${metaAdAccountId}...`);
        
        let objective = 'OUTCOME_TRAFFIC';
        const goalLower = (primaryGoal || strategy || '').toLowerCase();
        if (goalLower.includes('lead')) {
          objective = 'OUTCOME_LEADS';
        } else if (goalLower.includes('awareness') || goalLower.includes('reach')) {
          objective = 'OUTCOME_AWARENESS';
        } else if (goalLower.includes('sales') || goalLower.includes('purchase')) {
          objective = 'OUTCOME_SALES';
        }

        const metaResponse = await fetch(`https://graph.facebook.com/v19.0/${metaAdAccountId}/campaigns`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metaAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: campaign_name,
            objective: objective,
            status: 'PAUSED', // Stages the campaign in draft/paused state so it doesn't incur instant cost
            special_ad_categories: '["NONE"]'
          })
        });

        const metaResult = await metaResponse.json();

        if (metaResult.error) {
          throw new Error(`Meta API Error: ${metaResult.error.message} (Code: ${metaResult.error.code})`);
        }

        metaCampaignId = metaResult.id;
        console.log(`[META Graph API] Live campaign created successfully! ID: ${metaCampaignId}`);
        activeDestinations.push(`Meta Social Ads (Live Campaign ID: ${metaCampaignId})`);
        logs.push(`- Meta Ads Business Manager: Created live Campaign "${campaign_name}" (ID: ${metaCampaignId})`);

      } catch (metaErr) {
        console.error('[META Graph API] Live campaign creation failed:', metaErr.message);
        activeDestinations.push(`Meta Social Ads (Simulated Sandbox ID: act_meta_${Math.floor(100000 + Math.random() * 900000)})`);
        logs.push(`- Meta Ads Business Manager: Created mock Campaign (Meta API Error: ${metaErr.message})`);
      }
    } else {
      if (linked_accounts?.meta) {
        activeDestinations.push(`Meta Social Ads (Mock Account: ${linked_accounts.meta})`);
        logs.push(`- Meta Ads Business Manager: Staged mock Campaign for ID ${linked_accounts.meta} (Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in .env for live creation)`);
      }
    }

    if (linked_accounts?.google) {
      activeDestinations.push(`Google Ads (Account: ${linked_accounts.google})`);
      logs.push(`- Google Ads Sandbox: Staged on campaign manager for ID ${linked_accounts.google}`);
    }
    if (linked_accounts?.linkedin) {
      activeDestinations.push(`LinkedIn Ads (Account: ${linked_accounts.linkedin})`);
      logs.push(`- LinkedIn Campaign Manager: Staged sponsored content draft for Account ID ${linked_accounts.linkedin}`);
    }

    if (activeDestinations.length === 0) {
      activeDestinations.push('Sandbox Testing (Local Mock Launch)');
      logs.push('- Staged locally on mock sandbox - no connected accounts supplied.');
    }

    // Print Receipt Console Log
    console.log('--------------------------------------------------');
    console.log(`[LIVE ACTION DEPLOYMENT] Staging Campaign: "${campaign_name}"`);
    console.log(`[LIVE ACTION DEPLOYMENT] Daily Budget: $${dailyBudget}`);
    console.log(`[LIVE ACTION DEPLOYMENT] Strategy: ${strategy}`);
    console.log(`[LIVE ACTION DEPLOYMENT] Staged Destinations:`);
    logs.forEach(log => console.log(`  ${log}`));
    console.log(`[LIVE ACTION DEPLOYMENT] Headlines: ${ad_creative?.headlines?.join(' | ')}`);
    console.log(`[LIVE ACTION DEPLOYMENT] Caption: ${ad_creative?.primary_text}`);
    console.log(`[LIVE ACTION DEPLOYMENT] Status: STAGED & AUTOMATICALLY LAUNCHED ON CONNECTED CHANNELS`);
    console.log('--------------------------------------------------');

    res.json({
      success: true,
      status: 'Active & Live',
      receipt: {
        campaign_id: metaCampaignId || `ad_${Math.random().toString(36).substring(2, 9)}`,
        campaign_name: campaign_name,
        timestamp: new Date().toISOString(),
        network_destinations: activeDestinations,
        environment: metaCampaignId ? 'live-meta-staged' : 'production-staged',
        budget_summary: budget_allocation,
        targeting_summary: targeting,
        creative_summary: ad_creative
      }
    });
  } catch (error) {
    console.error('Error launching campaign:', error.message);
    res.status(500).json({ 
      error: 'Failed to deploy campaign.',
      details: error.message 
    });
  }
});
*/

/**
 * Route: POST /api/campaigns/launch
 * Full Meta Ads publishing pipeline:
 * Campaign -> Ad Set -> Ad Image -> Ad Creative -> Ad Object
 */
app.post('/api/campaigns/launch', async (req, res) => {
  const deploymentLog = [];
  const metaEntities = {
    campaign_id: null,
    ad_set_id: null,
    image_hash: null,
    creative_id: null,
    ad_id: null,
    page_id: null
  };
  const googleEntities = {
    access_token: null,
    customer_id: null,
    campaign_budget_resource_name: null,
    campaign_resource_name: null,
    ad_group_resource_name: null,
    ad_group_ad_resource_name: null,
    keyword_resource_names: []
  };

  const logStep = (step, status, message, details = null) => {
    deploymentLog.push({
      timestamp: new Date().toISOString(),
      step,
      status,
      message,
      details
    });
  };

  const buildReceipt = (payload = {}) => ({
    campaign_id: metaEntities.campaign_id || `ad_${Math.random().toString(36).substring(2, 9)}`,
    campaign_name: payload.campaign_name,
    timestamp: new Date().toISOString(),
    network_destinations: payload.network_destinations || [],
    environment: metaEntities.campaign_id ? 'live-meta-staged' : 'meta-pipeline-failed',
    budget_summary: payload.budget_allocation,
    targeting_summary: payload.targeting,
    creative_summary: payload.ad_creative,
    meta_entities: metaEntities,
    google_entities: googleEntities
  });

  const mapObjective = (goalText) => {
    const normalized = (goalText || '').toLowerCase();
    if (normalized.includes('lead')) return 'OUTCOME_LEADS';
    if (normalized.includes('awareness') || normalized.includes('reach')) return 'OUTCOME_AWARENESS';
    if (normalized.includes('sales') || normalized.includes('purchase')) return 'OUTCOME_SALES';
    return 'OUTCOME_TRAFFIC';
  };

  const mapOptimizationGoal = (goalText) => {
    const normalized = (goalText || '').toLowerCase();
    return normalized.includes('lead') ? 'LEADS' : 'LINK_CLICKS';
  };

  const mapCallToActionType = (ctaText) => {
    const normalized = (ctaText || '').toLowerCase();
    if (normalized.includes('shop')) return 'SHOP_NOW';
    if (normalized.includes('book')) return 'BOOK_NOW';
    if (normalized.includes('sign')) return 'SIGN_UP';
    if (normalized.includes('call')) return 'CALL_NOW';
    if (normalized.includes('apply')) return 'APPLY_NOW';
    if (normalized.includes('quote')) return 'GET_QUOTE';
    return 'LEARN_MORE';
  };

  const sanitizeFileName = (name) => {
    const cleaned = String(name || 'ad-creative')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return cleaned || 'ad-creative';
  };

  const normalizeAdAccountId = (raw) => {
    if (!raw) return null;
    return raw.startsWith('act_') ? raw : `act_${raw}`;
  };

  const parseMetaError = (metaError) => {
    if (!metaError) return 'Unknown Meta API error';
    const parts = [metaError.message];
    if (metaError.code) parts.push(`Code: ${metaError.code}`);
    if (metaError.error_subcode) parts.push(`Subcode: ${metaError.error_subcode}`);
    if (metaError.fbtrace_id) parts.push(`Trace: ${metaError.fbtrace_id}`);
    return parts.filter(Boolean).join(' | ');
  };

  const parseGoogleError = (googleError) => {
    if (!googleError) return 'Unknown Google Ads API error';
    const parts = [];
    if (googleError.message) parts.push(googleError.message);
    if (googleError.error?.message) parts.push(googleError.error.message);
    if (googleError.error?.status) parts.push(`Status: ${googleError.error.status}`);
    if (googleError.error?.code) parts.push(`Code: ${googleError.error.code}`);
    return parts.filter(Boolean).join(' | ');
  };

  const resolveImageHash = (imageResult) => {
    if (imageResult?.hash) return imageResult.hash;
    if (imageResult?.images && typeof imageResult.images === 'object') {
      const imageEntries = Object.values(imageResult.images);
      if (imageEntries.length > 0 && imageEntries[0]?.hash) {
        return imageEntries[0].hash;
      }
    }
    return null;
  };

  try {
    const {
      campaign_name,
      budget_allocation,
      targeting,
      ad_creative,
      linked_accounts,
      primaryGoal,
      client_name,
      page_id
    } = req.body;

    if (!campaign_name) {
      return res.status(400).json({
        error: 'Invalid campaign payload. Launch requires a complete campaign dataset.'
      });
    }

    const dailyBudget = Number(budget_allocation?.daily_budget);
    if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
      return res.status(400).json({
        error: 'Invalid campaign payload. budget_allocation.daily_budget must be a positive number.'
      });
    }

    const activeDestinations = [];
    const shouldLaunchMeta = Boolean(linked_accounts?.meta);
    const shouldLaunchGoogle = Boolean(linked_accounts?.google);

    if (!shouldLaunchMeta && !shouldLaunchGoogle && !linked_accounts?.linkedin) {
      return res.status(400).json({
        success: false,
        status: 'Launch Failed',
        error: 'No linked destination selected. Connect at least one ad channel before launch.',
        deployment_log: deploymentLog,
        receipt: buildReceipt(req.body)
      });
    }

    const destinationLink = ad_creative?.destination_url || process.env.DEFAULT_LANDING_PAGE_URL || 'https://example.com';
    const optimizationGoal = mapOptimizationGoal(primaryGoal);
    const objective = mapObjective(primaryGoal || budget_allocation?.strategy);

    const ensureGoogleKeywords = (keywordsInput) => {
      const normalized = Array.isArray(keywordsInput)
        ? keywordsInput.map(k => String(k).trim()).filter(Boolean)
        : [];
      const fallbackPool = [
        campaign_name,
        `${campaign_name} services`,
        `${campaign_name} near me`,
        'best services',
        'get a free quote',
        'trusted provider'
      ];
      const merged = [...normalized];
      for (const fallbackKeyword of fallbackPool) {
        if (merged.length >= 5) break;
        merged.push(fallbackKeyword);
      }
      return Array.from(new Set(merged)).slice(0, 15);
    };

    const getPageIdForCreative = async () => {
      if (page_id) return String(page_id);
      if (process.env.META_PAGE_ID?.trim()) return process.env.META_PAGE_ID.trim();

      const db = await getDatabase();
      if (client_name) {
        const byClient = await db.get(
          'SELECT page_id FROM page_configs WHERE lower(client_name) = lower(?) LIMIT 1',
          [client_name]
        );
        if (byClient?.page_id) return byClient.page_id;
      }

      const fallback = await db.get('SELECT page_id FROM page_configs ORDER BY rowid ASC LIMIT 1');
      return fallback?.page_id || null;
    };

    const metaGraphPost = async (endpoint, payload, stepName) => {
      const response = await fetch(`https://graph.facebook.com/v20.0/${endpoint}`, {
        method: 'POST',
        body: payload
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        throw new Error(`[${stepName}] ${parseMetaError(result.error)}`);
      }
      return result;
    };

    const resolveMetaInterestTargets = async (audienceInterests) => {
      const cleanInterests = Array.isArray(audienceInterests)
        ? audienceInterests.map(value => String(value).trim()).filter(Boolean).slice(0, 5)
        : [];

      const targets = [];
      for (const interest of cleanInterests) {
        try {
          const params = new URLSearchParams({
            type: 'adinterest',
            q: interest,
            limit: '1',
            access_token: metaAccessToken
          });
          const searchResponse = await fetch(`https://graph.facebook.com/v20.0/search?${params.toString()}`);
          const searchResult = await searchResponse.json().catch(() => ({}));
          const matched = Array.isArray(searchResult.data) ? searchResult.data[0] : null;
          if (matched?.id && matched?.name) {
            targets.push({ id: matched.id, name: matched.name });
          }
        } catch (interestError) {
          logStep(
            'ad_set_targeting',
            'warning',
            `Interest lookup failed for "${interest}". Falling back to broad targeting for this interest.`,
            interestError.message
          );
        }
      }
      return targets;
    };

    const buildImageUploadPayload = async () => {
      let imageBytes;
      let mimeType = 'image/jpeg';
      let filename = `${sanitizeFileName(campaign_name)}.jpg`;

      if (ad_creative?.manual_banner_base64) {
        const rawValue = String(ad_creative.manual_banner_base64).trim();
        const dataUri = rawValue.match(/^data:(.*?);base64,(.*)$/);
        const base64Content = dataUri ? dataUri[2] : rawValue;
        mimeType = dataUri?.[1] || mimeType;
        imageBytes = Buffer.from(base64Content, 'base64');
        if (!imageBytes || imageBytes.length === 0) {
          throw new Error('manual_banner_base64 did not contain valid image bytes.');
        }
        logStep('ad_image_prepare', 'success', 'Prepared image bytes from ad_creative.manual_banner_base64.');
      } else if (ad_creative?.generated_image_url) {
        const imageResponse = await fetch(ad_creative.generated_image_url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download generated image URL. HTTP ${imageResponse.status}`);
        }
        imageBytes = Buffer.from(await imageResponse.arrayBuffer());
        mimeType = imageResponse.headers.get('content-type') || mimeType;
        filename = `${sanitizeFileName(campaign_name)}-generated.jpg`;
        if (!imageBytes || imageBytes.length === 0) {
          throw new Error('Generated image URL response did not contain bytes.');
        }
        logStep('ad_image_prepare', 'success', 'Downloaded image bytes from ad_creative.generated_image_url.');
      } else {
        throw new Error('No image source provided. Supply ad_creative.manual_banner_base64 or ad_creative.generated_image_url.');
      }

      const imageForm = new FormData();
      imageForm.append('access_token', metaAccessToken);
      imageForm.append('filename', new Blob([imageBytes], { type: mimeType }), filename);
      return imageForm;
    };

    if (shouldLaunchMeta) {
      // Resolve Meta Access Token and Ad Account ID dynamically for this client from database
      const db = await getDatabase();
      let metaAccessToken = null;
      let metaAdAccountId = null;
      let targetPageId = null;

      const resolvedClientName = client_name || req.body.businessName || req.body.campaign_name;
      if (resolvedClientName) {
        const clientConfig = await db.get(
          'SELECT access_token, user_access_token, ad_account_id, page_id FROM page_configs WHERE lower(client_name) = lower(?) LIMIT 1',
          [resolvedClientName.trim()]
        );
        if (clientConfig) {
          // Use user_access_token if present (OAuth), fallback to page access token
          metaAccessToken = clientConfig.user_access_token?.trim() || clientConfig.access_token?.trim();
          metaAdAccountId = normalizeAdAccountId(clientConfig.ad_account_id?.trim());
          targetPageId = clientConfig.page_id?.trim();
        }
      }

      // Fallback to environment variables if not configured in db (ensures backward compatibility)
      if (!metaAccessToken) {
        metaAccessToken = process.env.META_ACCESS_TOKEN?.trim();
      }
      if (!metaAdAccountId) {
        metaAdAccountId = normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID?.trim());
      }

      if (!metaAccessToken || !metaAdAccountId) {
        logStep(
          'meta_preflight',
          'error',
          'Meta Ads credentials are missing.',
          'Connect your Meta account on the dashboard or set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.'
        );
        return res.status(400).json({
          success: false,
          status: 'Launch Failed',
          error: 'Meta Ads credentials are missing.',
          deployment_log: deploymentLog,
          receipt: buildReceipt(req.body)
        });
      }

      logStep('meta_preflight', 'success', 'Meta launch preflight checks passed.', {
        ad_account_id: metaAdAccountId,
        objective,
        optimization_goal: optimizationGoal
      });

      metaEntities.page_id = await getPageIdForCreative();
      if (!metaEntities.page_id) {
        logStep(
          'meta_page_resolution',
          'error',
          'Unable to resolve a Meta Page ID for ad creative creation.',
          'Provide page_id in payload, META_PAGE_ID in environment, or configure page_configs in DB.'
        );
        return res.status(400).json({
          success: false,
          status: 'Launch Failed',
          error: 'Meta Page ID is required to create ad creatives.',
          deployment_log: deploymentLog,
          receipt: buildReceipt(req.body)
        });
      }
      logStep('meta_page_resolution', 'success', `Using Meta Page ID ${metaEntities.page_id} for ad creative.`);

      // 1) Campaign
      const campaignPayload = new URLSearchParams({
        name: campaign_name,
        objective,
        status: 'PAUSED',
        special_ad_categories: '["NONE"]',
        is_adset_budget_sharing_enabled: 'false',
        access_token: metaAccessToken
      });
      const campaignResult = await metaGraphPost(`${metaAdAccountId}/campaigns`, campaignPayload, 'meta_campaign_create');
      metaEntities.campaign_id = campaignResult.id;
      logStep('meta_campaign_create', 'success', 'Campaign created in PAUSED state.', { campaign_id: metaEntities.campaign_id });

      // 2) Ad Set
      const mappedInterests = await resolveMetaInterestTargets(targeting?.audience_interests);
      const targetingSpec = {
        geo_locations: { countries: ['IN', 'US'] },
        age_min: 21,
        age_max: 55
      };
      if (mappedInterests.length > 0) {
        targetingSpec.interests = mappedInterests;
        logStep('meta_ad_set_targeting', 'success', `Mapped ${mappedInterests.length} audience interests to Meta targeting.`, mappedInterests);
      } else {
        logStep('meta_ad_set_targeting', 'warning', 'No audience interests were mapped. Using broad geo targeting fallback (IN/US).');
      }

      const dailyBudgetMinorUnits = Math.max(100, Math.round(dailyBudget * 100));
      const adSetPayload = new URLSearchParams({
        name: `${campaign_name} - Ad Set`,
        campaign_id: metaEntities.campaign_id,
        daily_budget: String(dailyBudgetMinorUnits),
        billing_event: 'IMPRESSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        optimization_goal: optimizationGoal,
        targeting: JSON.stringify(targetingSpec),
        status: 'PAUSED',
        access_token: metaAccessToken
      });
      if (optimizationGoal === 'LEADS') {
        adSetPayload.append('promoted_object', JSON.stringify({ page_id: metaEntities.page_id }));
      }
      const adSetResult = await metaGraphPost(`${metaAdAccountId}/adsets`, adSetPayload, 'meta_ad_set_create');
      metaEntities.ad_set_id = adSetResult.id;
      logStep('meta_ad_set_create', 'success', 'Ad Set created in PAUSED state.', {
        ad_set_id: metaEntities.ad_set_id,
        daily_budget_minor_units: dailyBudgetMinorUnits
      });

      // 3) Ad Image
      const imagePayload = await buildImageUploadPayload();
      const imageResult = await metaGraphPost(`${metaAdAccountId}/adimages`, imagePayload, 'meta_ad_image_upload');
      metaEntities.image_hash = resolveImageHash(imageResult);
      if (!metaEntities.image_hash) {
        throw new Error('[meta_ad_image_upload] Meta did not return an image hash.');
      }
      logStep('meta_ad_image_upload', 'success', 'Ad image uploaded successfully.', { image_hash: metaEntities.image_hash });

      // 4) Ad Creative
      const headline = ad_creative?.headlines?.[0] || `${campaign_name} Offer`;
      const primaryText = ad_creative?.primary_text || 'Discover more about this offer.';
      const ctaType = mapCallToActionType(ad_creative?.call_to_action);
      const objectStorySpec = {
        page_id: metaEntities.page_id,
        link_data: {
          link: destinationLink,
          message: primaryText,
          name: headline,
          image_hash: metaEntities.image_hash,
          call_to_action: {
            type: ctaType,
            value: { link: destinationLink }
          }
        }
      };
      const creativePayload = new URLSearchParams({
        name: `${campaign_name} - Creative`,
        object_story_spec: JSON.stringify(objectStorySpec),
        access_token: metaAccessToken
      });
      const creativeResult = await metaGraphPost(`${metaAdAccountId}/adcreatives`, creativePayload, 'meta_ad_creative_create');
      metaEntities.creative_id = creativeResult.id;
      logStep('meta_ad_creative_create', 'success', 'Ad Creative created.', { creative_id: metaEntities.creative_id });

      // 5) Ad Object
      const adPayload = new URLSearchParams({
        name: `${campaign_name} - Ad`,
        adset_id: metaEntities.ad_set_id,
        creative: JSON.stringify({ creative_id: metaEntities.creative_id }),
        status: 'PAUSED',
        access_token: metaAccessToken
      });
      const adResult = await metaGraphPost(`${metaAdAccountId}/ads`, adPayload, 'meta_ad_create');
      metaEntities.ad_id = adResult.id;
      logStep('meta_ad_create', 'success', 'Ad object created in PAUSED state.', { ad_id: metaEntities.ad_id });

      activeDestinations.push(`Meta Social Ads (Campaign: ${metaEntities.campaign_id}, Ad Set: ${metaEntities.ad_set_id}, Ad: ${metaEntities.ad_id})`);
    }

    if (shouldLaunchGoogle) {
      const googleDeveloperToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
      const googleClientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
      const googleClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
      const googleRefreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();
      const googleCustomerIdRaw = process.env.GOOGLE_ADS_CUSTOMER_ID?.trim();
      const googleLoginCustomerIdRaw = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim();
      const googleCustomerId = googleCustomerIdRaw ? googleCustomerIdRaw.replace(/-/g, '') : '';
      const googleLoginCustomerId = googleLoginCustomerIdRaw ? googleLoginCustomerIdRaw.replace(/-/g, '') : '';
      googleEntities.customer_id = googleCustomerId || null;

      if (!googleDeveloperToken || !googleClientId || !googleClientSecret || !googleRefreshToken || !googleCustomerId) {
        logStep(
          'google_preflight',
          'error',
          'Google Ads credentials are missing.',
          'Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, and GOOGLE_ADS_CUSTOMER_ID.'
        );
        return res.status(400).json({
          success: false,
          status: 'Launch Failed',
          error: 'Google Ads credentials are missing.',
          deployment_log: deploymentLog,
          receipt: buildReceipt(req.body)
        });
      }

      const googleApiBase = `https://googleads.googleapis.com/v17/customers/${googleCustomerId}`;
      const googleHeadersBase = {
        'developer-token': googleDeveloperToken,
        'Content-Type': 'application/json'
      };
      if (googleLoginCustomerId) {
        googleHeadersBase['login-customer-id'] = googleLoginCustomerId;
      }

      logStep('google_preflight', 'success', 'Google Ads launch preflight checks passed.', {
        customer_id: googleCustomerId
      });

      const tokenPayload = new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: googleRefreshToken,
        grant_type: 'refresh_token'
      });
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenPayload.toString()
      });
      const tokenResult = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenResult.access_token) {
        throw new Error(`[google_oauth_token] ${parseGoogleError(tokenResult)}`);
      }
      googleEntities.access_token = 'obtained';
      logStep('google_oauth_token', 'success', 'Obtained temporary Google OAuth access token.');

      const googleMutate = async (pathSuffix, operations, stepName) => {
        const response = await fetch(`${googleApiBase}/${pathSuffix}`, {
          method: 'POST',
          headers: {
            ...googleHeadersBase,
            Authorization: `Bearer ${tokenResult.access_token}`
          },
          body: JSON.stringify({ operations })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.error) {
          throw new Error(`[${stepName}] ${parseGoogleError(result)}`);
        }
        return result;
      };

      const googleBudgetMicros = Math.max(500000, Math.round(dailyBudget * 1000000));
      const budgetMutate = await googleMutate(
        'campaignBudgets:mutate',
        [{
          create: {
            name: `${campaign_name} Budget`,
            amountMicros: String(googleBudgetMicros),
            deliveryMethod: 'STANDARD'
          }
        }],
        'google_campaign_budget_create'
      );
      googleEntities.campaign_budget_resource_name = budgetMutate.results?.[0]?.resourceName || null;
      if (!googleEntities.campaign_budget_resource_name) {
        throw new Error('[google_campaign_budget_create] Missing campaign budget resource name in response.');
      }
      logStep('google_campaign_budget_create', 'success', 'Created Google campaign budget.', {
        budget_resource_name: googleEntities.campaign_budget_resource_name,
        amount_micros: googleBudgetMicros
      });

      const campaignMutate = await googleMutate(
        'campaigns:mutate',
        [{
          create: {
            name: `${campaign_name} Search Campaign`,
            status: 'PAUSED',
            advertisingChannelType: 'SEARCH',
            campaignBudget: googleEntities.campaign_budget_resource_name,
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: false,
              targetContentNetwork: false,
              targetPartnerSearchNetwork: false
            },
            manualCpc: {
              enhancedCpcEnabled: false
            }
          }
        }],
        'google_campaign_create'
      );
      googleEntities.campaign_resource_name = campaignMutate.results?.[0]?.resourceName || null;
      if (!googleEntities.campaign_resource_name) {
        throw new Error('[google_campaign_create] Missing campaign resource name in response.');
      }
      logStep('google_campaign_create', 'success', 'Created Google search campaign in PAUSED state.', {
        campaign_resource_name: googleEntities.campaign_resource_name
      });

      const adGroupMutate = await googleMutate(
        'adGroups:mutate',
        [{
          create: {
            name: `${campaign_name} Ad Group`,
            campaign: googleEntities.campaign_resource_name,
            status: 'PAUSED',
            type: 'SEARCH_STANDARD',
            cpcBidMicros: '1000000'
          }
        }],
        'google_ad_group_create'
      );
      googleEntities.ad_group_resource_name = adGroupMutate.results?.[0]?.resourceName || null;
      if (!googleEntities.ad_group_resource_name) {
        throw new Error('[google_ad_group_create] Missing ad group resource name in response.');
      }
      logStep('google_ad_group_create', 'success', 'Created Google ad group in PAUSED state.', {
        ad_group_resource_name: googleEntities.ad_group_resource_name
      });

      const headlines = Array.isArray(ad_creative?.headlines)
        ? ad_creative.headlines.map(h => String(h).trim()).filter(Boolean).slice(0, 3)
        : [];
      while (headlines.length < 3) {
        headlines.push(`${campaign_name} Offer ${headlines.length + 1}`);
      }
      const descriptions = Array.isArray(ad_creative?.descriptions)
        ? ad_creative.descriptions.map(d => String(d).trim()).filter(Boolean).slice(0, 2)
        : [];
      while (descriptions.length < 2) {
        descriptions.push('Learn more about our services and offers.');
      }

      const adGroupAdMutate = await googleMutate(
        'adGroupAds:mutate',
        [{
          create: {
            adGroup: googleEntities.ad_group_resource_name,
            status: 'PAUSED',
            ad: {
              finalUrls: [destinationLink],
              responsiveSearchAd: {
                headlines: headlines.map(text => ({ text })),
                descriptions: descriptions.map(text => ({ text }))
              }
            }
          }
        }],
        'google_ad_group_ad_create'
      );
      googleEntities.ad_group_ad_resource_name = adGroupAdMutate.results?.[0]?.resourceName || null;
      if (!googleEntities.ad_group_ad_resource_name) {
        throw new Error('[google_ad_group_ad_create] Missing ad group ad resource name in response.');
      }
      logStep('google_ad_group_ad_create', 'success', 'Created Google responsive search ad in PAUSED state.', {
        ad_group_ad_resource_name: googleEntities.ad_group_ad_resource_name,
        final_url: destinationLink
      });

      const keywordPhrases = ensureGoogleKeywords(targeting?.keywords);
      const keywordOperations = keywordPhrases.map(text => ({
        create: {
          adGroup: googleEntities.ad_group_resource_name,
          status: 'PAUSED',
          keyword: {
            text,
            matchType: 'BROAD'
          }
        }
      }));
      const keywordsMutate = await googleMutate(
        'adGroupCriteria:mutate',
        keywordOperations,
        'google_keywords_create'
      );
      googleEntities.keyword_resource_names = Array.isArray(keywordsMutate.results)
        ? keywordsMutate.results.map(result => result.resourceName).filter(Boolean)
        : [];
      logStep('google_keywords_create', 'success', 'Created Google broad-match keywords.', {
        total_keywords: googleEntities.keyword_resource_names.length,
        keywords: keywordPhrases
      });

      activeDestinations.push(`Google Ads (Campaign: ${googleEntities.campaign_resource_name}, Ad Group: ${googleEntities.ad_group_resource_name})`);
    }

    if (linked_accounts?.linkedin) {
      activeDestinations.push(`LinkedIn Ads (Account: ${linked_accounts.linkedin})`);
      logStep('external_channel_linkedin', 'info', `LinkedIn linked account detected: ${linked_accounts.linkedin}.`);
    }

    logStep('finalize', 'success', 'Ads publishing pipeline completed successfully.', {
      campaign_id: metaEntities.campaign_id,
      ad_set_id: metaEntities.ad_set_id,
      google_campaign_resource_name: googleEntities.campaign_resource_name,
      google_ad_group_resource_name: googleEntities.ad_group_resource_name,
      creative_id: metaEntities.creative_id,
      ad_id: metaEntities.ad_id
    });

    res.json({
      success: true,
      status: 'Active & Live',
      deployment_log: deploymentLog,
      receipt: buildReceipt({
        campaign_name,
        budget_allocation,
        targeting,
        ad_creative,
        network_destinations: activeDestinations
      })
    });
  } catch (error) {
    logStep('pipeline_error', 'error', 'Meta Ads publishing pipeline failed.', error.message);
    console.error('Error launching campaign:', error.message);
    res.status(502).json({
      success: false,
      status: 'Launch Failed',
      error: 'Failed to deploy campaign.',
      details: error.message,
      deployment_log: deploymentLog,
      receipt: buildReceipt(req.body)
    });
  }
});

// GET: Fetch all leads (with optional client filtering)
app.get('/api/leads', async (req, res) => {
  const { client } = req.query;
  try {
    const db = await getDatabase();
    let leads;
    if (client && client !== 'All') {
      leads = await db.all('SELECT * FROM leads WHERE client_name = ? ORDER BY created_at DESC', [client]);
    } else {
      leads = await db.all('SELECT * FROM leads ORDER BY created_at DESC');
    }
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT: Update lead status
app.put('/api/leads/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const validStatuses = ['New', 'Contacted', 'Qualified', 'Lost'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const db = await getDatabase();
    const result = await db.run('UPDATE leads SET status = ? WHERE id = ?', [status, id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const updatedLead = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
    res.json(updatedLead);
  } catch (error) {
    console.error('Error updating lead status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST: Webhook receiver (Make.com integration)
app.post('/api/webhooks/leads', async (req, res) => {
  const { name, email, phone, campaign_name, platform, client_name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is a required field' });
  }

  try {
    const db = await getDatabase();
    const newLead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name,
      email: email || '',
      phone: phone || '',
      campaign_name: campaign_name || 'Direct / Unknown Campaign',
      status: 'New',
      created_at: new Date().toISOString(),
      platform: platform || 'Facebook',
      client_name: client_name || 'Sanna Innovations'
    };

    await db.run(
      `INSERT INTO leads (id, name, email, phone, campaign_name, status, created_at, platform, client_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newLead.id, newLead.name, newLead.email, newLead.phone, newLead.campaign_name, newLead.status, newLead.created_at, newLead.platform, newLead.client_name]
    );

    console.log('Successfully ingested new lead from Webhook:', newLead);
    res.status(201).json({ message: 'Lead ingested successfully', lead: newLead });
  } catch (error) {
    console.error('Error ingesting webhook lead:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: Meta Webhook Verification
app.get('/api/webhooks/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.META_VERIFY_TOKEN || 'astraads_verify_token_secret';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Meta Webhook] Verification successful.');
    return res.status(200).send(challenge);
  } else {
    console.warn('[Meta Webhook] Verification failed. Token mismatch.');
    return res.sendStatus(403);
  }
});

// POST: Meta Webhook Receiver (Direct Integration)
app.post('/api/webhooks/meta', async (req, res) => {
  // Meta sends a success status code back immediately to prevent retries
  res.status(200).send('EVENT_RECEIVED');

  try {
    const entry = req.body.entry;
    if (!entry || !Array.isArray(entry)) return;

    const db = await getDatabase();

    for (const item of entry) {
      const changes = item.changes;
      if (!changes || !Array.isArray(changes)) continue;

      for (const change of changes) {
        if (change.field !== 'leadgen') continue;

        const value = change.value;
        const leadgenId = value.leadgen_id;
        const pageId = value.page_id;

        console.log(`[Meta Webhook] Received leadgen event: ID ${leadgenId} for page ${pageId}`);

        // 1. Fetch Page Token Config from DB
        const pageConfig = await db.get('SELECT * FROM page_configs WHERE page_id = ?', [pageId]);
        
        let accessToken = process.env.META_ACCESS_TOKEN; // Fallback to global token
        let clientName = 'ALIS Technology';

        if (pageConfig) {
          accessToken = pageConfig.access_token;
          clientName = pageConfig.client_name;
        }

        if (!accessToken) {
          console.error(`[Meta Webhook] Access token not configured for page ID: ${pageId}. Skipping.`);
          continue;
        }

        // 2. Fetch Lead Details from Meta Graph API
        const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?fields=created_time,id,field_data,campaign_name&access_token=${accessToken}`;
        const graphResponse = await fetch(graphUrl);
        const leadData = await graphResponse.json();

        if (leadData.error) {
          console.error(`[Meta Webhook] Meta Graph API Error fetching lead ${leadgenId}:`, leadData.error.message);
          continue;
        }

        // 3. Extract Field Values from Meta JSON structure
        const fieldData = leadData.field_data || [];
        
        const nameObj = fieldData.find(f => f.name === 'full_name' || f.name.includes('name'));
        const emailObj = fieldData.find(f => f.name === 'email');
        const phoneObj = fieldData.find(f => f.name === 'phone_number' || f.name.includes('phone'));

        const name = nameObj && nameObj.values ? nameObj.values[0] : 'Meta Lead';
        const email = emailObj && emailObj.values ? emailObj.values[0] : '';
        const phone = phoneObj && phoneObj.values ? phoneObj.values[0] : '';
        const campaignName = leadData.campaign_name || 'Meta Direct Campaign';

        // 4. Save lead to SQLite database
        const newLead = {
          id: `lead_${leadgenId || Date.now()}_${Math.random().toString(36).substr(2, 3)}`,
          name: name,
          email: email,
          phone: phone,
          campaign_name: campaignName,
          status: 'New',
          created_at: leadData.created_time || new Date().toISOString(),
          platform: 'Facebook',
          client_name: clientName
        };

        await db.run(
          `INSERT INTO leads (id, name, email, phone, campaign_name, status, created_at, platform, client_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newLead.id, newLead.name, newLead.email, newLead.phone, newLead.campaign_name, newLead.status, newLead.created_at, newLead.platform, newLead.client_name]
        );

        console.log(`[Meta Webhook] Lead ${newLead.id} ingested successfully for client "${clientName}"`);
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Processing failed:', err.message);
  }
});

// POST: Google Webhook Receiver (Direct Integration)
app.post('/api/webhooks/google', async (req, res) => {
  const { lead_id, user_column_data, campaign_id, google_key } = req.body;
  const clientName = req.query.client || 'ALIS Technology'; // Passed as ?client=Name in URL

  // Optional key check for security
  const verifyKey = process.env.GOOGLE_VERIFY_KEY || 'astraads_google_key_secret';
  if (google_key && google_key !== verifyKey) {
    console.warn('[Google Webhook] Unauthorized request. Key mismatch.');
    return res.status(401).json({ error: 'Unauthorized key' });
  }

  if (!user_column_data || !Array.isArray(user_column_data)) {
    return res.status(400).json({ error: 'Invalid Google Ads payload' });
  }

  try {
    const db = await getDatabase();

    // Parse Google's user_column_data structure
    const nameObj = user_column_data.find(c => c.column_id === 'FULL_NAME' || c.column_name?.toLowerCase().includes('name'));
    const emailObj = user_column_data.find(c => c.column_id === 'EMAIL' || c.column_name?.toLowerCase().includes('email'));
    const phoneObj = user_column_data.find(c => c.column_id === 'PHONE_NUMBER' || c.column_name?.toLowerCase().includes('phone'));

    const name = nameObj ? nameObj.string_value : 'Google Lead';
    const email = emailObj ? emailObj.string_value : '';
    const phone = phoneObj ? phoneObj.string_value : '';
    const campaignName = `Google Campaign (ID: ${campaign_id || 'Direct'})`;

    const newLead = {
      id: `lead_${lead_id || Date.now()}_${Math.random().toString(36).substr(2, 3)}`,
      name: name,
      email: email,
      phone: phone,
      campaign_name: campaignName,
      status: 'New',
      created_at: new Date().toISOString(),
      platform: 'Google',
      client_name: clientName
    };

    await db.run(
      `INSERT INTO leads (id, name, email, phone, campaign_name, status, created_at, platform, client_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newLead.id, newLead.name, newLead.email, newLead.phone, newLead.campaign_name, newLead.status, newLead.created_at, newLead.platform, newLead.client_name]
    );

    console.log(`[Google Webhook] Ingested Google Ads lead successfully for client "${clientName}":`, newLead);
    res.status(201).json({ message: 'Google lead ingested successfully', lead: newLead });
  } catch (error) {
    console.error('[Google Webhook] Error ingesting lead:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST: Register page ID access tokens for direct Meta webhooks
app.post('/api/webhooks/meta/config', async (req, res) => {
  const { page_id, access_token, client_name, secret_key } = req.body;

  const adminSecret = process.env.ADMIN_SECRET_KEY || 'astraads_admin_secret_998';
  if (secret_key !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized secret' });
  }

  if (!page_id || !access_token || !client_name) {
    return res.status(400).json({ error: 'Missing config properties page_id, access_token, or client_name' });
  }

  try {
    const db = await getDatabase();
    await db.run(
      `INSERT OR REPLACE INTO page_configs (page_id, access_token, client_name)
       VALUES (?, ?, ?)`,
      [page_id, access_token, client_name]
    );
    console.log(`[Webhook Config] Registered token for Page: ${page_id} (${client_name})`);
    res.json({ success: true, message: `Configuration saved for client: ${client_name}` });
  } catch (error) {
    console.error('[Webhook Config] Save failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST: Trigger a mock webhook lead for manual testing
app.post('/api/webhooks/test', async (req, res) => {
  const firstNames = ['Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Ava', 'Elijah', 'Charlotte', 'William', 'Sophia'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const campaigns = ['Summer Promo 2026', 'AI Automation Leads', 'Retargeting Q3', 'E-commerce Scale 2026', 'ASHIRWADA LEADS 1st may'];
  const platforms = ['Facebook', 'Instagram'];
  const clients = ['Sanna Innovations', 'Apex Marketing', 'Cyberdyne Systems', 'Ashirwada Leads'];

  const randomName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  const randomEmail = `${randomName.toLowerCase().replace(' ', '.')}@example.com`;
  const randomPhone = `+1 (555) 01${Math.floor(10 + Math.random() * 90)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const randomCampaign = campaigns[Math.floor(Math.random() * campaigns.length)];
  const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
  const randomClient = clients[Math.floor(Math.random() * clients.length)];

  try {
    const db = await getDatabase();
    const testLead = {
      id: `lead_${Date.now()}_test`,
      name: randomName,
      email: randomEmail,
      phone: randomPhone,
      campaign_name: randomCampaign,
      status: 'New',
      created_at: new Date().toISOString(),
      platform: randomPlatform,
      client_name: randomClient
    };

    await db.run(
      `INSERT INTO leads (id, name, email, phone, campaign_name, status, created_at, platform, client_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testLead.id, testLead.name, testLead.email, testLead.phone, testLead.campaign_name, testLead.status, testLead.created_at, testLead.platform, testLead.client_name]
    );

    console.log('Injected test lead:', testLead);
    res.status(201).json({ message: 'Test lead injected successfully', lead: testLead });
  } catch (error) {
    console.error('Error generating test lead:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: Fetch analytics metrics
app.get('/api/stats', async (req, res) => {
  const { client } = req.query;
  const filterClient = client && client !== 'All';

  try {
    const db = await getDatabase();
    
    let totalQuery = 'SELECT COUNT(*) as count FROM leads';
    let statusQuery = 'SELECT status, COUNT(*) as count FROM leads';
    let campaignQuery = 'SELECT campaign_name, COUNT(*) as count FROM leads';
    let platformQuery = 'SELECT platform, COUNT(*) as count FROM leads';
    
    const params = [];
    if (filterClient) {
      totalQuery += ' WHERE client_name = ?';
      statusQuery += ' WHERE client_name = ?';
      campaignQuery += ' WHERE client_name = ?';
      platformQuery += ' WHERE client_name = ?';
      params.push(client);
    }
    
    statusQuery += ' GROUP BY status';
    campaignQuery += ' GROUP BY campaign_name ORDER BY count DESC LIMIT 5';
    platformQuery += ' GROUP BY platform';

    // Total Leads
    const totalRow = await db.get(totalQuery, params);
    const totalLeads = totalRow.count;

    // Status breakdown
    const statusRows = await db.all(statusQuery, params);
    const statusStats = { New: 0, Contacted: 0, Qualified: 0, Lost: 0 };
    statusRows.forEach(row => {
      statusStats[row.status] = row.count;
    });

    // Campaign breakdown
    const campaignRows = await db.all(campaignQuery, params);

    // Platform breakdown
    const platformRows = await db.all(platformQuery, params);

    // Conversion rate (Qualified / Total)
    const conversionRate = totalLeads > 0 
      ? Math.round((statusStats.Qualified / totalLeads) * 100) 
      : 0;

    res.json({
      total: totalLeads,
      byStatus: statusStats,
      byCampaign: campaignRows,
      byPlatform: platformRows,
      conversionRate
    });
  } catch (error) {
    console.error('Error calculating statistics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: Fetch list of unique clients
app.get('/api/clients', async (req, res) => {
  try {
    const db = await getDatabase();
    const rows = await db.all('SELECT DISTINCT client_name FROM leads ORDER BY client_name ASC');
    const clients = rows.map(r => r.client_name);
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients list:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: Check connection status for a client
app.get('/api/clients/connections', async (req, res) => {
  const { client } = req.query;
  if (!client) {
    return res.status(400).json({ error: 'Client query parameter is required.' });
  }
  try {
    const db = await getDatabase();
    const config = await db.get(
      'SELECT page_id, page_name, ad_account_id FROM page_configs WHERE lower(client_name) = lower(?) LIMIT 1',
      [client.trim()]
    );
    if (config) {
      res.json({
        connected: true,
        page_id: config.page_id,
        page_name: config.page_name || 'Linked Page',
        ad_account_id: config.ad_account_id
      });
    } else {
      res.json({ connected: false });
    }
  } catch (error) {
    console.error('Error checking client connection:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: Start Facebook/Meta Ads OAuth flow
app.get('/api/auth/facebook', (req, res) => {
  const client = req.query.client;
  if (!client) {
    return res.status(400).send('Client parameter is required.');
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = encodeURIComponent(
    process.env.META_REDIRECT_URI || `http://localhost:${PORT}/api/auth/facebook/callback`
  );
  
  if (!appId) {
    return res.status(500).send('META_APP_ID is not configured in environment variables.');
  }

  const configId = process.env.META_CONFIG_ID?.trim();
  let oauthUrl;

  if (configId) {
    oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&config_id=${configId}&state=${encodeURIComponent(client)}`;
  } else {
    const scopes = 'ads_management,pages_read_engagement,pages_show_list,leads_retrieval';
    oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scopes}&state=${encodeURIComponent(client)}`;
  }
  
  res.redirect(oauthUrl);
});

// GET: Facebook/Meta Ads OAuth callback
app.get('/api/auth/facebook/callback', async (req, res) => {
  const { code, state: clientName, error_description } = req.query;

  if (error_description) {
    return res.status(400).send(`OAuth Error: ${error_description}`);
  }
  if (!code || !clientName) {
    return res.status(400).send('OAuth Error: Missing authorization code or client context.');
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = encodeURIComponent(
    process.env.META_REDIRECT_URI || `http://localhost:${PORT}/api/auth/facebook/callback`
  );

  try {
    // 1. Exchange temporary authorization code for user access token
    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${code}`;
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Failed to exchange OAuth code.');
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange short-lived token for long-lived (60-day) User Access Token
    const longLivedUrl = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    if (!longLivedResponse.ok || !longLivedData.access_token) {
      throw new Error(longLivedData.error?.message || 'Failed to generate 60-day access token.');
    }

    const userToken = longLivedData.access_token;

    // 3. Fetch user's pages
    const pagesUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=name,id,access_token&limit=100&access_token=${userToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok) {
      throw new Error(pagesData.error?.message || 'Failed to fetch user pages.');
    }

    const pages = pagesData.data || [];

    // 4. Fetch user's ad accounts
    const adAccountsUrl = `https://graph.facebook.com/v20.0/me/adaccounts?fields=name,account_id&limit=100&access_token=${userToken}`;
    const adAccountsResponse = await fetch(adAccountsUrl);
    const adAccountsData = await adAccountsResponse.json();

    if (!adAccountsResponse.ok) {
      throw new Error(adAccountsData.error?.message || 'Failed to fetch user ad accounts.');
    }

    const adAccounts = adAccountsData.data || [];

    // Map page IDs to their corresponding page tokens for saving later
    const pageTokensMap = {};
    pages.forEach(p => {
      pageTokensMap[p.id] = p.access_token;
    });

    // Build select dropdown options
    const pagesOptions = pages.map(p => {
      const valStr = JSON.stringify({ id: p.id, name: p.name });
      return `<option value='${valStr.replace(/'/g, "&apos;")}'>${p.name} (ID: ${p.id})</option>`;
    }).join('\n');

    const adAccountsOptions = adAccounts.map(a => {
      const valStr = JSON.stringify({ id: a.account_id, name: a.name });
      return `<option value='${valStr.replace(/'/g, "&apos;")}'>${a.name} (ID: act_${a.account_id})</option>`;
    }).join('\n');

    // Render selection dashboard HTML page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Link Meta Assets - AstraAds</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg: #0b0f19;
            --card-bg: #111827;
            --accent: #2563eb;
            --accent-hover: #1d4ed8;
            --text: #f3f4f6;
            --text-muted: #9ca3af;
            --border: #374151;
          }
          body {
            font-family: 'Outfit', sans-serif;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 32px;
            width: 100%;
            max-width: 480px;
            box-sizing: border-box;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          }
          h2 {
            margin-top: 0;
            font-size: 24px;
            font-weight: 700;
            text-align: center;
            background: linear-gradient(135deg, #60a5fa, #2563eb);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            color: var(--text-muted);
            text-align: center;
            margin-bottom: 24px;
            line-height: 1.5;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 14px;
          }
          select {
            width: 100%;
            padding: 12px;
            background: #1f2937;
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-family: inherit;
            font-size: 15px;
            box-sizing: border-box;
            outline: none;
          }
          select:focus {
            border-color: var(--accent);
          }
          button {
            width: 100%;
            padding: 14px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            font-family: inherit;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
            margin-top: 10px;
          }
          button:hover {
            background: var(--accent-hover);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Link Meta Assets</h2>
          <p>Configure campaign and lead tracking for client: <strong>${clientName}</strong></p>
          <form action="/api/auth/facebook/save" method="POST">
            <input type="hidden" name="client_name" value="${clientName}">
            <input type="hidden" name="user_access_token" value="${userToken}">
            <input type="hidden" name="page_tokens" value='${JSON.stringify(pageTokensMap)}'>

            <div class="form-group">
              <label for="page_id_json">Select Facebook Page (for Webhook Leads):</label>
              <select name="page_id_json" id="page_id_json" required>
                ${pagesOptions || '<option value="" disabled>No pages found</option>'}
              </select>
            </div>

            <div class="form-group">
              <label for="ad_account_id_json">Select Facebook Ad Account (for Ads API):</label>
              <select name="ad_account_id_json" id="ad_account_id_json" required>
                ${adAccountsOptions || '<option value="" disabled>No ad accounts found</option>'}
              </select>
            </div>

            <button type="submit">Link Account Details</button>
          </form>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Meta OAuth callback failed:', error);
    res.status(500).send(`Failed to complete Meta authentication: ${error.message}`);
  }
});

// POST: Save user asset linkage selections
app.post('/api/auth/facebook/save', express.urlencoded({ extended: true }), async (req, res) => {
  const { client_name, user_access_token, page_id_json, ad_account_id_json, page_tokens } = req.body;

  try {
    const pageData = JSON.parse(page_id_json);
    const adAccountData = JSON.parse(ad_account_id_json);
    const pageTokensMap = JSON.parse(page_tokens);

    const pageId = pageData.id;
    const pageName = pageData.name;
    const adAccountId = `act_${adAccountData.id}`;
    const pageAccessToken = pageTokensMap[pageId];

    if (!pageAccessToken) {
      throw new Error("Missing Page Access Token for selected Page.");
    }

    const db = await getDatabase();

    await db.run(`
      INSERT INTO page_configs (page_id, access_token, client_name, ad_account_id, user_access_token, page_name)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(page_id) DO UPDATE SET
        access_token = excluded.access_token,
        client_name = excluded.client_name,
        ad_account_id = excluded.ad_account_id,
        user_access_token = excluded.user_access_token,
        page_name = excluded.page_name
    `, [pageId, pageAccessToken, client_name, adAccountId, user_access_token, pageName]);

    // Render a clean success page that closes itself and notifies parent dashboard
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connection Successful</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', sans-serif;
            background: #0b0f19;
            color: #f3f4f6;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
          }
          .container {
            padding: 32px;
          }
          h2 { color: #10b981; margin-bottom: 12px; }
          p { color: #9ca3af; margin-bottom: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Connection Successful!</h2>
          <p>Meta accounts for <strong>${client_name}</strong> have been linked successfully.</p>
          <p>This window will close automatically...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'META_AUTH_SUCCESS', client: '${client_name}' }, '*');
          }
          setTimeout(() => {
            window.close();
          }, 2000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error saving Meta assets:', error);
    res.status(500).send(`Failed to save linked assets: ${error.message}`);
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AstraAds server is running at http://localhost:${PORT}`);
});
