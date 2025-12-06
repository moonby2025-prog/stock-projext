import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API 키가 설정되지 않았습니다." });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // ✅ 오늘 만든 키에 맞는 최신 모델로 설정
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const { prompt } = req.body || {};
    const question = prompt || "주식 시장의 현재 주요 트렌드를 한 문장으로 요약해줘.";

    const result = await model.generateContent(question);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ answer: text });

  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "AI 응답 실패", details: error.message });
  }
}