/**
 * AstraAds - Client-Side Controller (ES Module)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Onboarding Form Elements
  const onboardingForm = document.getElementById('onboarding-form');
  const submitBtn = document.getElementById('submit-btn');

  // Dashboard Structure Elements
  const reviewSection = document.getElementById('review-section');
  const placeholderDiv = document.getElementById('dashboard-placeholder');
  const dashboardContent = document.getElementById('dashboard-content');
  const campaignTitle = document.getElementById('campaign-title');
  const campaignStatus = document.getElementById('campaign-status');
  
  // Dashboard Cards Elements
  const dailyBudgetEl = document.getElementById('daily-budget');
  const budgetStrategyEl = document.getElementById('budget-strategy');
  const keywordsContainer = document.getElementById('keywords-container');
  const interestsContainer = document.getElementById('interests-container');
  const headlinesList = document.getElementById('headlines-list');
  const descriptionsList = document.getElementById('descriptions-list');
  const socialCaptionList = document.getElementById('social-caption-list');
  const strategicRationaleText = document.getElementById('strategic-rationale-text');
  
  // Preview Switcher Tabs & Mockups
  const tabBtnSearch = document.getElementById('tab-btn-search');
  const tabBtnSocial = document.getElementById('tab-btn-social');
  const searchAdMock = document.getElementById('search-ad-mock');
  const socialAdMock = document.getElementById('social-ad-mock');

  // Mock Ad Preview Elements (Google Search)
  const mockPathEl = document.getElementById('mock-path');
  const mockTitleEl = document.getElementById('mock-ad-title');
  const mockDescEl = document.getElementById('mock-ad-desc');
  const mockCtaEl = document.getElementById('mock-ad-cta');

  // Mock Ad Preview Elements (Social Feed)
  const mockSocialPageName = document.getElementById('mock-social-page-name');
  const mockSocialCaption = document.getElementById('mock-social-caption');
  const mockSocialDisplayUrl = document.getElementById('mock-social-display-url');
  const mockSocialHeadline = document.getElementById('mock-social-headline');
  const mockSocialCta = document.getElementById('mock-social-cta');

  // Connection Manager Elements
  const connectBtnGoogle = document.getElementById('connect-google');
  const connectBtnMeta = document.getElementById('connect-meta');
  const connectBtnLinkedin = document.getElementById('connect-linkedin');
  
  const statusGoogle = document.getElementById('status-text-google');
  const statusMeta = document.getElementById('status-text-meta');
  const statusLinkedin = document.getElementById('status-text-linkedin');

  // OAuth Modal Elements
  const oauthModal = document.getElementById('oauth-modal');
  const oauthLoadingBlock = document.getElementById('oauth-loading-block');
  const oauthLoadingText = document.getElementById('oauth-loading-text');
  const oauthSuccessBlock = document.getElementById('oauth-success-block');
  const oauthSuccessText = document.getElementById('oauth-success-text');

  // Control Buttons
  const regenerateBtn = document.getElementById('regenerate-btn');
  const approveBtn = document.getElementById('approve-btn');

  // Manual Upload Elements
  const socialImageBlock = document.getElementById('social-image-block');
  const manualBannerInput = document.getElementById('manual-banner-input');
  const resetBannerBtn = document.getElementById('reset-banner-btn');

  // Internal connection states (synced with localStorage)
  let connections = {
    'Google Search': null, // holds mock account ID when connected, e.g. 'act_google_1283'
    'Facebook / Instagram': null,
    'LinkedIn': null
  };

  // Internal state tracking
  let currentCampaignPayload = null;
  let lastSubmittedParams = null;

  // Initialize and Sync Connections
  loadConnectionsFromStorage();

  // Setup tab switcher event listeners
  tabBtnSearch.addEventListener('click', () => {
    tabBtnSearch.classList.add('active');
    tabBtnSocial.classList.remove('active');
    searchAdMock.classList.remove('hidden');
    socialAdMock.classList.add('hidden');
  });

  tabBtnSocial.addEventListener('click', () => {
    tabBtnSocial.classList.add('active');
    tabBtnSearch.classList.remove('active');
    socialAdMock.classList.remove('hidden');
    searchAdMock.classList.add('hidden');
  });

  // Setup OAuth Connection listeners
  connectBtnGoogle.addEventListener('click', () => handleConnectClick('Google Search', 'Google Ads', statusGoogle, connectBtnGoogle));
  connectBtnMeta.addEventListener('click', () => handleConnectClick('Facebook / Instagram', 'Meta Ads', statusMeta, connectBtnMeta));
  connectBtnLinkedin.addEventListener('click', () => handleConnectClick('LinkedIn', 'LinkedIn Ads', statusLinkedin, connectBtnLinkedin));

  // Onboarding form submission handler
  onboardingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Extract parameters
    const formData = new FormData(onboardingForm);
    const platforms = Array.from(onboardingForm.querySelectorAll('input[name="platforms"]:checked')).map(el => el.value);

    if (platforms.length === 0) {
      alert('Please select at least one Target Ad Channel.');
      return;
    }

    // Guard checking if selected channels are connected
    const disconnectedChannels = [];
    platforms.forEach(platform => {
      if (!connections[platform]) {
        disconnectedChannels.push(platform);
      }
    });

    if (disconnectedChannels.length > 0) {
      alert(`Connection Required: Please link your accounts first.\nDisconnected channels selected: ${disconnectedChannels.join(', ')}`);
      return;
    }

    const params = {
      businessName: formData.get('businessName'),
      products: formData.get('products'),
      targetAudience: formData.get('targetAudience'),
      monthlyBudget: Number(formData.get('monthlyBudget')),
      primaryGoal: formData.get('primaryGoal'),
      platforms: platforms
    };

    lastSubmittedParams = params;
    await triggerCampaignGeneration(params);
  });

  // Manual banner upload event listeners
  socialImageBlock.addEventListener('click', () => {
    manualBannerInput.click();
  });

  manualBannerInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        mockSocialImage.src = base64Data;
        
        if (currentCampaignPayload && currentCampaignPayload.ad_creative) {
          currentCampaignPayload.ad_creative.manual_banner_base64 = base64Data;
        }
        resetBannerBtn.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  resetBannerBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering file input click on the container
    manualBannerInput.value = '';
    
    if (currentCampaignPayload && currentCampaignPayload.ad_creative) {
      delete currentCampaignPayload.ad_creative.manual_banner_base64;
      
      const generatedUrl = currentCampaignPayload.ad_creative.generated_image_url;
      if (generatedUrl) {
        mockSocialImage.src = generatedUrl;
      } else {
        const imagePrompt = currentCampaignPayload.ad_creative.image_prompt;
        if (imagePrompt) {
          const urlEncodedPrompt = encodeURIComponent(imagePrompt);
          mockSocialImage.src = `https://image.pollinations.ai/prompt/${urlEncodedPrompt}?width=800&height=450&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
        } else {
          mockSocialImage.src = 'ad-banner.png';
        }
      }
    } else {
      mockSocialImage.src = 'ad-banner.png';
    }
    resetBannerBtn.classList.add('hidden');
  });

  // Regenerate Campaign listener
  regenerateBtn.addEventListener('click', async () => {
    if (!lastSubmittedParams) return;
    
    const originalContent = regenerateBtn.innerHTML;
    regenerateBtn.disabled = true;
    regenerateBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Regenerating...</span>`;
    
    try {
      await triggerCampaignGeneration(lastSubmittedParams);
    } finally {
      regenerateBtn.disabled = false;
      regenerateBtn.innerHTML = originalContent;
    }
  });

  // Approve and Launch Campaign listener
  approveBtn.addEventListener('click', async () => {
    if (!currentCampaignPayload) return;

    // Verify connections again before launching (guard)
    const activePlatforms = lastSubmittedParams?.platforms || [];
    const unlinked = activePlatforms.filter(p => !connections[p]);

    if (unlinked.length > 0) {
      alert(`Staging Blocked: Connect your ad account integrations for: ${unlinked.join(', ')}`);
      return;
    }

    const originalContent = approveBtn.innerHTML;
    approveBtn.disabled = true;
    approveBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Staging...</span>`;

    // Attach active connected account IDs to the launch payload
    const launchPayload = {
      ...currentCampaignPayload,
      linked_accounts: {
        google: connections['Google Search'],
        meta: connections['Facebook / Instagram'],
        linkedin: connections['LinkedIn']
      }
    };

    try {
      const response = await fetch('/api/campaigns/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(launchPayload)
      });

      if (!response.ok) {
        throw new Error('Launch network response was not successful');
      }

      const receipt = await response.json();
      console.log('Campaign successfully staged/launched live:', receipt);
      
      // Update DOM Status Pill to "Active & Live"
      campaignStatus.className = 'status-pill status-active';
      campaignStatus.querySelector('.status-text').textContent = receipt.status;
      
      // Highlight success on the board
      showLaunchNotification(receipt.receipt.campaign_id, receipt.receipt.network_destinations);

      // Disable staging action since it's already launched
      approveBtn.disabled = true;
      approveBtn.style.opacity = '0.5';
      approveBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Launched & Active</span>`;
      regenerateBtn.disabled = true;
      regenerateBtn.style.opacity = '0.5';

    } catch (err) {
      console.error('Launch failed:', err);
      alert('Failed to launch campaign. Please try again.');
      approveBtn.disabled = false;
      approveBtn.innerHTML = originalContent;
    }
  });

  /**
   * Helper function connecting to backend campaign generator.
   */
  async function triggerCampaignGeneration(params) {
    onboardingForm.classList.add('loading');
    submitBtn.disabled = true;
    
    if (!dashboardContent.classList.contains('hidden')) {
      dashboardContent.style.opacity = '0.6';
    }

    try {
      const response = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate ad campaign');
      }

      const campaignData = await response.json();
      currentCampaignPayload = campaignData;
      
      renderCampaignToDashboard(campaignData, params.businessName);

      placeholderDiv.classList.add('hidden');
      dashboardContent.classList.remove('hidden');
      dashboardContent.style.opacity = '1';

      approveBtn.disabled = false;
      approveBtn.style.opacity = '1';
      approveBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Approve & Launch Live</span>`;
      regenerateBtn.disabled = false;
      regenerateBtn.style.opacity = '1';

    } catch (err) {
      console.error('Generation request failed:', err);
      alert(`Generation Failed: ${err.message}`);
    } finally {
      onboardingForm.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  /**
   * Renders raw JSON campaign configuration into DOM components.
   */
  function renderCampaignToDashboard(campaign, businessName) {
    campaignStatus.className = 'status-pill status-draft';
    campaignStatus.querySelector('.status-text').textContent = 'Draft Review';
    campaignTitle.textContent = campaign.campaign_name || 'AI Generated Campaign';

    const dailyBudget = campaign.budget_allocation?.daily_budget;
    dailyBudgetEl.textContent = typeof dailyBudget === 'number' 
      ? `₹${dailyBudget.toFixed(2)}` 
      : `₹${dailyBudget}`;
    budgetStrategyEl.textContent = campaign.budget_allocation?.strategy || 'N/A';

    keywordsContainer.innerHTML = '';
    const keywords = campaign.targeting?.keywords || [];
    keywords.forEach(keyword => {
      const keywordBadge = document.createElement('span');
      keywordBadge.className = 'tag';
      keywordBadge.innerHTML = `<i class="fa-solid fa-tag"></i> ${keyword}`;
      keywordsContainer.appendChild(keywordBadge);
    });

    interestsContainer.innerHTML = '';
    const interests = campaign.targeting?.audience_interests || [];
    interests.forEach(interest => {
      const interestBadge = document.createElement('span');
      interestBadge.className = 'tag tag-interest';
      interestBadge.innerHTML = `<i class="fa-solid fa-user-tag"></i> ${interest}`;
      interestsContainer.appendChild(interestBadge);
    });

    headlinesList.innerHTML = '';
    const headlines = campaign.ad_creative?.headlines || [];
    headlines.forEach((headline, index) => {
      const charCount = headline.length;
      const isValid = charCount <= 30;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'validation-item';
      itemDiv.innerHTML = `
        <span class="validation-text"><strong>H${index + 1}:</strong> ${escapeHtml(headline)}</span>
        <div class="validation-meta">
          <span class="char-counter ${isValid ? 'counter-valid' : 'counter-invalid'}">
            ${charCount}/30
          </span>
          <i class="fa-solid ${isValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}" style="color: ${isValid ? '#10b981' : '#ef4444'}"></i>
        </div>
      `;
      headlinesList.appendChild(itemDiv);
    });

    descriptionsList.innerHTML = '';
    const descriptions = campaign.ad_creative?.descriptions || [];
    descriptions.forEach((desc, index) => {
      const charCount = desc.length;
      const isValid = charCount <= 90;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'validation-item';
      itemDiv.innerHTML = `
        <span class="validation-text"><strong>D${index + 1}:</strong> ${escapeHtml(desc)}</span>
        <div class="validation-meta">
          <span class="char-counter ${isValid ? 'counter-valid' : 'counter-invalid'}">
            ${charCount}/90
          </span>
          <i class="fa-solid ${isValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}" style="color: ${isValid ? '#10b981' : '#ef4444'}"></i>
        </div>
      `;
      descriptionsList.appendChild(itemDiv);
    });

    socialCaptionList.innerHTML = '';
    const primaryText = campaign.ad_creative?.primary_text || '';
    const textLength = primaryText.length;
    const isTextValid = textLength <= 125;

    const captionDiv = document.createElement('div');
    captionDiv.className = 'validation-item';
    captionDiv.innerHTML = `
      <span class="validation-text">${escapeHtml(primaryText || 'N/A')}</span>
      <div class="validation-meta">
        <span class="char-counter ${isTextValid ? 'counter-valid' : 'counter-invalid'}">
          ${textLength}/125
        </span>
        <i class="fa-solid ${isTextValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}" style="color: ${isTextValid ? '#10b981' : '#ef4444'}"></i>
      </div>
    `;
    socialCaptionList.appendChild(captionDiv);

    const firstHeadline = headlines[0] || 'Your Headline Here';
    const secondHeadline = headlines[1] ? ` | ${headlines[1]}` : '';
    const headlineString = `${firstHeadline}${secondHeadline}`;
    
    mockTitleEl.textContent = headlineString.length > 60 ? headlineString.substring(0, 57) + '...' : headlineString;
    mockDescEl.textContent = descriptions[0] || 'Your generated ad description text will render dynamically here.';
    mockCtaEl.textContent = campaign.ad_creative?.call_to_action || 'Learn More';
    mockPathEl.textContent = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    mockSocialPageName.textContent = businessName;
    mockSocialCaption.textContent = primaryText;
    mockSocialDisplayUrl.textContent = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com';
    mockSocialHeadline.textContent = headlines[0] || 'Exclusive Campaign Offer';
    mockSocialCta.textContent = campaign.ad_creative?.call_to_action || 'Learn More';

    // Clear manual banner elements upon new campaign generation
    if (resetBannerBtn) resetBannerBtn.classList.add('hidden');
    if (manualBannerInput) manualBannerInput.value = '';
    if (campaign.ad_creative) {
      delete campaign.ad_creative.manual_banner_base64;
    }

    // Dynamically update the social ad mockup poster using Pollinations AI based on Gemini's image_prompt
    const mockSocialImage = document.getElementById('mock-social-image');
    const imagePrompt = campaign.ad_creative?.image_prompt;
    if (mockSocialImage && imagePrompt) {
      const urlEncodedPrompt = encodeURIComponent(imagePrompt);
      const generatedUrl = `https://image.pollinations.ai/prompt/${urlEncodedPrompt}?width=800&height=450&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
      campaign.ad_creative.generated_image_url = generatedUrl;
      mockSocialImage.src = generatedUrl;
    } else {
      mockSocialImage.src = 'ad-banner.png';
    }

    strategicRationaleText.textContent = campaign.strategic_rationale || 'N/A';
  }

  /**
   * Manages connecting/disconnecting platforms.
   */
  // Listen for the OAuth success postMessage
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'META_AUTH_SUCCESS') {
      const client = document.getElementById('businessName')?.value?.trim();
      if (client && event.data.client.toLowerCase() === client.toLowerCase()) {
        checkClientMetaConnection(client);
      }
    }
  });

  // Dynamic connection checker for Meta Ads
  async function checkClientMetaConnection(clientName) {
    if (!clientName) {
      updateConnectionDOM('Facebook / Instagram', statusMeta, connectBtnMeta, false);
      return;
    }
    try {
      const res = await fetch(`/api/clients/connections?client=${encodeURIComponent(clientName)}`);
      const data = await res.json();
      if (data.connected) {
        connections['Facebook / Instagram'] = data.page_id;
        updateConnectionDOM('Facebook / Instagram', statusMeta, connectBtnMeta, true, `Connected: ${data.page_name}`);
      } else {
        connections['Facebook / Instagram'] = null;
        updateConnectionDOM('Facebook / Instagram', statusMeta, connectBtnMeta, false);
      }
      saveConnectionsToStorage();
    } catch (err) {
      console.error('Error checking Meta connection:', err);
    }
  }

  // Monitor Business Name input to update connection status dynamically
  const businessNameInput = document.getElementById('businessName');
  if (businessNameInput) {
    let checkTimeout;
    businessNameInput.addEventListener('input', (e) => {
      clearTimeout(checkTimeout);
      const val = e.target.value.trim();
      checkTimeout = setTimeout(() => {
        checkClientMetaConnection(val);
      }, 500);
    });
  }

  /**
   * Manages connecting/disconnecting platforms.
   */
  function handleConnectClick(platformKey, displayName, statusEl, buttonEl) {
    if (platformKey === 'Facebook / Instagram') {
      const client = document.getElementById('businessName')?.value?.trim();
      if (!client) {
        alert('Please enter your Business Name first to connect Meta Ads.');
        return;
      }
      if (connections[platformKey]) {
        if (confirm(`Do you want to disconnect Meta Ads for "${client}"?`)) {
          connections[platformKey] = null;
          saveConnectionsToStorage();
          updateConnectionDOM(platformKey, statusEl, buttonEl, false);
        }
        return;
      }
      // Open real OAuth Popup
      const width = 600, height = 720;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      window.open(
        `/api/auth/facebook?client=${encodeURIComponent(client)}`,
        'meta_oauth',
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
      );
      return;
    }

    if (connections[platformKey]) {
      // Disconnect action
      connections[platformKey] = null;
      saveConnectionsToStorage();
      updateConnectionDOM(platformKey, statusEl, buttonEl);
      return;
    }

    // Connect action: Trigger simulated OAuth OAuth authentication modal
    oauthModal.classList.remove('hidden');
    oauthLoadingBlock.classList.remove('hidden');
    oauthSuccessBlock.classList.add('hidden');
    
    const mockId = `act_${platformKey.toLowerCase().split(' ')[0]}_${Math.floor(100000 + Math.random() * 900000)}`;
    oauthLoadingText.textContent = `Connecting to Google Secure Gateways for ${displayName}...`;

    setTimeout(() => {
      oauthLoadingBlock.classList.add('hidden');
      oauthSuccessBlock.classList.remove('hidden');
      oauthSuccessText.textContent = `${displayName} Account Linked successfully (Sandbox Account: ${mockId}).`;
      
      // Store connection
      connections[platformKey] = mockId;
      saveConnectionsToStorage();
      updateConnectionDOM(platformKey, statusEl, buttonEl);

      // Close modal automatically
      setTimeout(() => {
        oauthModal.classList.add('hidden');
      }, 1500);

    }, 1800);
  }

  /**
   * Syncs connection status directly to the DOM connection boxes.
   */
  function updateConnectionDOM(platformKey, statusEl, buttonEl, overrideConnected = null, customLabel = null) {
    const isConnected = overrideConnected !== null ? overrideConnected : !!connections[platformKey];
    if (isConnected) {
      statusEl.className = 'status-badge status-connected';
      statusEl.textContent = customLabel || 'Connected';
      buttonEl.textContent = 'Disconnect';
      buttonEl.classList.add('btn-disconnect');
    } else {
      statusEl.className = 'status-badge status-disconnected';
      statusEl.textContent = 'Disconnected';
      buttonEl.textContent = 'Connect';
      buttonEl.classList.remove('btn-disconnect');
    }
  }

  /**
   * Reads connection details from localStorage.
   */
  function loadConnectionsFromStorage() {
    try {
      const stored = localStorage.getItem('astraads_connections') || localStorage.getItem('autoadai_connections');
      if (stored) {
        connections = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse connections from localStorage', e);
    }
    // Update elements on startup
    updateConnectionDOM('Google Search', statusGoogle, connectBtnGoogle);
    updateConnectionDOM('LinkedIn', statusLinkedin, connectBtnLinkedin);
    
    // Check Meta connection status dynamically based on current business name input
    const initialClientName = document.getElementById('businessName')?.value?.trim();
    if (initialClientName) {
      checkClientMetaConnection(initialClientName);
    } else {
      updateConnectionDOM('Facebook / Instagram', statusMeta, connectBtnMeta);
    }
  }

  function saveConnectionsToStorage() {
    localStorage.setItem('astraads_connections', JSON.stringify(connections));
  }

  /**
   * Triggers a temporary notification/receipt overlay when ad launches.
   */
  function showLaunchNotification(campaignId, activeChannels) {
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.background = 'rgba(16, 185, 129, 0.95)';
    notification.style.color = '#111827';
    notification.style.padding = '1.25rem 1.75rem';
    notification.style.borderRadius = '12px';
    notification.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.gap = '1rem';
    notification.style.zIndex = '1000';
    notification.style.fontFamily = 'var(--font-family)';
    notification.style.fontWeight = 'bold';
    notification.style.animation = 'fadeIn 0.3s ease-out forwards';
    
    notification.innerHTML = `
      <i class="fa-solid fa-circle-check" style="font-size: 1.5rem;"></i>
      <div>
        <div style="font-size: 0.95rem;">Campaign Deployed Staged Live!</div>
        <div style="font-size: 0.78rem; font-weight: normal; opacity: 0.88; margin-top: 0.2rem;">
          Staged on connected channels:<br>
          <span style="font-family: monospace; color: #1e293b;">${activeChannels.join(', ')}</span>
        </div>
      </div>
    `;

    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'pulse 0.3s reverse forwards';
      setTimeout(() => notification.remove(), 300);
    }, 6000);
  }

  // Simple HTML Escaper helper
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // Leads Manager Implementation
  // ==========================================================================
  
  // Leads Manager State
  const leadsState = {
    leads: [],
    stats: {},
    selectedClient: 'All',
    clients: [],
    charts: {
      campaign: null,
      status: null
    },
    selectedLead: null
  };

  // Leads Manager DOM Elements
  const leadsElements = {
    clientSelector: document.getElementById('client-selector'),
    btnRefreshLeads: document.getElementById('btn-refresh-leads'),
    metricTotal: document.getElementById('metric-total'),
    metricNew: document.getElementById('metric-new'),
    metricQualified: document.getElementById('metric-qualified'),
    metricConversion: document.getElementById('metric-conversion'),
    campaignChart: document.getElementById('campaignChart'),
    statusChart: document.getElementById('statusChart'),
    searchInput: document.getElementById('search-input'),
    statusFilter: document.getElementById('status-filter'),
    leadsTableBody: document.getElementById('leads-table-body'),
    webhookUrlDisplay: document.getElementById('webhook-url-display'),
    btnCopyWebhook: document.getElementById('btn-copy-webhook'),
    btnTriggerTestWebhook: document.getElementById('btn-trigger-test-webhook'),
    
    // Modal
    leadDetailModal: document.getElementById('lead-detail-modal'),
    btnCloseLeadModal: document.getElementById('btn-close-lead-modal'),
    modalLeadId: document.getElementById('modal-lead-id'),
    modalLeadName: document.getElementById('modal-lead-name'),
    modalLeadEmail: document.getElementById('modal-lead-email'),
    modalLeadPhone: document.getElementById('modal-lead-phone'),
    modalLeadCampaign: document.getElementById('modal-lead-campaign'),
    modalLeadPlatform: document.getElementById('modal-lead-platform'),
    modalLeadClient: document.getElementById('modal-lead-client'),
    modalLeadDate: document.getElementById('modal-lead-date'),
    modalStatusBtns: document.querySelectorAll('#lead-detail-modal .status-pill-btn'),
    
    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const panels = document.querySelectorAll('.tab-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.add('hidden'));
        
        tab.classList.add('active');
        const targetId = `tab-${tab.getAttribute('data-tab')}`;
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
          targetPanel.classList.remove('hidden');
        }
        
        if (tab.getAttribute('data-tab') === 'leads-manager') {
          refreshLeadsData();
        }
      });
    });
  }

  function setupLeadsEventListeners() {
    leadsElements.btnRefreshLeads.addEventListener('click', refreshLeadsData);
    leadsElements.btnTriggerTestWebhook.addEventListener('click', triggerTestWebhook);
    
    leadsElements.clientSelector.addEventListener('change', (e) => {
      leadsState.selectedClient = e.target.value;
      refreshLeadsData();
    });
    
    leadsElements.searchInput.addEventListener('input', renderLeadsTable);
    leadsElements.statusFilter.addEventListener('change', renderLeadsTable);
    
    leadsElements.btnCopyWebhook.addEventListener('click', () => {
      navigator.clipboard.writeText(leadsElements.webhookUrlDisplay.textContent)
        .then(() => showLeadsToast('Success', 'Webhook URL copied to clipboard!', 'success'))
        .catch(() => showLeadsToast('Error', 'Failed to copy URL', 'error'));
    });
    
    leadsElements.btnCloseLeadModal.addEventListener('click', () => {
      leadsElements.leadDetailModal.classList.add('hidden');
      leadsState.selectedLead = null;
    });
    
    leadsElements.leadDetailModal.addEventListener('click', (e) => {
      if (e.target === leadsElements.leadDetailModal) {
        leadsElements.leadDetailModal.classList.add('hidden');
        leadsState.selectedLead = null;
      }
    });
    
    leadsElements.modalStatusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newStatus = btn.getAttribute('data-status');
        if (leadsState.selectedLead && leadsState.selectedLead.status !== newStatus) {
          updateLeadStatus(leadsState.selectedLead.id, newStatus);
        }
      });
    });
  }

  async function refreshLeadsData() {
    try {
      leadsElements.btnRefreshLeads.classList.add('loading');
      
      const clientParam = encodeURIComponent(leadsState.selectedClient);
      const [statsRes, leadsRes, clientsRes] = await Promise.all([
        fetch(`/api/stats?client=${clientParam}`),
        fetch(`/api/leads?client=${clientParam}`),
        fetch('/api/clients')
      ]);
      
      leadsState.stats = await statsRes.json();
      leadsState.leads = await leadsRes.json();
      leadsState.clients = await clientsRes.json();
      
      updateClientDropdown();
      updateLeadsMetrics();
      renderLeadsTable();
      renderLeadsCharts();
      
      leadsElements.btnRefreshLeads.classList.remove('loading');
    } catch (error) {
      console.error('Error syncing database:', error);
      leadsElements.btnRefreshLeads.classList.remove('loading');
      showLeadsToast('Sync Failed', 'Could not sync database with server.', 'error');
    }
  }

  function updateClientDropdown() {
    const currentVal = leadsState.selectedClient;
    leadsElements.clientSelector.innerHTML = '<option value="All">All Clients</option>';
    
    leadsState.clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client;
      option.textContent = client;
      if (client === currentVal) {
        option.selected = true;
      }
      leadsElements.clientSelector.appendChild(option);
    });
  }

  function updateLeadsMetrics() {
    leadsElements.metricTotal.textContent = leadsState.stats.total || 0;
    leadsElements.metricNew.textContent = leadsState.stats.byStatus ? leadsState.stats.byStatus.New : 0;
    leadsElements.metricQualified.textContent = leadsState.stats.byStatus ? leadsState.stats.byStatus.Qualified : 0;
    leadsElements.metricConversion.textContent = `${leadsState.stats.conversionRate || 0}%`;
  }

  function renderLeadsTable() {
    leadsElements.leadsTableBody.innerHTML = '';
    
    const searchQuery = leadsElements.searchInput.value.toLowerCase().trim();
    const statusVal = leadsElements.statusFilter.value;
    
    const filtered = leadsState.leads.filter(lead => {
      const matchesSearch = 
        lead.name.toLowerCase().includes(searchQuery) ||
        (lead.email && lead.email.toLowerCase().includes(searchQuery)) ||
        (lead.phone && lead.phone.toLowerCase().includes(searchQuery)) ||
        (lead.campaign_name && lead.campaign_name.toLowerCase().includes(searchQuery));
        
      const matchesStatus = statusVal === 'All' || lead.status === statusVal;
      return matchesSearch && matchesStatus;
    });
    
    if (filtered.length === 0) {
      leadsElements.leadsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No matching leads found.
          </td>
        </tr>
      `;
      return;
    }
    filtered.forEach(lead => {
      let iconClass = 'globe';
      const platLower = lead.platform.toLowerCase();
      if (platLower.includes('facebook')) {
        iconClass = 'facebook';
      } else if (platLower.includes('instagram')) {
        iconClass = 'instagram';
      } else if (platLower.includes('google')) {
        iconClass = 'google';
      } else if (platLower.includes('linkedin')) {
        iconClass = 'linkedin-in';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="lead-name-primary">${escapeHtml(lead.name)}</div>
          <div class="lead-email-secondary">${escapeHtml(lead.email || 'N/A')}</div>
        </td>
        <td>${escapeHtml(lead.campaign_name)}</td>
        <td>
          <span class="platform-tag" style="font-size:0.75rem; color:var(--text-muted); display:inline-flex; align-items:center; gap:4px;">
            <i class="fa-brands fa-${iconClass}"></i> ${lead.platform}
          </span>
        </td>
        <td style="color:var(--text-muted); font-size:0.8rem;">${formatLeadsDate(lead.created_at)}</td>
        <td>
          <span class="status-tag ${lead.status.toLowerCase()}">${lead.status}</span>
        </td>
      `;
      tr.addEventListener('click', () => openLeadModal(lead));
      leadsElements.leadsTableBody.appendChild(tr);
    });
  }

  function openLeadModal(lead) {
    leadsState.selectedLead = lead;
    
    leadsElements.modalLeadId.textContent = lead.id;
    leadsElements.modalLeadName.textContent = lead.name;
    leadsElements.modalLeadEmail.textContent = lead.email || 'N/A';
    leadsElements.modalLeadPhone.textContent = lead.phone || 'N/A';
    leadsElements.modalLeadCampaign.textContent = lead.campaign_name;
    leadsElements.modalLeadPlatform.textContent = lead.platform;
    leadsElements.modalLeadClient.textContent = lead.client_name || 'Sanna Innovations';
    leadsElements.modalLeadDate.textContent = formatLeadsDate(lead.created_at);
    
    leadsElements.modalStatusBtns.forEach(btn => {
      const btnStatus = btn.getAttribute('data-status');
      if (btnStatus === lead.status) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    leadsElements.leadDetailModal.classList.remove('hidden');
  }

  async function updateLeadStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        const updatedLead = await res.json();
        showLeadsToast('Status Updated', `Prospect "${updatedLead.name}" marked as ${newStatus}.`, 'success');
        
        // Sync active button selection in modal
        leadsElements.modalStatusBtns.forEach(btn => {
          const btnStatus = btn.getAttribute('data-status');
          if (btnStatus === newStatus) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        
        leadsState.selectedLead = updatedLead;
        await refreshLeadsData();
      } else {
        showLeadsToast('Update Failed', 'Server rejected status update.', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showLeadsToast('Network Error', 'Could not save status change.', 'error');
    }
  }

  async function triggerTestWebhook() {
    try {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (res.ok) {
        showLeadsToast('Lead Ingested', `New lead "${data.lead.name}" captured!`, 'success');
        await refreshLeadsData();
      } else {
        showLeadsToast('Ingestion Error', data.error || 'Failed to trigger lead', 'error');
      }
    } catch (error) {
      console.error('Error triggering lead:', error);
      showLeadsToast('Network Error', 'Could not connect to server webhook.', 'error');
    }
  }

  function renderLeadsCharts() {
    // 1. Leads by Status doughnut
    const statusLabels = ['New', 'Contacted', 'Qualified', 'Lost'];
    const statusCounts = statusLabels.map(s => leadsState.stats.byStatus ? leadsState.stats.byStatus[s] || 0 : 0);
    
    const ctxStatus = leadsElements.statusChart.getContext('2d');
    if (leadsState.charts.status) {
      leadsState.charts.status.destroy();
    }
    
    leadsState.charts.status = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusCounts,
          backgroundColor: ['#38bdf8', '#fb923c', '#34d399', '#f87171'],
          borderWidth: 2,
          borderColor: '#111827'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#9ca3af',
              font: { family: 'Outfit', size: 11 }
            }
          }
        },
        cutout: '65%'
      }
    });

    // 2. Campaign horizontal bar chart
    const campaignData = leadsState.stats.byCampaign || [];
    const campaignLabels = campaignData.map(c => c.campaign_name.length > 18 ? c.campaign_name.substring(0, 15) + '...' : c.campaign_name);
    const campaignCounts = campaignData.map(c => c.count);

    const ctxCampaign = leadsElements.campaignChart.getContext('2d');
    if (leadsState.charts.campaign) {
      leadsState.charts.campaign.destroy();
    }

    leadsState.charts.campaign = new Chart(ctxCampaign, {
      type: 'bar',
      data: {
        labels: campaignLabels.length > 0 ? campaignLabels : ['No Campaign Data'],
        datasets: [{
          label: 'Leads Count',
          data: campaignCounts.length > 0 ? campaignCounts : [0],
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          hoverBackgroundColor: '#3b82f6',
          borderRadius: 6,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#6b7280', precision: 0 }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#9ca3af' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  function formatLeadsDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('en-US', options);
  }

  function showLeadsToast(title, message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'success' : ''}`;
    toast.innerHTML = `
      <div class="toast-msg">
        <h5>${escapeHtml(title)}</h5>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
    leadsElements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Initialize Webhook URLs and handlers
  const origin = window.location.origin;
  leadsElements.webhookUrlDisplay.textContent = `${origin}/api/webhooks/leads`;
  
  setupTabNavigation();
  setupLeadsEventListeners();
});
