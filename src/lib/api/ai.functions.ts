import { createServerFn } from "@tanstack/react-start";

/**
 * Server-side function to communicate with Gemini AI securely.
 */
export const askGemini = createServerFn({ method: "POST" })
  .validator((data: { prompt: string; userName: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      return { response: "يا هلا بك.. اعتذر منك، مفتاح الذكاء الاصطناعي غير متوفر في إعدادات السيرفر حالياً." };
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `أنت الآن المساعد الذكي الرسمي لعائلة السيف. اسمك "مساعد المجلس".
                - الأسلوب: سعودي نجدي، فخم، ودود جداً.
                - المهمة: الإجابة بذكاء خارق وتفصيل مفيد على أي سؤال.
                - المستخدم: ${data.userName}.
                السؤال: ${data.prompt}`
              }]
            }],
            generationConfig: {
              temperature: 0.9,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      const json = await res.json();
      const response = json.candidates?.[0]?.content?.parts?.[0]?.text;

      return {
        response: response || "يا هلا بك.. حصل ضغط بسيط على السيرفر، جرب تسألني مرة ثانية وبخدمك من عيوني."
      };
    } catch (error) {
      console.error("Gemini Server Error:", error);
      return { response: "يا هلا بك.. يبدو أن هناك مشكلة في الاتصال بسيرفرات الذكاء العالمية. جرب بعد قليل." };
    }
  });
