import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function analyzeFoodImage(base64Image: string) {
  try {
    // Use a supported Gemini model for the current GenAI API version.
    const model = "gemini-2.5-flash";

    const prompt = `
      Analyze this food image and provide a JSON response with the following structure:
      {
        "detected_foods": ["item1", "item2"],
        "calories": number,
        "protein": number,
        "fats": number,
        "carbs": number,
        "description": "brief summary",
        "recommendations": ["healthier alternative 1", "recipe suggestion 1", "nutritional tip 1"]
      }
      Be as accurate as possible with the nutritional estimates. Provide 2-3 practical recommendations for healthier eating or meal ideas based on the detected foods. Return ONLY the JSON.
    `;

    const result = await genAI.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType: "image/jpeg"
            }
          }
        ]
      }]
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean the response text to ensure it's valid JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse AI response");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
}
