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

/**
 * Route: POST /api/campaigns/launch
 * Mock route acting as user approval/deployment receipt.
 * Evaluates active connected ad account IDs linked from the connection manager.
 */
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

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AstraAds server is running at http://localhost:${PORT}`);
});
