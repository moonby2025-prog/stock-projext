// 1. 안정적인 공식 라이브러리 가져오기
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // CORS 설정 (프론트엔드에서 호출 허용)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 2. API 키 확인
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Vercel 환경변수에 GEMINI_API_KEY가 없습니다." });
  }

  try {
    // 3. Gemini 모델 설정 (gemini-1.5-flash 모델 사용)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 4. 프론트엔드에서 보낸 질문 받기 (없으면 기본 질문)
    const { prompt } = req.body || {};
    const question = prompt || "최신 주식 시장 트렌드를 한 문장으로 요약해줘.";

    // 5. AI에게 질문 던지기
    const result = await model.generateContent(question);
    const response = await result.response;
    const text = response.text();

    // 6. 성공 결과 반환
    res.status(200).json({ answer: text });

  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "AI 응답 실패", details: error.message });
  }
}