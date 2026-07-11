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
      ? `$${dailyBudget.toFixed(2)}` 
      : `$${dailyBudget}`;
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
  function handleConnectClick(platformKey, displayName, statusEl, buttonEl) {
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
  function updateConnectionDOM(platformKey, statusEl, buttonEl) {
    const isConnected = !!connections[platformKey];
    if (isConnected) {
      statusEl.className = 'status-badge status-connected';
      statusEl.textContent = 'Connected';
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
    updateConnectionDOM('Facebook / Instagram', statusMeta, connectBtnMeta);
    updateConnectionDOM('LinkedIn', statusLinkedin, connectBtnLinkedin);
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
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
