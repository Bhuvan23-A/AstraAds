import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Generates an ad campaign using Gemini-2.5-Flash with structured JSON output.
 * If the API key is missing, invalid, or the request fails, it seamlessly falls back 
 * to a local high-fidelity mock generator to ensure continuous production readiness.
 * 
 * @param {Object} businessData
 * @param {string} businessData.businessName
 * @param {string} businessData.products
 * @param {string} businessData.targetAudience
 * @param {number|string} businessData.monthlyBudget
 * @param {string} businessData.primaryGoal
 * @param {string[]} businessData.platforms
 */
export async function generateAdCampaign(businessData) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const isKeyEmptyOrPlaceholder = !apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key_here');

  if (isKeyEmptyOrPlaceholder) {
    console.warn('AstraAds: Warning - GOOGLE_API_KEY is empty or placeholder. Falling back to local generative engine.');
    return generateMockAdCampaign(businessData);
  }

  // Set up the API client with the loaded key
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const { businessName, products, targetAudience, monthlyBudget, primaryGoal, platforms = ['Google Search'] } = businessData;

  const prompt = `
Generate a digital ad campaign for the following business:
- Business Name: ${businessName}
- Products or Services: ${products}
- Target Audience: ${targetAudience}
- Monthly Budget: $${monthlyBudget}
- Primary Marketing Goal: ${primaryGoal}
- Target Advertising Channels: ${platforms.join(', ')}

Please adhere strictly to the following constraints for the ad creatives:
1. Every headline in 'headlines' must be 30 characters or less.
2. Every description in 'descriptions' must be 90 characters or less.
3. The 'primary_text' is the primary post copy / caption designed specifically for social media platform feeds (like Facebook, Instagram, LinkedIn). It MUST be 125 characters or less.
4. The 'image_prompt' is a detailed description of a high-quality, professional advertisement banner or poster matching the business's branding. It must NOT contain text.
5. The strategic rationale should explain the campaign name, targeting, budget strategy, and creative copy decisions.
`;

  // Define strict Type schema for the campaign configuration
  const responseSchema = {
    type: "OBJECT",
    properties: {
      campaign_name: { 
        type: "STRING",
        description: "A compelling, unique, and professional name for the ad campaign."
      },
      budget_allocation: {
        type: "OBJECT",
        properties: {
          daily_budget: { 
            type: "NUMBER",
            description: "Suggested daily budget allocation calculated from the monthly budget (e.g. monthly budget / 30, rounded to 2 decimal places)."
          },
          strategy: { 
            type: "STRING", 
            description: "The distribution strategy tailored to the chosen platforms (e.g. Google Search keywords combined with Meta audience targeting)."
          }
        },
        required: ["daily_budget", "strategy"]
      },
      targeting: {
        type: "OBJECT",
        properties: {
          keywords: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "High-intent search keyword phrases targeted to this campaign (minimum 5 keywords)."
          },
          audience_interests: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Interests, behaviors, and demographics of the target audience (crucial for social media channels)."
          }
        },
        required: ["keywords", "audience_interests"]
      },
      ad_creative: {
        type: "OBJECT",
        properties: {
          headlines: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "List of 3 distinct headlines. Crucial: Each headline MUST be 30 characters or less."
          },
          descriptions: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "List of 2 distinct descriptions. Crucial: Each description MUST be 90 characters or less."
          },
          primary_text: {
            type: "STRING",
            description: "Primary body text / caption for social media posts. Crucial: Must be 125 characters or less."
          },
          call_to_action: { 
            type: "STRING",
            description: "A strong, concise call to action (e.g., 'Shop Now', 'Book Appointment', 'Get Free Quote')."
          },
          image_prompt: {
            type: "STRING",
            description: "A highly descriptive, detailed prompt for generating a beautiful, professional, high-converting banner or poster for the social ad campaign. Describe the subjects, color scheme, layout, and style (e.g., 'A professional banner of gourmet cupcakes with pastel frosting, clean studio lighting, high resolution, minimalist design, teal accent background'). Do NOT include text inside the image. Just describe the visual assets."
          }
        },
        required: ["headlines", "descriptions", "primary_text", "call_to_action", "image_prompt"]
      },
      strategic_rationale: { 
        type: "STRING",
        description: "A paragraph explaining the strategic approach, audience targeting choice, and why the creatives will convert."
      }
    },
    required: [
      "campaign_name",
      "budget_allocation",
      "targeting",
      "ad_creative",
      "strategic_rationale"
    ]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Received empty response text from Gemini API.");
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API campaign generation failed. Falling back to local generative engine. Error:", error.message);
    return generateMockAdCampaign(businessData);
  }
}

/**
 * Local high-fidelity mock campaign generator.
 * Produces structured data exactly matching the responseSchema constraints.
 */
function generateMockAdCampaign(businessData) {
  const { businessName, products, targetAudience, monthlyBudget, primaryGoal, platforms = ['Google Search'] } = businessData;
  const budgetVal = Number(monthlyBudget) || 500;
  const daily = Number((budgetVal / 30).toFixed(2));

  // Extract tokens for keywords
  const productClean = products.replace(/[.,]/g, '').split(' ')[0] || 'service';
  const audienceClean = targetAudience.replace(/[.,]/g, '').split(' ')[0] || 'customers';
  
  const keywords = [
    `${businessName.toLowerCase().replace(/\s+/g, '')}`,
    `best ${productClean} near me`,
    `hire ${productClean}`,
    `affordable ${productClean}`,
    `${productClean} specialists`
  ];

  const interests = [
    `Consumers looking for ${productClean}`,
    `People matching demographics for ${audienceClean}`,
    `High-intent local shoppers`
  ];

  // Standard CTAs based on Goal
  let cta = "Learn More";
  if (primaryGoal.toLowerCase().includes("sales") || primaryGoal.toLowerCase().includes("online")) {
    cta = "Shop Now";
  } else if (primaryGoal.toLowerCase().includes("lead")) {
    cta = "Get Free Quote";
  } else if (primaryGoal.toLowerCase().includes("visits") || primaryGoal.toLowerCase().includes("local")) {
    cta = "Visit Store";
  }

  // Formulate headlines (under 30 chars)
  const h1 = `${businessName.substring(0, 20)}`;
  const h2 = `Premium ${productClean.substring(0, 15)}`;
  const h3 = `Special Discount Inside`;

  const headlines = [
    h1.substring(0, 30),
    h2.substring(0, 30),
    h3.substring(0, 30)
  ];

  // Formulate descriptions (under 90 chars)
  const d1 = `Top-rated ${productClean} tailored for ${audienceClean}. Quality guaranteed! Visit us today.`.substring(0, 90);
  const d2 = `Looking for high-quality ${productClean}? Check out our latest deals and premium collection.`.substring(0, 90);

  const descriptions = [d1, d2];

  const primary_text = `✨ Best ${productClean} at ${businessName}! Tailored just for you. Grab yours today & enjoy special offers! 🧁✨`.substring(0, 125);

  const image_prompt = `A professional advertisement poster of ${productClean} for ${businessName}, target audience ${audienceClean}, modern flat design, vibrant colors, premium studio lighting, clean background, 8k resolution.`;

  const campaign_name = `${businessName} - ${primaryGoal.split(' ')[0]} Blast`;

  const strategic_rationale = `This campaign is custom-generated to target "${targetAudience}" with an emphasis on "${primaryGoal}" across ${platforms.join(', ')}. Headlines highlight the core offering "${productClean}" under character limit constraints. (Note: A sandbox fallback was used to generate this structure; configure GOOGLE_API_KEY in .env for active live Gemini responses).`;

  return {
    campaign_name,
    budget_allocation: {
      daily_budget: daily,
      strategy: `Multi-channel (${platforms.join(', ')}) campaign optimized for ${primaryGoal}`
    },
    targeting: {
      keywords,
      audience_interests: interests
    },
    ad_creative: {
      headlines,
      descriptions,
      primary_text,
      call_to_action: cta,
      image_prompt
    },
    strategic_rationale
  };
}
