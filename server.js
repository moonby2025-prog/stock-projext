// Vercel 서버리스 환경에서 API 요청을 처리하고 CORS 문제를 우회하는 Express 서버

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { quote, search } = require('yahoo-finance2'); // 주가 및 글로벌 지표를 위해 사용

const app = express();
const PORT = 3000;

// Vercel 환경에서는 모든 CORS 허용
app.use(cors());
app.use(express.json());

// --- Naver API Key 로딩 로직 ---
// Vercel 환경 변수 (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)를 우선적으로 사용합니다.
const naverKeys = {
    client_id: process.env.NAVER_CLIENT_ID,
    client_secret: process.env.NAVER_CLIENT_SECRET
};

// 🚨 Vercel 배포 시 환경 변수가 없을 경우 Crash 방지를 위한 로컬 파일 대체 로직
if (!naverKeys.client_id) {
    try {
        // 로컬 환경에서만 naver_keys.js를 시도합니다.
        // 현재 server.js가 api/ 폴더 안에 있으므로, ../naver_keys를 사용하여 루트 폴더의 파일에 접근합니다.
        const localKeys = require('../naver_keys');
        naverKeys.client_id = localKeys.client_id;
        naverKeys.client_secret = localKeys.client_secret;
        console.log('💡 Naver API keys loaded from local file (naver_keys.js).');
    } catch (e) {
        console.warn("⚠️ Naver API keys are missing. Please ensure NAVER_CLIENT_ID and NAVER_CLIENT_SECRET environment variables are set or 'naver_keys.js' exists locally.");
    }
}
// --- 끝: Naver API Key 로딩 ---


// 정적 파일 서빙 (Vercel 환경에서는 vercel.json이 처리하지만, API 요청 경로를 위해 남겨둡니다.)
// Vercel 서버리스 환경에서는 path 모듈 사용이 제한적일 수 있으므로 주석 처리하거나 단순화합니다.
// app.use(express.static(path.join(__dirname, 'public')));


// --- 코스피/코스닥 Top 100 기본 데이터 (시총 순위 Mock) ---
// 실제 시총 및 등락폭은 야후 파이낸스에서 실시간으로 가져와 업데이트됩니다.
const KOSDAQ_TOP50_DATA = [
    { rank: 61, name: '에코프로비엠', code: '247540', marketCap: '24.1조원', industry: '2차전지/배터리' },
    { rank: 62, name: '에코프로', code: '086520', marketCap: '10.5조원', industry: '2차전지/배터리' },
    { rank: 63, name: 'HLB', code: '028300', marketCap: '5.8조원', industry: '바이오/제약' },
    { rank: 64, name: '셀트리온제약', code: '068760', marketCap: '4.5조원', industry: '바이오/제약' },
    { rank: 65, name: '알테오젠', code: '196170', marketCap: '4.2조원', industry: '바이오/제약' },
    { rank: 66, name: '리노공업', code: '058470', marketCap: '4.1조원', industry: '반도체 부품' },
    { rank: 67, name: '엔켐', code: '348370', marketCap: '3.9조원', industry: '2차전지/배터리' },
    { rank: 68, name: '펄어비스', code: '263750', marketCap: '3.5조원', industry: '게임/컨텐츠' },
    { rank: 69, name: 'HPSP', code: '403870', marketCap: '3.2조원', industry: '반도체 장비' },
    { rank: 70, name: 'ISC', code: '095340', marketCap: '3.0조원', industry: '반도체 부품' },
    { rank: 71, name: '휴젤', code: '145020', marketCap: '2.8조원', industry: '미용 의료기기' },
    { rank: 72, name: '주성엔지니어링', code: '036930', marketCap: '2.7조원', industry: '반도체 장비' },
    { rank: 73, name: '위메이드', code: '112040', marketCap: '2.5조원', industry: '게임/컨텐츠' },
    { rank: 74, name: '클래시스', code: '214150', marketCap: '2.4조원', industry: '미용 의료기기' },
    { rank: 75, name: '덴티움', code: '145720', marketCap: '2.3조원', industry: '미용 의료기기' },
    { rank: 76, name: '카카오게임즈', code: '293490', marketCap: '2.2조원', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 77, name: 'JYP Ent.', code: '035900', marketCap: '2.1조원', industry: '미디어/엔터테인먼트' },
    { rank: 78, name: '스튜디오드래곤', code: '253450', marketCap: '2.0조원', industry: '미디어/엔터테인먼트' },
    { rank: 79, name: '천보', code: '278280', marketCap: '1.9조원', industry: '2차전지/배터리' },
    { rank: 80, name: '솔브레인', code: '357780', marketCap: '1.8조원', industry: '반도체 소재' },
    { rank: 81, name: '파마리서치', code: '214450', marketCap: '1.7조원', industry: '미용 의료기기' },
    { rank: 82, name: '동진쎄미켐', code: '005290', marketCap: '1.6조원', industry: '반도체 소재' },
    { rank: 83, name: '케어젠', code: '214370', marketCap: '1.5조원', industry: '바이오/제약' },
    { rank: 84, name: '심텍', code: '222800', marketCap: '1.4조원', industry: '반도체 부품' },
    { rank: 85, name: 'NHN', code: '181710', marketCap: '1.3조원', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 86, name: '고영', code: '098460', marketCap: '1.2조원', industry: '반도체 장비' },
    { rank: 87, name: 'CJ ENM', code: '035760', marketCap: '1.1조원', industry: '미디어/엔터테인먼트' },
    { rank: 88, name: '원텍', code: '336260', marketCap: '1.0조원', industry: '미용 의료기기' },
    { rank: 89, name: '나노신소재', code: '121600', marketCap: '0.9조원', industry: '2차전지/배터리' },
    { rank: 90, name: '더블유씨피', code: '393890', marketCap: '0.8조원', industry: '2차전지/배터리' },
    { rank: 91, name: '아프리카TV', code: '067160', marketCap: '0.75조원', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 92, name: '제룡전기', code: '033100', marketCap: '0.70조원', industry: '기계/장비' },
    { rank: 93, name: '에이치엘비생명과학', code: '067630', marketCap: '0.65조원', industry: '바이오/제약' },
    { rank: 94, name: '피엔티', code: '137400', marketCap: '0.60조원', industry: '2차전지/배터리' },
    { rank: 95, name: '셀트리온헬스케어', code: '091990', marketCap: '0.55조원', industry: '바이오/제약' },
    { rank: 96, name: '넥슨게임즈', code: '225500', marketCap: '0.50조원', industry: '게임/컨텐츠' },
    { rank: 97, name: '레이저쎌', code: '404900', marketCap: '0.45조원', industry: '반도체 장비' },
    { rank: 98, name: '아난티', code: '025980', marketCap: '0.40조원', industry: '레저/여행' },
    { rank: 99, name: '루닛', code: '328130', marketCap: '0.35조원', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 100, name: '제이앤티씨', code: '204270', marketCap: '0.30조원', industry: 'IT 부품' },
    { rank: 101, name: '코미코', code: '183300', marketCap: '0.29조원', industry: '반도체 부품' },
    { rank: 102, name: '레인보우로보틱스', code: '277810', marketCap: '0.28조원', industry: '기계/장비' },
    { rank: 103, name: '바이오니아', code: '064550', marketCap: '0.27조원', industry: '바이오/제약' },
    { rank: 104, name: '이오테크닉스', code: '039030', marketCap: '0.26조원', industry: '반도체 장비' },
    { rank: 105, name: '오스코텍', code: '039200', marketCap: '0.25조원', industry: '바이오/제약' },
    { rank: 106, name: '메디톡스', code: '086900', marketCap: '0.24조원', industry: '미용 의료기기' },
    { rank: 107, name: '네오위즈', code: '095660', marketCap: '0.23조원', industry: '게임/컨텐츠' },
    { rank: 108, name: '다우데이타', code: '032190', marketCap: '0.22조원', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 109, name: 'NHN벅스', code: '104230', marketCap: '0.21조원', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 110, name: '서울바이오시스', code: '092190', marketCap: '0.20조원', industry: '반도체 부품' },
];

const KOSPI_TOP50_MOCK = [
    { rank: 1, name: '삼성전자', code: '005930', marketCap: '480조원', industry: '반도체/전자' },
    { rank: 2, name: 'SK하이닉스', code: '000660', marketCap: '150조원', industry: '반도체/전자' },
    { rank: 3, name: 'LG에너지솔루션', code: '373220', marketCap: '80조원', industry: '2차전지/배터리' },
    { rank: 4, name: '삼성바이오로직스', code: '207940', marketCap: '70조원', industry: '바이오/제약' },
    { rank: 5, name: '현대차', code: '005380', marketCap: '50조원', industry: '자동차' },
    { rank: 6, name: '기아', code: '000270', marketCap: '40조원', industry: '자동차' },
    { rank: 7, name: 'LG화학', code: '051910', marketCap: '35조원', industry: '2차전지/배터리' },
    { rank: 8, name: 'POSCO홀딩스', code: '005490', marketCap: '30조원', industry: '철강' },
    { rank: 9, name: 'KB금융', code: '105560', marketCap: '28조원', industry: '금융' },
    { rank: 10, name: '삼성물산', code: '028260', marketCap: '25조원', industry: '건설/상사' },
    { rank: 11, name: '셀트리온', code: '068270', marketCap: '22조원', industry: '바이오/제약' },
    { rank: 12, name: '신한지주', code: '055550', marketCap: '20조원', industry: '금융' },
    { rank: 13, name: 'NAVER', code: '035420', marketCap: '18조원', industry: 'IT/플랫폼' },
    { rank: 14, name: '카카오', code: '035720', marketCap: '16조원', industry: 'IT/플랫폼' },
    { rank: 15, name: '하나금융지주', code: '086790', marketCap: '15조원', industry: '금융' },
    { rank: 16, name: 'HMM', code: '011200', marketCap: '14조원', industry: '해운' },
    { rank: 17, name: 'KT&G', code: '033780', marketCap: '13조원', industry: '식품' },
    { rank: 18, name: 'LG전자', code: '066570', marketCap: '12조원', industry: '전자제품' },
    { rank: 19, name: '삼성SDI', code: '006400', marketCap: '11조원', industry: '2차전지/배터리' },
    { rank: 20, name: '한국전력', code: '015760', marketCap: '10조원', industry: '유틸리티' },
    { rank: 21, name: '두산에너빌리티', code: '034020', marketCap: '9.5조원', industry: '기계/장비' },
    { rank: 22, name: 'S-Oil', code: '010950', marketCap: '9.0조원', industry: '정유' },
    { rank: 23, name: '롯데케미칼', code: '011170', marketCap: '8.5조원', industry: '화학' },
    { rank: 24, name: '엔씨소프트', code: '036570', marketCap: '8.0조원', industry: '게임' },
    { rank: 25, name: 'SK이노베이션', code: '096770', marketCap: '7.5조원', industry: '정유' },
    { rank: 26, name: '삼성생명', code: '032830', marketCap: '7.0조원', industry: '보험' },
    { rank: 27, name: 'SK텔레콤', code: '017670', marketCap: '6.5조원', industry: '통신' },
    { rank: 28, name: '삼성전기', code: '009150', marketCap: '6.0조원', industry: '전자부품' },
    { rank: 29, name: '현대모비스', code: '012330', marketCap: '5.5조원', industry: '자동차 부품' },
    { rank: 30, name: 'KT', code: '030200', marketCap: '5.0조원', industry: '통신' },
    { rank: 31, name: 'CJ제일제당', code: '097950', marketCap: '4.5조원', industry: '식품' },
    { rank: 32, name: 'LG생활건강', code: '051900', marketCap: '4.0조원', industry: '화장품' },
    { rank: 33, name: 'SKC', code: '011790', marketCap: '3.5조원', industry: '화학' },
    { rank: 34, name: '금호석유', code: '011170', marketCap: '3.0조원', industry: '화학' },
    { rank: 35, name: 'DB손해보험', code: '005830', marketCap: '2.5조원', industry: '보험' },
    { rank: 36, name: 'HD현대', code: '267250', marketCap: '2.0조원', industry: '지주사' },
    { rank: 37, name: '한화솔루션', code: '009830', marketCap: '1.8조원', industry: '화학/태양광' },
    { rank: 38, name: '포스코퓨처엠', code: '005490', marketCap: '1.7조원', industry: '2차전지/배터리' },
    { rank: 39, name: '삼성화재', code: '000810', marketCap: '1.6조원', industry: '보험' },
    { rank: 40, name: 'BGF리테일', code: '282330', marketCap: '1.5조원', industry: '유통' },
    { rank: 41, name: '현대건설', code: '000720', marketCap: '1.4조원', industry: '건설' },
    { rank: 42, name: 'GS리테일', code: '007070', marketCap: '1.3조원', industry: '유통' },
    { rank: 43, name: '오리온', code: '271560', marketCap: '1.2조원', industry: '식품' },
    { rank: 44, name: '미래에셋증권', code: '006800', marketCap: '1.1조원', industry: '증권' },
    { rank: 45, name: 'NH투자증권', code: '005940', marketCap: '1.0조원', industry: '증권' },
    { rank: 46, name: 'HDC현대산업개발', code: '294870', marketCap: '0.9조원', industry: '건설' },
    { rank: 47, name: '금호타이어', code: '073240', marketCap: '0.8조원', industry: '자동차 부품' },
    { rank: 48, name: '대한항공', code: '003490', marketCap: '0.7조원', industry: '항공' },
    { rank: 49, name: '제주항공', code: '089590', marketCap: '0.6조원', industry: '항공' },
    { rank: 50, name: '신세계', code: '004170', marketCap: '0.5조원', industry: '유통' },
];

// 🚨 KOSDAQ Top 50 데이터의 rank를 61부터 시작하도록 수정 (클라이언트의 Mock Data와 일치시킴)
const ALL_STOCK_DATA = [...KOSPI_TOP50_MOCK.map(s => ({...s, market: 'KOSPI'})), ...KOSDAQ_TOP50_DATA.map(s => ({...s, market: 'KOSDAQ'}))];
// --- 끝: 코스피/코스닥 Top 100 기본 데이터 ---


// --- 2. API 라우트 정의 ---

// 2-1. 글로벌 주요 지표 (Yahoo Finance)
app.get('/api/global', async (req, res) => {
    try {
        const symbols = ['^IXIC', '^GSPC', 'KRW=X', 'GC=F']; // Nasdaq, S&P 500, USD/KRW, Gold
        const result = await quote(symbols, { fields: ['regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent', 'symbol', 'displayName'] });
        
        // 결과 데이터를 프론트엔드 형식에 맞게 변환 (변동폭과 변화율 계산)
        const globalSummary = result.map(item => ({
            name: item.displayName || item.symbol,
            value: item.regularMarketPrice,
            change: item.regularMarketChange,
            rate: item.regularMarketChangePercent,
            unit: item.symbol.includes('=X') ? 'KRW' : 'p' // 통화는 KRW, 지수는 p
        }));

        res.json(globalSummary);
    } catch (error) {
        console.error('Yahoo Finance Global Fetch Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch global market data from Yahoo Finance.', details: error.message });
    }
});

// 2-2. 전체 주식 목록 (KOSPI/KOSDAQ Top 100 통합 및 Yahoo Finance 연동)
app.get('/api/stocks', async (req, res) => {
    try {
        // 야후 파이낸스 심볼 목록 생성 (예: ['005930.KS', '247540.KQ', ...])
        const symbols = ALL_STOCK_DATA.map(stock => `${stock.code}.${stock.market === 'KOSPI' ? 'KS' : 'KQ'}`);

        // 야후 파이낸스에서 일괄 데이터 요청
        const yahooData = await quote(symbols);

        // 야후 응답 데이터와 기본 정보를 결합하고 가공
        const finalData = ALL_STOCK_DATA.map(baseItem => {
            const symbol = `${baseItem.code}.${baseItem.market === 'KOSPI' ? 'KS' : 'KQ'}`;
            const yahooItem = yahooData.find(item => item.symbol === symbol);

            if (!yahooItem || !yahooItem.regularMarketPrice) {
                // 데이터가 없는 경우 가상 데이터로 대체
                return {
                    ...baseItem,
                    industry: baseItem.industry + (baseItem.market === 'KOSPI' ? ' (KOSPI)' : ' (KOSDAQ)'),
                    price: 0,
                    change: 0,
                    rate: 0.00,
                    marketCap: baseItem.marketCap || '정보 없음',
                };
            }

            const currentPrice = yahooItem.regularMarketPrice;
            const previousClose = yahooItem.regularMarketPreviousClose || currentPrice;
            const change = currentPrice - previousClose;
            const rate = previousClose ? (change / previousClose) * 100 : 0;
            
            return {
                ...baseItem,
                industry: baseItem.industry + (baseItem.market === 'KOSPI' ? ' (KOSPI)' : ' (KOSDAQ)'),
                price: Math.round(currentPrice), 
                change: Math.round(change),
                rate: rate,
                marketCap: baseItem.marketCap || '데이터 연동 필요',
            };
        });

        // 최종 데이터 반환 (클라이언트의 Mock Data를 대체함)
        res.json(finalData);

    } catch (error) {
        console.error('❌ Yahoo Finance API /api/stocks 호출 실패:', error);
        res.status(500).json({ message: '외부 금융 API에서 데이터를 가져오는 데 실패했습니다.' });
    }
});

// 2-3. 개별 종목 실시간 주가 (Yahoo Finance)
app.get('/api/stock/:code', async (req, res) => {
    const stockCode = req.params.code; 
    
    // 심볼 찾기 (KOSPI/KOSDAQ 접미사 붙이기)
    const stockInfo = ALL_STOCK_DATA.find(s => s.code === stockCode);
    if (!stockInfo) {
        // Mock Data Fallback에 있는 종목도 아니면 404
        return res.status(404).json({ error: `Stock code ${stockCode} not found in base list.` });
    }

    const yahooSymbol = `${stockCode}.${stockInfo.market === 'KOSPI' ? 'KS' : 'KQ'}`;

    try {
        const result = await quote(yahooSymbol, { fields: ['regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent'] });
        
        // 결과가 유효한지 확인
        if (!result || !result.regularMarketPrice) {
            return res.status(404).json({ error: `Stock code ${yahooSymbol} not found or data unavailable.` });
        }
        
        res.json({
            price: Math.round(result.regularMarketPrice),
            change: Math.round(result.regularMarketChange),
            rate: result.regularMarketChangePercent
        });
    } catch (error) {
        console.error(`Yahoo Finance Price Fetch Error for ${yahooSymbol}:`, error.message);
        // 클라이언트가 Mock Data Fallback을 사용하도록 500 오류를 반환
        res.status(500).json({ error: 'Failed to fetch stock price from Yahoo Finance.', details: error.message });
    }
});

// 2-4. 뉴스 및 보고서 (Naver API 연동)
app.get('/api/news-reports', async (req, res) => {
    const stockName = req.query.name;
    
    if (!naverKeys.client_id || !naverKeys.client_secret) {
         // Naver API 키가 등록되지 않았을 경우 500 오류 반환
         return res.status(500).json({ error: 'Naver API 키 설정 필요. Vercel 환경 변수를 확인하세요.' });
    }

    try {
        // Naver News API 호출 (최신 5개)
        const newsResponse = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: {
                query: `${stockName} 주가`, // 종목명 + 주가로 검색
                display: 5,
                sort: 'date' // 최신순
            },
            headers: {
                'X-Naver-Client-Id': naverKeys.client_id,
                'X-Naver-Client-Secret': naverKeys.client_secret
            }
        });
        
        // 가상 보고서 데이터 (실제 보고서 API는 유료 또는 접근 불가)
        const mockReports = [
            { title: `${stockName} '매수' 투자의견 유지`, source: '증권사 A', date: '2025.07.15', link: '#' },
            { title: '목표 주가 상향 조정 보고서', source: '애널리스트 B', date: '2025.07.14', link: '#' },
            { title: 'CAPEX 증가, 성장성 기대', source: '연구원 C', date: '2025.07.12', link: '#' },
        ];

        res.json({
            news: newsResponse.data.items.map(item => ({
                title: item.title.replace(/<b>/g, '').replace(/<\/b>/g, ''),
                link: item.link,
                source: item.publisher,
                pubDate: new Date(item.pubDate).toLocaleDateString('ko-KR'),
            })),
            reports: mockReports // 가상 보고서 데이터
        });

    } catch (error) {
        console.error('Naver API News Fetch Error:', error.response ? error.response.data : error.message);
        // Naver API에서 인증 실패 등의 응답을 받았을 경우
        const errorDetail = error.response ? error.response.data.errorMessage || error.response.statusText : error.message;
        res.status(500).json({ error: 'Failed to fetch news or reports.', details: errorDetail });
    }
});

// 3. 서버 리스닝 (Vercel 환경에서는 무시됨)
// Vercel은 서버리스 함수이므로 이 코드를 사용하지 않지만, 로컬 테스트를 위해 유지합니다.
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Proxy server running at http://localhost:${PORT}`);
    });
}

// Vercel 서버리스 함수로 익스포트
module.exports = app;