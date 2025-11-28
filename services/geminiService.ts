import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, VisualAnalysisResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// System instruction for the speech analyzer
const ANALYZER_SYSTEM_INSTRUCTION = `
You are a world-class English Speech and Debate coach. 
Your task is to analyze the user's speech transcript. 
Evaluate it based on:
1. Logic Structure (Is there a clear Intro, Body, Conclusion? Are transitions smooth?)
2. Argumentation (Are claims supported by evidence? Are there logical fallacies?)
3. Fluency & Rhetoric (Is the language professional? Are rhetorical devices used effectively?)

Provide a strict JSON response.
`;

export const analyzeSpeechContent = async (text: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: text,
      config: {
        systemInstruction: ANALYZER_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Overall score out of 100" },
            logicScore: { type: Type.NUMBER, description: "Logic score out of 100" },
            argumentScore: { type: Type.NUMBER, description: "Argumentation score out of 100" },
            fluencyScore: { type: Type.NUMBER, description: "Fluency score out of 100" },
            summary: { type: Type.STRING, description: "Brief summary of the speech quality" },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of key strengths" },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of areas for improvement" },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable advice for next time" },
            structureAnalysis: {
              type: Type.OBJECT,
              properties: {
                introduction: { type: Type.STRING, description: "Feedback on introduction" },
                body: { type: Type.STRING, description: "Feedback on body paragraphs" },
                conclusion: { type: Type.STRING, description: "Feedback on conclusion" }
              }
            }
          },
          required: ["score", "logicScore", "argumentScore", "fluencyScore", "summary", "strengths", "weaknesses", "suggestions", "structureAnalysis"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from Gemini");
    
    return JSON.parse(resultText) as AnalysisResult;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

export const createDebateChat = (topic: string, side: 'proposition' | 'opposition') => {
  const systemInstruction = `
    You are a competitive debater. 
    The topic is: "${topic}".
    The user is on the side of: ${side}.
    You are on the OPPOSITE side.
    
    Your goal is to:
    1. Rebut the user's arguments logically and sharply.
    2. Ask challenging cross-examination questions.
    3. Keep your responses concise (under 150 words) to maintain a fast-paced debate flow.
    4. Point out logical fallacies if the user makes them.
    5. Maintain a professional but competitive tone.
  `;

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemInstruction,
    }
  });
};

export const generateRandomTopic = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Generate a single, thought-provoking, competitive debate motion/topic suitable for high school or university students. Return ONLY the topic string.",
    });
    return response.text?.trim() || "This house believes that AI will replace teachers.";
  } catch (error) {
    console.error("Failed to generate topic", error);
    return "This house believes that social media has done more harm than good.";
  }
};

export const analyzeBodyLanguage = async (base64Image: string): Promise<VisualAnalysisResult> => {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
      Analyze this image of a speaker. Focus on:
      1. Facial Expression (Confidence, Engagement, Nervousness)
      2. Posture (Open, Closed, Slouching, Upright)
      3. Eye Contact (Looking at camera/audience?)
      
      Provide constructive feedback for a public speaker.
      CRITICAL: Output ALL text in CHINESE (Simplified Chinese).
      Return JSON with keys: expression, posture, eyeContact, suggestions (array of strings).
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    expression: { type: Type.STRING },
                    posture: { type: Type.STRING },
                    eyeContact: { type: Type.STRING },
                    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["expression", "posture", "eyeContact", "suggestions"]
                }
            }
        });

        const resultText = response.text;
        if(!resultText) throw new Error("No response from visual analysis");
        return JSON.parse(resultText) as VisualAnalysisResult;

    } catch (error) {
        console.error("Visual analysis failed", error);
        throw error;
    }
}