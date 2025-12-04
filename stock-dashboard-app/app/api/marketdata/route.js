import { NextResponse } from 'next/server';
import { KOSDAQ_DATA_BASE, KOSPI_DATA_BASE } from './mockData'; // 이 파일도 곧 만들 예정입니다.

// =========================================================================
// 1. 서버 측 Mock Data 생성 및 변동 Logic (실제 API 연동 시 fetch로 대체)
// =========================================================================

/**
 * [서버 측 로직] 한국 주식 시장의 개장 시간(09:00 ~ 15:30)을 확인합니다.
 * @returns {boolean} 시장 개장 여부
 */
function isMarketOpen() {
    const now = new Date();
    const day = now.getDay(); // 0=일요일, 6=토요일
    const hours = now.getHours();
    const minutes = now.getMinutes();

    if (day === 0 || day === 6) {
        return false;
    }

    const openTime = 9 * 60; // 540분
    const closeTime = 15 * 60 + 30; // 930분
    const currentTime = hours * 60 + minutes;

    return currentTime >= openTime && currentTime <= closeTime;
}


/**
 * [서버 측 로직] Mock 데이터를 생성하고 실시간 변동을 시뮬레이션합니다.
 * @param {string} market - 'KOSPI' 또는 'KOSDAQ'
 * @returns {Array<object>} 업데이트된 주식 데이터 배열
 */
function generateServerMockData(market) {
    const baseData = (market === 'KOSPI') ? KOSPI_DATA_BASE : KOSDAQ_DATA_BASE;
    
    if (!isMarketOpen()) {
        console.log(`[Mock Server] Market closed. Returning static data for ${market}.`);
        return baseData;
    }

    return baseData.map(stock => {
        const basePrice = stock.price - stock.change; 

        if (Math.random() > 0.35) { 
            const changePercent = (Math.random() * 0.8 - 0.4); 
            
            let newPrice = basePrice * (1 + changePercent / 100);
            newPrice = Math.round(newPrice / 100) * 100;

            const newChange = newPrice - basePrice;
            const newRate = (newChange / basePrice) * 100;

            return { 
                ...stock, 
                price: newPrice, 
                change: newChange, 
                rate: newRate 
            };
        }
        return stock;
    });
}


// =========================================================================
// 3. Next.js App Router API Handler
// =========================================================================

/**
 * GET 요청 핸들러: /api/marketdata?market=<KOSPI|KOSDAQ>
 */
export async function GET(request) {
    // 1. URL에서 쿼리 파라미터(market) 추출
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');

    if (!market || (market !== 'KOSPI' && market !== 'KOSDAQ')) {
        // 잘못된 요청 파라미터
        return NextResponse.json(
            { message: 'Invalid market parameter.' }, 
            { status: 400 }
        );
    }

    // 2. 데이터 로직 실행 (Mock 데이터 생성)
    try {
        const data = generateServerMockData(market); 
        
        // 3. 클라이언트에게 JSON 형태로 결과 전송
        return NextResponse.json({ market: market, data: data });

    } catch (error) {
        console.error(`API Route Error for ${market}:`, error);
        return NextResponse.json(
            { message: 'Failed to process data on server.', error: error.message }, 
            { status: 500 }
        );
    }
}