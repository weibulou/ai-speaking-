import { AnalysisResult, VisualAnalysisResult } from "../types";

// System instruction for the speech analyzer
const ANALYZER_SYSTEM_INSTRUCTION = `
You are a world-class English Speech and Debate coach. 
Your task is to analyze the user's speech transcript. 
Evaluate it based on:
1. Logic Structure (Is there a clear Intro, Body, Conclusion? Are transitions smooth?)
2. Argumentation (Are claims supported by evidence? Are there logical fallacies?)
3. Fluency & Rhetoric (Is the language professional? Are rhetorical devices used effectively?)

Provide a strict JSON response with the following structure:
{
  "score": number,
  "logicScore": number,
  "argumentScore": number,
  "fluencyScore": number,
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "suggestions": string[],
  "structureAnalysis": {
    "introduction": string,
    "body": string,
    "conclusion": string
  }
}
`;

const fetchWithRetry = async (url: string, options: any, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Fetch failed, retrying... (${i + 1}/${retries})`, err);
      await new Promise(res => setTimeout(res, 1000 * (i + 1))); // Exponential backoff
    }
  }
};

export const analyzeSpeechContent = async (text: string): Promise<AnalysisResult> => {
  try {
    return await fetchWithRetry("/api/ai/analyze-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, systemInstruction: ANALYZER_SYSTEM_INSTRUCTION })
    });
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

  const messages: { role: 'user' | 'assistant', content: string }[] = [];

  return {
    sendMessageStream: async function* (text: string) {
      messages.push({ role: 'user', content: text });
      
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, systemInstruction })
      });

      if (!response.ok) throw new Error("Chat failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              fullText += data.text;
              yield { text: () => data.text }; // Keep compatibility with existing code calling .text()
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }
      messages.push({ role: 'assistant', content: fullText });
    }
  };
};

export const generateRandomTopic = async (): Promise<string> => {
  try {
    const data = await fetchWithRetry("/api/ai/generate-topic", { method: "POST" });
    return data.topic || "This house believes that AI will replace teachers.";
  } catch (error) {
    console.error("Failed to generate topic", error);
    return "This house believes that social media has done more harm than good.";
  }
};

export const analyzeBodyLanguage = async (base64Image: string): Promise<VisualAnalysisResult> => {
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
        return await fetchWithRetry("/api/ai/analyze-visual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Image, prompt })
        });
    } catch (error) {
        console.error("Visual analysis failed", error);
        throw error;
    }
}
