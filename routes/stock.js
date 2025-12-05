// Express의 Router 객체를 불러옵니다.
const express = require('express');
const router = express.Router();

// 🚨 중요: 실제 환경에서 이 코드를 실행하려면 npm install yahoo-finance2 를 실행해야 합니다.
const yahooFinance = require('yahoo-finance2').default;

// 코스닥 시총 상위 50개 종목 코드 및 기본 정보
const baseStockData = [
    // rank, name, marketCap, industry 는 고정 정보로 사용
    { rank: 1, name: '에코프로비엠', code: '247540', industry: '2차전지/배터리' },
    { rank: 2, name: '에코프로', code: '086520', industry: '2차전지/배터리' },
    { rank: 3, name: 'HLB', code: '028300', industry: '바이오/제약' },
    { rank: 4, name: '셀트리온제약', code: '068760', industry: '바이오/제약' },
    { rank: 5, name: '알테오젠', code: '196170', industry: '바이오/제약' },
    { rank: 6, name: '리노공업', code: '058470', industry: '반도체 부품' },
    { rank: 7, name: '엔켐', code: '348370', industry: '2차전지/배터리' },
    { rank: 8, name: '펄어비스', code: '263750', industry: '게임/컨텐츠' },
    { rank: 9, name: 'HPSP', code: '403870', industry: '반도체 장비' },
    { rank: 10, name: 'ISC', code: '095340', industry: '반도체 부품' },
    { rank: 11, name: '휴젤', code: '145020', industry: '미용 의료기기' },
    { rank: 12, name: '주성엔지니어링', code: '036930', industry: '반도체 장비' },
    { rank: 13, name: '위메이드', code: '112040', industry: '게임/컨텐츠' },
    { rank: 14, name: '클래시스', code: '214150', industry: '미용 의료기기' },
    { rank: 15, name: '덴티움', code: '145720', industry: '미용 의료기기' },
    { rank: 16, name: '카카오게임즈', code: '293490', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 17, name: 'JYP Ent.', code: '035900', industry: '미디어/엔터테인먼트' },
    { rank: 18, name: '스튜디오드래곤', code: '253450', industry: '미디어/엔터테인먼트' },
    { rank: 19, name: '천보', code: '278280', industry: '2차전지/배터리' },
    { rank: 20, name: '솔브레인', code: '357780', industry: '반도체 소재' },
    { rank: 21, name: '파마리서치', code: '214450', industry: '미용 의료기기' },
    { rank: 22, name: '동진쎄미켐', code: '005290', industry: '반도체 소재' },
    { rank: 23, name: '케어젠', code: '214370', industry: '바이오/제약' },
    { rank: 24, name: '심텍', code: '222800', industry: '반도체 부품' },
    { rank: 25, name: 'NHN', code: '181710', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 26, name: '고영', code: '098460', industry: '반도체 장비' },
    { rank: 27, name: 'CJ ENM', code: '035760', industry: '미디어/엔터테인먼트' },
    { rank: 28, name: '원텍', code: '336260', industry: '미용 의료기기' },
    { rank: 29, name: '나노신소재', code: '121600', industry: '2차전지/배터리' },
    { rank: 30, name: '더블유씨피', code: '393890', industry: '2차전지/배터리' },
    { rank: 31, name: '아프리카TV', code: '067160', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 32, name: '제룡전기', code: '033100', industry: '기계/장비' },
    { rank: 33, name: '에이치엘비생명과학', code: '067630', industry: '바이오/제약' },
    { rank: 34, name: '피엔티', code: '137400', industry: '2차전지/배터리' },
    { rank: 35, name: '셀트리온헬스케어', code: '091990', industry: '바이오/제약' },
    { rank: 36, name: '넥슨게임즈', code: '225500', industry: '게임/컨텐츠' },
    { rank: 37, name: '레이저쎌', code: '404900', industry: '반도체 장비' },
    { rank: 38, name: '아난티', code: '025980', industry: '레저/여행' },
    { rank: 39, name: '루닛', code: '328130', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 40, name: '제이앤티씨', code: '204270', industry: 'IT 부품' },
    { rank: 41, name: '코미코', code: '183300', industry: '반도체 부품' },
    { rank: 42, name: '레인보우로보틱스', code: '277810', industry: '기계/장비' },
    { rank: 43, name: '바이오니아', code: '064550', industry: '바이오/제약' },
    { rank: 44, name: '이오테크닉스', code: '039030', industry: '반도체 장비' },
    { rank: 45, name: '오스코텍', code: '039200', industry: '바이오/제약' },
    { rank: 46, name: '메디톡스', code: '086900', industry: '미용 의료기기' },
    { rank: 47, name: '네오위즈', code: '095660', industry: '게임/컨텐츠' },
    { rank: 48, name: '다우데이타', code: '032190', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 49, name: 'NHN벅스', code: '104230', industry: 'IT 소프트웨어/플랫폼' },
    { rank: 50, name: '서울바이오시스', code: '092190', industry: '반도체 부품' },
];

/**
 * GET /top50 요청을 처리하는 라우터
 * 야후 파이낸스에서 데이터를 가져와 가공 후 반환합니다.
 */
router.get('/top50', async (req, res) => {
    try {
        // 1. 야후 파이낸스 심볼 목록 생성 (예: ['247540.KQ', '086520.KQ', ...])
        const symbols = baseStockData.map(stock => `${stock.code}.KQ`);

        // 2. 야후 파이낸스에서 일괄 데이터 요청 (summaryProfile 필드만 요청)
        // 🚨 이 API 호출이 실패할 경우, fetch 오류가 발생할 수 있습니다.
        const yahooData = await yahooFinance.quote(symbols);

        // 3. 야후 응답 데이터와 기본 정보를 결합하고 가공
        const finalData = baseStockData.map(baseItem => {
            const symbol = `${baseItem.code}.KQ`;
            const yahooItem = yahooData.find(item => item.symbol === symbol);

            if (!yahooItem) {
                // 데이터가 없는 경우 (예: 상장폐지 등), 가상 데이터로 대체
                return {
                    ...baseItem,
                    price: 0,
                    change: 0,
                    rate: 0.00,
                    marketCap: '정보 없음',
                };
            }

            const currentPrice = yahooItem.regularMarketPrice || 0;
            const previousClose = yahooItem.regularMarketPreviousClose || currentPrice;
            const change = currentPrice - previousClose;
            const rate = previousClose ? (change / previousClose) * 100 : 0;
            
            // 시가총액 정보는 야후 finance2의 quoteSummary 등 다른 API를 써야 하지만, 여기서는 단순화를 위해 생략합니다.

            return {
                rank: baseItem.rank,
                name: baseItem.name,
                code: baseItem.code,
                industry: baseItem.industry,
                price: Math.round(currentPrice * 100) / 100, // 소수점 처리
                change: Math.round(change * 100) / 100,
                rate: rate,
                // 시총은 야후 데이터가 복잡하므로, 기본 정보를 유지하거나 따로 처리해야 함
                marketCap: baseItem.marketCap || '데이터 연동 필요',
            };
        });

        // 4. 가공된 데이터 반환
        res.json(finalData);

    } catch (error) {
        console.error('❌ 야후 파이낸스 API 호출 실패:', error);
        // 오류 발생 시 클라이언트에게 에러 상태와 메시지 반환
        res.status(500).json({ message: '외부 금융 API에서 데이터를 가져오는 데 실패했습니다.' });
    }
});

module.exports = router;