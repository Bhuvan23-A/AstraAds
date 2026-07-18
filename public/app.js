/**
 * AstraAds - Client-Side Controller (ES Module)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Onboarding Form Elements
  const onboardingForm = document.getElementById('onboarding-form');
  const submitBtn = document.getElementById('submit-btn');
  const primaryGoalSelect = document.getElementById('primaryGoal');
  const leadFormConfig = document.getElementById('lead-form-config');

  // Dashboard Structure Elements
  const reviewSection = document.getElementById('review-section');
  const placeholderDiv = document.getElementById('dashboard-placeholder');
  const dashboardContent = document.getElementById('dashboard-content');
  const campaignTitle = document.getElementById('campaign-title');
  const campaignStatus = document.getElementById('campaign-status');
  
  // Dashboard Cards Elements
  const dailyBudgetInput = document.getElementById('daily-budget-input');
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
  const mockSocialImage = document.getElementById('mock-social-image');

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

  // Cropper elements
  const imageCropModal = document.getElementById('image-crop-modal');
  const imageToCrop = document.getElementById('image-to-crop');
  const btnCloseCropModal = document.getElementById('btn-close-crop-modal');
  const btnCancelCrop = document.getElementById('btn-cancel-crop');
  const btnSaveCrop = document.getElementById('btn-save-crop');
  const ratioLandscape = document.getElementById('ratio-landscape');
  const ratioSquare = document.getElementById('ratio-square');
  const ratioFree = document.getElementById('ratio-free');
  let cropper = null;

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

  // Toggle Lead Form Config visibility
  primaryGoalSelect.addEventListener('change', (e) => {
    if (e.target.value === 'Lead Generation') {
      leadFormConfig.classList.remove('hidden');
    } else {
      leadFormConfig.classList.add('hidden');
    }
  });

  // Lead Form Builder Modal Configuration State
  let leadQuestionsConfig = [
    { type: 'FULL_NAME', key: 'full_name' },
    { type: 'EMAIL', key: 'email' },
    { type: 'PHONE', key: 'phone_number' }
  ];

  const btnConfigureLeadForm = document.getElementById('btn-configure-lead-form');
  const leadFormSummary = document.getElementById('lead-form-summary');
  const leadFormBuilderModal = document.getElementById('lead-form-builder-modal');
  const btnCloseLeadFormModal = document.getElementById('btn-close-lead-form-modal');
  const btnCancelLeadFormModal = document.getElementById('btn-cancel-lead-form-modal');
  const btnSaveLeadFormModal = document.getElementById('btn-save-lead-form-modal');
  const modalBtnAddQuestion = document.getElementById('modal-btn-add-question');
  const modalCustomQuestionsList = document.getElementById('modal-custom-questions-list');

  // Open Modal
  btnConfigureLeadForm.addEventListener('click', () => {
    // 1. Populate checkboxes
    const checkboxes = leadFormBuilderModal.querySelectorAll('input[name="modalLeadFields"]');
    checkboxes.forEach(cb => {
      cb.checked = leadQuestionsConfig.some(q => q.type === cb.value);
    });

    // 2. Populate custom questions
    modalCustomQuestionsList.innerHTML = '';
    const customQs = leadQuestionsConfig.filter(q => q.type === 'CUSTOM');
    customQs.forEach((q, index) => {
      addCustomQuestionRow(q.label, q.options ? 'MULTIPLE_CHOICE' : 'TEXT', q.options);
    });

    leadFormBuilderModal.classList.remove('hidden');
  });

  // Close Modal (Cancel / Close)
  const closeLeadFormModal = () => {
    leadFormBuilderModal.classList.add('hidden');
  };
  btnCloseLeadFormModal.addEventListener('click', closeLeadFormModal);
  btnCancelLeadFormModal.addEventListener('click', closeLeadFormModal);

  // Helper to add a custom question row inside the modal
  function addCustomQuestionRow(label = '', type = 'TEXT', options = null) {
    const row = document.createElement('div');
    row.className = 'custom-question-row';
    row.style = 'display: flex; flex-direction: column; gap: 8px; background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155; margin-top: 10px;';
    
    const optionsCsv = options ? options.map(o => o.value).join(', ') : '';
    const isMc = type === 'MULTIPLE_CHOICE';

    row.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center; width: 100%;">
        <input type="text" placeholder="Question text (e.g. When can we call?)" class="custom-q-label" style="flex: 3; padding: 8px 12px; background: #1e293b; border: 1px solid #334155; color: white; border-radius: 6px; font-size: 0.85rem;" value="${escapeHtml(label)}" required>
        <select class="custom-q-type" style="flex: 1.5; padding: 8px 12px; background: #1e293b; border: 1px solid #334155; color: white; border-radius: 6px; font-size: 0.85rem; min-width: 140px; color-scheme: dark;">
          <option value="TEXT" ${!isMc ? 'selected' : ''}>Short Answer</option>
          <option value="MULTIPLE_CHOICE" ${isMc ? 'selected' : ''}>Multiple Choice</option>
        </select>
        <button type="button" class="btn-delete-q" style="background: #ef4444; border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; height: 38px; flex-shrink: 0;">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <div class="options-container ${!isMc ? 'hidden' : ''}" style="display: flex; flex-direction: column; gap: 6px; padding-left: 10px; border-left: 2px solid #3b82f6; margin-top: 5px;">
        <div style="font-size: 0.75rem; color: #94a3b8;">Enter dropdown options (comma-separated):</div>
        <input type="text" placeholder="e.g. Morning, Afternoon, Evening" class="custom-q-options" style="padding: 8px 12px; background: #1e293b; border: 1px solid #334155; color: white; border-radius: 6px; font-size: 0.85rem; width: 100%;" value="${escapeHtml(optionsCsv)}">
      </div>
    `;

    // Toggle options field
    const select = row.querySelector('.custom-q-type');
    const optionsContainer = row.querySelector('.options-container');
    select.addEventListener('change', (e) => {
      if (e.target.value === 'MULTIPLE_CHOICE') {
        optionsContainer.classList.remove('hidden');
      } else {
        optionsContainer.classList.add('hidden');
      }
    });

    // Delete row
    const deleteBtn = row.querySelector('.btn-delete-q');
    deleteBtn.addEventListener('click', () => {
      row.remove();
    });

    modalCustomQuestionsList.appendChild(row);
  }

  // Add Question Button Click
  modalBtnAddQuestion.addEventListener('click', () => {
    addCustomQuestionRow();
  });

  // Save Settings
  btnSaveLeadFormModal.addEventListener('click', () => {
    // 1. Gather Standard Fields
    const standardFields = Array.from(leadFormBuilderModal.querySelectorAll('input[name="modalLeadFields"]:checked')).map(el => el.value);
    const newConfig = standardFields.map(field => {
      let key = field.toLowerCase();
      if (field === 'PHONE') key = 'phone_number';
      return { type: field, key: key };
    });

    // 2. Gather Custom Questions
    const customRows = modalCustomQuestionsList.querySelectorAll('.custom-question-row');
    let hasEmptyLabel = false;

    customRows.forEach((row, index) => {
      const label = row.querySelector('.custom-q-label')?.value?.trim();
      const type = row.querySelector('.custom-q-type')?.value;
      if (!label) {
        hasEmptyLabel = true;
        return;
      }

      const qObj = {
        type: 'CUSTOM',
        key: `custom_q_${index + 1}`,
        label: label
      };

      if (type === 'MULTIPLE_CHOICE') {
        const optionsRaw = row.querySelector('.custom-q-options')?.value;
        const optionsList = optionsRaw ? optionsRaw.split(',').map(o => o.trim()).filter(Boolean) : [];
        if (optionsList.length > 0) {
          qObj.options = optionsList.map((opt, optIndex) => ({
            key: `opt_${optIndex + 1}`,
            value: opt
          }));
        } else {
          // If multiple choice options are empty, fallback to Short Answer
          qObj.type = 'CUSTOM';
        }
      }
      newConfig.push(qObj);
    });

    if (hasEmptyLabel) {
      alert('Please fill out the question text for all custom questions.');
      return;
    }

    if (newConfig.length === 0) {
      alert('Please select or add at least one question for your form.');
      return;
    }

    leadQuestionsConfig = newConfig;
    leadFormSummary.style.display = 'flex';
    closeLeadFormModal();
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

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
      websiteUrl: formData.get('websiteUrl') || '',
      platforms: platforms,
      leadQuestions: leadQuestionsConfig
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
        const url = event.target.result;
        
        // Show crop modal
        imageToCrop.src = url;
        imageCropModal.classList.remove('hidden');
        
        // Initialize cropper
        if (cropper) {
          cropper.destroy();
        }
        
        // Reset active style on ratio buttons
        ratioLandscape.style.background = '#3182ce';
        ratioLandscape.style.color = '#fff';
        ratioSquare.style.background = 'transparent';
        ratioSquare.style.color = 'inherit';
        ratioFree.style.background = 'transparent';
        ratioFree.style.color = 'inherit';
        
        // Initialize Cropper with Landscape (16:9) aspect ratio by default
        cropper = new Cropper(imageToCrop, {
          aspectRatio: 16 / 9,
          viewMode: 2,
          autoCropArea: 1,
          responsive: true,
          restore: false,
          checkCrossOrigin: false
        });
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
    const adImageStatus = document.getElementById('ad-image-status');
    if (adImageStatus) adImageStatus.textContent = 'Using AI Generated Image';
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
       client_name: lastSubmittedParams?.businessName,
       primaryGoal: lastSubmittedParams?.primaryGoal,
       launch_status: document.getElementById('launch-status')?.value || 'PAUSED',
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

      const receipt = await response.json().catch(() => ({}));

      if (!response.ok || receipt.success === false) {
        const logLines = Array.isArray(receipt.deployment_log)
          ? receipt.deployment_log
              .filter(entry => entry.status === 'error' || entry.status === 'warning')
              .map(entry => `${entry.step}: ${entry.message}${entry.details ? ` (${entry.details})` : ''}`)
          : [];
        const detailMessage = receipt.error || receipt.details || 'Launch network response was not successful';
        throw new Error([detailMessage, ...logLines].filter(Boolean).join('\n'));
      }

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
      alert(`Failed to launch campaign:\n\n${err.message}`);
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
    if (dailyBudgetInput) {
      dailyBudgetInput.value = typeof dailyBudget === 'number' ? Math.round(dailyBudget) : parseFloat(dailyBudget) || 100;
    }
    budgetStrategyEl.textContent = campaign.budget_allocation?.strategy || 'N/A';

    keywordsContainer.innerHTML = '';
    const keywords = campaign.targeting?.keywords || [];
    keywords.forEach((keyword, idx) => {
      const keywordBadge = document.createElement('span');
      keywordBadge.className = 'tag';
      keywordBadge.innerHTML = `<i class="fa-solid fa-tag"></i> ${escapeHtml(keyword)} <span class="delete-tag" data-type="keyword" data-index="${idx}" style="margin-left: 6px; cursor: pointer; color: #a0aec0; font-weight: bold;">&times;</span>`;
      keywordsContainer.appendChild(keywordBadge);
    });

    interestsContainer.innerHTML = '';
    const interests = campaign.targeting?.audience_interests || [];
    interests.forEach((interest, idx) => {
      const interestBadge = document.createElement('span');
      interestBadge.className = 'tag tag-interest';
      interestBadge.innerHTML = `<i class="fa-solid fa-user-tag"></i> ${escapeHtml(interest)} <span class="delete-tag" data-type="interest" data-index="${idx}" style="margin-left: 6px; cursor: pointer; color: #a0aec0; font-weight: bold;">&times;</span>`;
      interestsContainer.appendChild(interestBadge);
    });

    headlinesList.innerHTML = '';
    const headlines = campaign.ad_creative?.headlines || [];
    headlines.forEach((headline, index) => {
      const charCount = headline.length;
      const isValid = charCount <= 30;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'validation-item';
      itemDiv.style.flexDirection = 'column';
      itemDiv.style.alignItems = 'stretch';
      itemDiv.style.gap = '8px';
      
      itemDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <strong>Headline H${index + 1}:</strong>
          <div class="validation-meta">
            <span class="char-counter char-counter-h${index} ${isValid ? 'counter-valid' : 'counter-invalid'}">
              ${charCount}/30
            </span>
            <i class="fa-solid status-icon-h${index} ${isValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}" style="color: ${isValid ? '#10b981' : '#ef4444'}"></i>
          </div>
        </div>
        <input type="text" class="creative-input headline-edit-input" data-index="${index}" value="${escapeHtml(headline)}" style="width: 100%; padding: 8px 12px; background: #2d3748; border: 1px solid #4a5568; border-radius: 6px; color: #fff; font-size: 0.9rem; outline: none; border-bottom: 2px solid #3182ce;">
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
      itemDiv.style.flexDirection = 'column';
      itemDiv.style.alignItems = 'stretch';
      itemDiv.style.gap = '8px';

      itemDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <strong>Description D${index + 1}:</strong>
          <div class="validation-meta">
            <span class="char-counter char-counter-d${index} ${isValid ? 'counter-valid' : 'counter-invalid'}">
              ${charCount}/90
            </span>
            <i class="fa-solid status-icon-d${index} ${isValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}" style="color: ${isValid ? '#10b981' : '#ef4444'}"></i>
          </div>
        </div>
        <textarea class="creative-input desc-edit-input" data-index="${index}" style="width: 100%; min-height: 50px; padding: 8px 12px; background: #2d3748; border: 1px solid #4a5568; border-radius: 6px; color: #fff; font-size: 0.9rem; outline: none; border-bottom: 2px solid #3182ce; resize: vertical;">${escapeHtml(desc)}</textarea>
      `;
      descriptionsList.appendChild(itemDiv);
    });

    socialCaptionList.innerHTML = '';
    const primaryText = campaign.ad_creative?.primary_text || '';
    const textLength = primaryText.length;
    const isTextValid = textLength <= 125;

    const captionDiv = document.createElement('div');
    captionDiv.className = 'validation-item';
    captionDiv.style.flexDirection = 'column';
    captionDiv.style.alignItems = 'stretch';
    captionDiv.style.gap = '8px';

    captionDiv.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <strong>Facebook Post Caption:</strong>
        <div class="validation-meta">
          <span class="char-counter char-counter-social ${isTextValid ? 'counter-valid' : 'counter-invalid'}">
            ${textLength}/125
          </span>
          <i class="fa-solid status-icon-social ${isTextValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}" style="color: ${isTextValid ? '#10b981' : '#ef4444'}"></i>
        </div>
      </div>
      <textarea id="social-caption-edit-input" style="width: 100%; min-height: 70px; padding: 8px 12px; background: #2d3748; border: 1px solid #4a5568; border-radius: 6px; color: #fff; font-size: 0.9rem; outline: none; border-bottom: 2px solid #3182ce; resize: vertical;">${escapeHtml(primaryText)}</textarea>
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
    
    // Use the website URL if provided, otherwise generate from business name
    const websiteUrl = lastSubmittedParams?.websiteUrl || '';
    const displayUrl = websiteUrl
      ? websiteUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
      : businessName.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com';
    mockSocialDisplayUrl.textContent = displayUrl;
    mockSocialDisplayUrl.contentEditable = 'true';
    mockSocialDisplayUrl.style.cursor = 'text';
    mockSocialDisplayUrl.title = 'Click to edit URL';

    mockSocialHeadline.textContent = headlines[0] || 'Exclusive Campaign Offer';
    mockSocialCta.textContent = campaign.ad_creative?.call_to_action || 'Learn More';

    // Pre-fill the destination URL input with the website URL
    const destUrlInput = document.getElementById('destination-url-input');
    if (destUrlInput) {
      destUrlInput.value = websiteUrl;
      // Update the CTA link href
      const ctaLink = document.getElementById('mock-social-cta');
      if (ctaLink && websiteUrl) ctaLink.href = websiteUrl;
      // Update the payload
      if (campaign.ad_creative) {
        campaign.ad_creative.destination_url = websiteUrl || 'https://example.com';
      }
    }

    // Clear manual banner elements upon new campaign generation
    if (resetBannerBtn) resetBannerBtn.classList.add('hidden');
    if (manualBannerInput) manualBannerInput.value = '';
    const adImageStatus = document.getElementById('ad-image-status');
    if (adImageStatus) adImageStatus.textContent = 'Using AI Generated Image';
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
      connections['Facebook / Instagram'] = null;
      updateConnectionDOM('Facebook / Instagram', statusMeta, connectBtnMeta, false);
      saveConnectionsToStorage();
      return;
    }
    try {
      const res = await fetch(`/api/clients/connections?client=${encodeURIComponent(clientName)}`);
      const data = await res.json();
      if (data.connected && data.ads_ready) {
        connections['Facebook / Instagram'] = data.ad_account_id || data.page_id;
        const label = data.ad_account_id
          ? `Ads ready: ${data.page_name || clientName}`
          : `Connected via server credentials`;
        updateConnectionDOM('Facebook / Instagram', statusMeta, connectBtnMeta, true, label);
      } else if (data.page_linked) {
        connections['Facebook / Instagram'] = null;
        updateConnectionDOM(
          'Facebook / Instagram',
          statusMeta,
          connectBtnMeta,
          false,
          'Page linked — finish OAuth for ads'
        );
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
      statusEl.textContent = customLabel || 'Disconnected';
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
  
  // --- INLINE EDITING EVENT LISTENERS ---
  
  // Real-time character length checks, mockup syncing, and budget edits
  document.addEventListener('input', (e) => {
    if (!currentCampaignPayload) return;
    
    // Headline edits
    if (e.target.classList.contains('headline-edit-input')) {
      const idx = parseInt(e.target.dataset.index);
      const newVal = e.target.value;
      if (currentCampaignPayload.ad_creative && currentCampaignPayload.ad_creative.headlines) {
        currentCampaignPayload.ad_creative.headlines[idx] = newVal;
        
        // Update character counter
        const len = newVal.length;
        const isValid = len <= 30;
        const counterEl = document.querySelector(`.char-counter-h${idx}`);
        if (counterEl) {
          counterEl.textContent = `${len}/30`;
          counterEl.className = `char-counter char-counter-h${idx} ${isValid ? 'counter-valid' : 'counter-invalid'}`;
        }
        const iconEl = document.querySelector(`.status-icon-h${idx}`);
        if (iconEl) {
          iconEl.className = `fa-solid status-icon-h${idx} ${isValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}`;
          iconEl.style.color = isValid ? '#10b981' : '#ef4444';
        }
        
        // Update mockup titles
        const firstHeadline = currentCampaignPayload.ad_creative.headlines[0] || '';
        const secondHeadline = currentCampaignPayload.ad_creative.headlines[1] ? ` | ${currentCampaignPayload.ad_creative.headlines[1]}` : '';
        const headlineString = `${firstHeadline}${secondHeadline}`;
        if (mockTitleEl) {
          mockTitleEl.textContent = headlineString.length > 60 ? headlineString.substring(0, 57) + '...' : headlineString;
        }
        if (mockSocialHeadline && idx === 0) {
          mockSocialHeadline.textContent = newVal || 'Exclusive Campaign Offer';
        }
      }
    }

    // Description edits
    if (e.target.classList.contains('desc-edit-input')) {
      const idx = parseInt(e.target.dataset.index);
      const newVal = e.target.value;
      if (currentCampaignPayload.ad_creative && currentCampaignPayload.ad_creative.descriptions) {
        currentCampaignPayload.ad_creative.descriptions[idx] = newVal;
        
        // Update character counter
        const len = newVal.length;
        const isValid = len <= 90;
        const counterEl = document.querySelector(`.char-counter-d${idx}`);
        if (counterEl) {
          counterEl.textContent = `${len}/90`;
          counterEl.className = `char-counter char-counter-d${idx} ${isValid ? 'counter-valid' : 'counter-invalid'}`;
        }
        const iconEl = document.querySelector(`.status-icon-d${idx}`);
        if (iconEl) {
          iconEl.className = `fa-solid status-icon-d${idx} ${isValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}`;
          iconEl.style.color = isValid ? '#10b981' : '#ef4444';
        }
        
        // Update mockup description
        if (mockDescEl && idx === 0) {
          mockDescEl.textContent = newVal || 'Your generated ad description text will render dynamically here.';
        }
      }
    }

    // Social post caption edits
    if (e.target.id === 'social-caption-edit-input') {
      const newVal = e.target.value;
      if (currentCampaignPayload.ad_creative) {
        currentCampaignPayload.ad_creative.primary_text = newVal;
        
        // Update character counter
        const len = newVal.length;
        const isValid = len <= 125;
        const counterEl = document.querySelector(`.char-counter-social`);
        if (counterEl) {
          counterEl.textContent = `${len}/125`;
          counterEl.className = `char-counter char-counter-social ${isValid ? 'counter-valid' : 'counter-invalid'}`;
        }
        const iconEl = document.querySelector(`.status-icon-social`);
        if (iconEl) {
          iconEl.className = `fa-solid status-icon-social ${isValid ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}`;
          iconEl.style.color = isValid ? '#10b981' : '#ef4444';
        }
        
        // Update mockup caption
        if (mockSocialCaption) {
          mockSocialCaption.textContent = newVal;
        }
      }
    }

    // Daily budget edits
    if (e.target.id === 'daily-budget-input') {
      if (currentCampaignPayload.budget_allocation) {
        currentCampaignPayload.budget_allocation.daily_budget = parseFloat(e.target.value) || 0;
      }
    }
  });

  // Handle adding/deleting tags and triggering upload from validator
  document.addEventListener('click', (e) => {
    if (!currentCampaignPayload) return;

    // Delete tag button
    if (e.target.classList.contains('delete-tag')) {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      if (type === 'keyword') {
        currentCampaignPayload.targeting.keywords.splice(index, 1);
      } else if (type === 'interest') {
        currentCampaignPayload.targeting.audience_interests.splice(index, 1);
      }
      // Re-render
      renderCampaignToDashboard(currentCampaignPayload, lastSubmittedParams?.businessName || 'Your Business');
    }

    // Add keyword button
    if (e.target.id === 'btn-add-keyword') {
      const input = document.getElementById('add-keyword-input');
      const val = input?.value?.trim();
      if (val) {
        if (!currentCampaignPayload.targeting) currentCampaignPayload.targeting = {};
        if (!currentCampaignPayload.targeting.keywords) currentCampaignPayload.targeting.keywords = [];
        currentCampaignPayload.targeting.keywords.push(val);
        input.value = '';
        renderCampaignToDashboard(currentCampaignPayload, lastSubmittedParams?.businessName || 'Your Business');
      }
    }

    // Add interest button
    if (e.target.id === 'btn-add-interest') {
      const input = document.getElementById('add-interest-input');
      const val = input?.value?.trim();
      if (val) {
        if (!currentCampaignPayload.targeting) currentCampaignPayload.targeting = {};
        if (!currentCampaignPayload.targeting.audience_interests) currentCampaignPayload.targeting.audience_interests = [];
        currentCampaignPayload.targeting.audience_interests.push(val);
        input.value = '';
        renderCampaignToDashboard(currentCampaignPayload, lastSubmittedParams?.businessName || 'Your Business');
      }
    }

    // Trigger file chooser from the creative validator upload button
    if (e.target.id === 'btn-upload-image-creative' || e.target.closest('#btn-upload-image-creative')) {
      manualBannerInput?.click();
    }
  });

  // Support pressing 'Enter' key inside tag inputs to add tag
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'add-keyword-input') {
        e.preventDefault();
        document.getElementById('btn-add-keyword')?.click();
      } else if (e.target.id === 'add-interest-input') {
        e.preventDefault();
        document.getElementById('btn-add-interest')?.click();
      }
    }
  });

  // --- CROPPER MODAL CONTROLLER HANDLERS ---
  
  // Close cropping modal helper
  const closeCropModal = () => {
    imageCropModal.classList.add('hidden');
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    manualBannerInput.value = ''; // clear file input so it can be re-triggered
  };

  if (btnCloseCropModal) btnCloseCropModal.addEventListener('click', closeCropModal);
  if (btnCancelCrop) btnCancelCrop.addEventListener('click', closeCropModal);

  // Aspect ratio selector buttons
  if (ratioLandscape) {
    ratioLandscape.addEventListener('click', () => {
      if (cropper) {
        cropper.setAspectRatio(16 / 9);
        ratioLandscape.style.background = '#3182ce';
        ratioLandscape.style.color = '#fff';
        ratioSquare.style.background = 'transparent';
        ratioSquare.style.color = 'inherit';
        ratioFree.style.background = 'transparent';
        ratioFree.style.color = 'inherit';
      }
    });
  }

  if (ratioSquare) {
    ratioSquare.addEventListener('click', () => {
      if (cropper) {
        cropper.setAspectRatio(1 / 1);
        ratioSquare.style.background = '#3182ce';
        ratioSquare.style.color = '#fff';
        ratioLandscape.style.background = 'transparent';
        ratioLandscape.style.color = 'inherit';
        ratioFree.style.background = 'transparent';
        ratioFree.style.color = 'inherit';
      }
    });
  }

  if (ratioFree) {
    ratioFree.addEventListener('click', () => {
      if (cropper) {
        cropper.setAspectRatio(NaN); // NaN sets free aspect ratio
        ratioFree.style.background = '#3182ce';
        ratioFree.style.color = '#fff';
        ratioLandscape.style.background = 'transparent';
        ratioLandscape.style.color = 'inherit';
        ratioSquare.style.background = 'transparent';
        ratioSquare.style.color = 'inherit';
      }
    });
  }

  // Save/Apply cropped image handler
  if (btnSaveCrop) {
    btnSaveCrop.addEventListener('click', () => {
      if (cropper) {
        // Get cropped image canvas (we set a max size of 1200x1200 to prevent huge payloads)
        const canvas = cropper.getCroppedCanvas({
          maxWidth: 1200,
          maxHeight: 1200,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high'
        });
        
        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9); // high quality JPEG
        
        // Update social mockup image source
        if (mockSocialImage) {
          mockSocialImage.src = croppedBase64;
        }
        
        // Save base64 string to the ad creative payload for Meta Ads API upload
        if (currentCampaignPayload && currentCampaignPayload.ad_creative) {
          currentCampaignPayload.ad_creative.manual_banner_base64 = croppedBase64;
        }
        
        // Show reset button and update upload status text
        if (resetBannerBtn) resetBannerBtn.classList.remove('hidden');
        const adImageStatus = document.getElementById('ad-image-status');
        if (adImageStatus) adImageStatus.textContent = 'Custom Image Cropped';

        closeCropModal();
      }
    });
  }

  // Global function: called when user edits the destination URL input in real time
  window.updateDestinationUrl = (newUrl) => {
    const ctaLink = document.getElementById('mock-social-cta');
    if (ctaLink) ctaLink.href = newUrl || '#';
    
    // Derive a clean display URL from what the user typed
    const cleanUrl = newUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    if (mockSocialDisplayUrl && cleanUrl) {
      mockSocialDisplayUrl.textContent = cleanUrl;
    }

    // Update payload so it sends the right URL when launching
    if (currentCampaignPayload && currentCampaignPayload.ad_creative) {
      currentCampaignPayload.ad_creative.destination_url = newUrl;
    }
  };

  setupTabNavigation();
  setupLeadsEventListeners();
});
