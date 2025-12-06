// Vercel 서버리스 함수: API 키를 안전하게 숨기고 뉴스 검색을 대리 수행합니다.

// @google/genai 라이브러리를 사용하기 위해 import 합니다. (npm install @google/genai 필요)
import { GoogleGenAI } from "@google/genai";

// 1. Vercel 환경 변수에서 API 키를 안전하게 로드합니다. (핵심: 클라이언트에 노출되지 않음)
const apiKey = process.env.GEMINI_API_KEY; 

// API 클라이언트 초기화
const ai = new GoogleGenAI({ apiKey });

// 서버리스 함수 핸들러 (Vercel의 Node.js 함수 규격)
export default async (req, res) => {
    // 클라이언트(브라우저)와 서버 간의 통신을 허용하는 기본 설정
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // HTTP OPTIONS 요청 처리 (웹 표준)
    if (req.method === 'OPTIONS') {
        return res.status(200).send();
    }
    
    // POST 요청만 처리하도록 제한합니다.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        // 2. 클라이언트(브라우저)에서 보낸 종목 정보 (symbol, name)를 받습니다.
        const { symbol, name } = req.body;
        
        if (!symbol || !name) {
            return res.status(400).json({ error: "종목 코드(symbol) 또는 이름(name)이 누락되었습니다." });
        }

        // --- 3. Gemini에게 보낼 프롬프트 작성 ---
        const prompt = `${name} (${symbol}) 주식 관련 최신 뉴스 3건과 주요 공시 1건을 한국어로 찾고, 요청된 JSON 형식에 맞춰 응답해줘.`;
        
        // --- 4. Gemini API 호출 (서버에서 숨겨진 키를 사용) ---
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                // Google Search를 통해 최신 정보를 검색하도록 요청합니다.
                tools: [{ "googleSearch": {} }], 
                // Gemini에게 JSON 형식으로 응답을 요청하는 시스템 지침
                systemInstruction: `
                    당신은 전문 금융 뉴스 분석가입니다. Google 검색 결과에 엄격하게 기반하여 제공된 주식에 대한 최신 뉴스 및 공시를 요약합니다.
                    응답은 반드시 다음 JSON 스키마와 일치하는 단일 JSON 배열 객체로만 구성되어야 합니다. JSON 블록 외부에 어떠한 텍스트, 인사말 또는 마크다운도 포함하지 마십시오.
                    
                    JSON Schema:
                    [
                      {
                        "category": "주요 공시 또는 일반 뉴스", // 예: "주요 공시", "일반 뉴스"
                        "title": "뉴스 또는 공시의 제목",
                        "summary": "내용 요약",
                        "source": "출처 (예: Naver News, DART, Investing)"
                      }
                    ]
                `,
            }
        });
        
        // 5. 응답 텍스트를 정리하고 JSON으로 파싱합니다.
        const text = response.text;
        if (text) {
            let cleanText = text.trim();
            cleanText = cleanText.replace(/^```json\s*|```$/g, '').trim();

            const parsedData = JSON.parse(cleanText);

            // 6. 클라이언트(브라우저)에게 정리된 결과만 전달합니다.
            res.status(200).json({ data: parsedData });

        } else {
            res.status(500).json({ error: "Gemini API가 텍스트 내용을 반환하지 않았습니다." });
        }
        
    } catch (error) {
        console.error("Serverless Function Error:", error);
        res.status(500).json({ error: "서버 프록시를 통한 뉴스 가져오기 실패.", details: error.message });
    }
};