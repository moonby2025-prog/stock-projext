/**
 * Vercel 서버리스 함수 (Node.js)
 * * 기능: 
 * 1. 클라이언트로부터 종목명/코드(symbol, name)를 받습니다.
 * 2. Vercel 환경 변수 GEMINI_API_KEY를 사용하여 Gemini API를 안전하게 호출합니다.
 * 3. Google Search Grounding을 활용하여 실시간 주식/공시 뉴스를 검색하고 요약합니다.
 * 4. 클라이언트에게 JSON 형태로 결과를 반환합니다.
 */

// Gemini API 호출을 위한 기본 설정
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';

// API 키를 환경 변수에서 안전하게 로드합니다.
const API_KEY = process.env.GEMINI_API_KEY;

// API 호출 및 지연(Delay) 처리 함수
async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // 400 Bad Request, 500 Internal Server Error 등 처리
                const errorBody = await response.text();
                throw new Error(`API response failed with status ${response.status}: ${errorBody}`);
            }
            return response;
        } catch (error) {
            if (i === retries - 1) {
                throw error; // 마지막 시도에서 실패하면 오류 반환
            }
            // 지수 백오프 (1초, 2초, 4초 대기)
            const delay = Math.pow(2, i) * 1000;
            console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export default async function handler(req, res) {
    // 1. HTTP 메서드 확인
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Only POST is supported.' });
    }

    // 2. API 키 확인 (환경 변수가 설정되었는지 확인)
    if (!API_KEY) {
        return res.status(500).json({ 
            error: 'Server Misconfiguration: GEMINI_API_KEY environment variable is not set.' 
        });
    }
    
    // ⭐ [수정] Vercel 환경에서 req.body가 JSON 객체인지 확인하고, 
    //            문자열인 경우를 대비하여 파싱하는 로직을 추가했습니다. (안전성 강화)
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            // JSON 파싱 실패 시, 400 에러 반환
            return res.status(400).json({ error: 'Invalid JSON format in request body.' });
        }
    }

    // 3. 클라이언트 요청 본문 파싱 (종목명, 종목코드)
    const { symbol, name } = body;

    if (!symbol || !name) {
        return res.status(400).json({ error: 'Missing required fields: symbol and name.' });
    }

    // 4. Gemini API 요청 구성 (Google Search Grounding 사용)
    const userPrompt = `
        다음 한국 주식 종목의 오늘 날짜 기준 최신 뉴스 및 주요 공시 3~5개를 찾고, 
        각 뉴스에 대해 간결하게 1~2문장으로 핵심을 요약해 줘.
        
        종목명: ${name}
        종목코드: ${symbol}
        
        결과는 반드시 JSON Array 형태로만 반환해야 하며, 다음 스키마를 준수해줘.
        
        [
          {
            "title": "뉴스 제목",
            "summary": "뉴스 핵심 요약 (1~2문장)",
            "source": "출처 사이트 이름 (예: 네이버, 연합뉴스)",
            "category": "뉴스 유형 (예: 일반 뉴스, 주요 공시, 실적 발표 등)"
          }
        ]
        
        출처를 찾을 수 없는 경우 '불명'으로 표시하고, 결과가 없다면 빈 배열 []을 반환해.
    `;
    
    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        tools: [{ "google_search": {} }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "title": { "type": "STRING", description: "뉴스 제목" },
                        "summary": { "type": "STRING", description: "뉴스 핵심 요약 (1~2문장)" },
                        "source": { "type": "STRING", description: "출처 사이트 이름" },
                        "category": { "type": "STRING", description: "뉴스 유형 (예: 일반 뉴스, 주요 공시)" }
                    },
                    propertyOrdering: ["title", "summary", "source", "category"]
                }
            },
        },
    };
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    try {
        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const jsonText = candidate.content.parts[0].text;
            
            // 5. JSON 파싱 및 클라이언트에게 결과 반환
            let parsedJson;
            try {
                // LLM이 반환한 JSON 문자열을 파싱
                parsedJson = JSON.parse(jsonText);
            } catch (e) {
                // 파싱 실패 시, 원본 텍스트를 포함하여 오류 처리
                return res.status(500).json({ 
                    error: "Failed to parse JSON response from Gemini API.", 
                    geminiResponse: jsonText 
                });
            }

            return res.status(200).json({ 
                success: true, 
                data: parsedJson 
            });

        } else {
            // 응답이 없거나 예상치 못한 구조일 경우
            return res.status(500).json({ 
                error: 'Gemini API returned an invalid structure or no content.',
                fullResponse: result
            });
        }
    } catch (error) {
        console.error('Gemini API Call Error:', error);
        return res.status(500).json({ 
            error: 'An internal error occurred while communicating with the Gemini API.',
            details: error.message
        });
    }
}