import { GoogleGenAI, Type } from "@google/genai";

// Standard model for analysis (Text/Vision)
const ANALYSIS_MODEL = "gemini-3-flash-preview";

/**
 * Creates a fresh AI client. 
 * As per guidelines, we instantiate this right before API calls to ensure
 * we use the most up-to-date API key (especially if a user just selected one).
 */
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || (process as any).env?.API_KEY;
  if (!apiKey) {
    throw new Error("No Gemini API key available. Please check your project settings.");
  }
  return new GoogleGenAI({ apiKey });
}

export interface BrandProfile {
  style: string;
  colorPalette: string[];
  mainCharacters: {
    description: string;
    keyTraits: string[];
  }[];
  landscapeElements: string[];
  typographyStyle: string;
  mood: string;
}

const BRAND_PROFILE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    style: { type: Type.STRING, description: "Detailed description of the artistic style" },
    colorPalette: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of hex codes or color names representating the palette" },
    mainCharacters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          keyTraits: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      },
      description: "Characters found in the image"
    },
    landscapeElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key landscape or background elements" },
    typographyStyle: { type: Type.STRING, description: "Description of the typography used or implied" },
    mood: { type: Type.STRING, description: "The emotional mood of the image" }
  },
  required: ["style", "colorPalette", "mainCharacters", "landscapeElements", "typographyStyle", "mood"]
};

function cleanJsonResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

export async function analyzeImage(base64Images: string[]): Promise<BrandProfile> {
  const ai = getAIClient();
  const imageParts = base64Images.map(img => ({
    inlineData: {
      data: img.split(",")[1] || img,
      mimeType: "image/jpeg"
    }
  }));

  const result = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [{
      parts: [
        {
          text: `Analyze these marketing images to extract a composite core visual identity. 
          Synthesize the artistic style, color palette, main characters (if any), key landscape/environment elements, 
          typography hints, and the overall emotional mood across ALL provided images. 
          This will be used as a master DNA to generate consistent future images.
          IMPORTANT: Return ONLY valid JSON.`
        },
        ...imageParts
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: BRAND_PROFILE_SCHEMA as any,
    }
  });

  const text = cleanJsonResponse(result?.text || "{}");
  try {
    return JSON.parse(text) as BrandProfile;
  } catch (e) {
    console.error("Failed to parse brand profile", e, text);
    return {
      style: "Professional marketing style",
      colorPalette: ["#000000"],
      mainCharacters: [],
      landscapeElements: [],
      typographyStyle: "Modern sans-serif",
      mood: "Professional"
    };
  }
}

export interface ProductKnowledge {
  name: string;
  keyFeatures: string[];
  targetAudience: string;
  toneOfVoice: string;
}

export async function analyzeProductDocument(base64Data: string, mimeType: string): Promise<ProductKnowledge> {
  const ai = getAIClient();
  const result = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [{
      parts: [
        {
          text: `You are a product researcher. Analyze this document and extract:
          1. Product/Service Name
          2. Top 5 Key Features or Benefits
          3. Primary Target Audience
          4. Desired Brand Tone
          Output in JSON format matching the schema.`
        },
        {
          inlineData: {
            data: base64Data.split(",")[1] || base64Data,
            mimeType: mimeType
          }
        }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          keyFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
          targetAudience: { type: Type.STRING },
          toneOfVoice: { type: Type.STRING }
        },
        required: ["name", "keyFeatures", "targetAudience", "toneOfVoice"]
      } as any
    }
  });

  const text = cleanJsonResponse(result?.text || "{}");
  try {
    return JSON.parse(text) as ProductKnowledge;
  } catch (e) {
    console.error("Failed to parse product knowledge", e, text);
    return {
      name: "Product",
      keyFeatures: [],
      targetAudience: "General",
      toneOfVoice: "Professional"
    };
  }
}

export async function generateSuggestedPrompts(profile: BrandProfile, knowledge: ProductKnowledge): Promise<string[]> {
  const ai = getAIClient();
  const result = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [{
      parts: [{
        text: `Generate 4 creative marketing image prompts for the product: "${knowledge.name}".
        Context: ${knowledge.keyFeatures.join(", ")}. 
        Audience: ${knowledge.targetAudience}.
        
        The prompts must be designed to work with this VISUAL STYLE:
        - Mood: ${profile.mood}
        - Style: ${profile.style}
        - Environment: ${profile.landscapeElements.join(", ")}
        
        Make them diverse: one lifestyle, one close-up detail, one cinematic action, and one seasonal/thematic.
        Output as a JSON array of strings.
        IMPORTANT: Return ONLY valid JSON array.`
      }]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      } as any
    }
  });

  try {
    return JSON.parse(cleanJsonResponse(result.text || "[]"));
  } catch (e) {
    console.error("Failed to parse suggestions", e);
    return [];
  }
}

export async function generateMarketingImage(prompt: string, profile: BrandProfile, modelName: string = "gemini-2.5-flash-image"): Promise<string> {
  const ai = getAIClient();
  const fullPrompt = `Create a high-quality marketing image based on this request: "${prompt}".
  STRICTLY FOLLOW THESE STYLE GUIDELINES from the brand profile:
  - Artistic Style: ${profile.style}
  - Color Palette: ${profile.colorPalette.join(", ")}
  - Landscape/Environment Context: ${profile.landscapeElements.join(", ")}
  - Characters (if applicable): ${profile.mainCharacters.map(c => `${c.description} with key traits: ${c.keyTraits.join(", ")}`).join("; ")}
  - Emotional Mood: ${profile.mood}
  - Typography Vibe: ${profile.typographyStyle}
  
  Ensure the composition is professional and suitable for marketing purposes.`;

  try {
    // Imagen series models use generateImages
    if (modelName.startsWith('imagen-')) {
      const response = await ai.models.generateImages({
        model: modelName,
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });

      const base64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64) {
        return `data:image/jpeg;base64,${base64}`;
      }
      throw new Error("No image data returned from Imagen model");
    }

    // Gemini/Nano Banana series models use generateContent
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: fullPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image content returned from AI. The model might have returned text instead.");
  } catch (err: any) {
    console.error(`Generation failed for ${modelName}:`, err);
    if (err.message?.toLowerCase().includes("permission denied")) {
      throw new Error(`Permission Denied: Your API key might not have access to ${modelName}. Upgrade to a custom API key for this model.`);
    }
    throw new Error(`Generation failed: ${err.message || 'Unknown error'}`);
  }
}

export async function editMarketingImage(base64Image: string, editPrompt: string, profile: BrandProfile, modelName: string = "gemini-2.5-flash-image", logoBase64?: string): Promise<string> {
  const ai = getAIClient();
  const fullPrompt = `You are editing this existing image. 
  Modification Request: "${editPrompt}".
  ${logoBase64 ? "CRITICAL: You MUST include the provided logo image into the composition. Place it where it looks most natural or as requested by the user." : ""}
  
  Maintain consistency with the original Brand Profile:
  - Mood: ${profile.mood}
  - Style: ${profile.style}
  
  The output should be a single modified version of the provided image.`;

  try {
    let effectiveModel = modelName;
    if (modelName.startsWith('imagen-')) {
      console.warn(`${modelName} does not support editing. Falling back to gemini-2.5-flash-image for this operation.`);
      effectiveModel = 'gemini-2.5-flash-image';
    }

    const parts: any[] = [
      { text: fullPrompt },
      {
        inlineData: {
          data: base64Image.split(",")[1] || base64Image,
          mimeType: "image/jpeg"
        }
      }
    ];

    if (logoBase64) {
      parts.push({
        inlineData: {
          data: logoBase64.split(",")[1] || logoBase64,
          mimeType: "image/png"
        }
      });
    }

    const response = await ai.models.generateContent({
      model: effectiveModel,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("Failed to edit image: No image data in response.");
  } catch (err: any) {
    console.error("Gemini Image Edit Exception:", err);
    throw new Error(`Edit failed: ${err.message || 'Unknown error'}`);
  }
}

