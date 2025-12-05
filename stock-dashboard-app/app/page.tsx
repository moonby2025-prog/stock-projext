"use client"; // 클라이언트 컴포넌트임을 명시하여 Hooks 사용 가능하게 함

import React, { useState, useEffect, useCallback } from 'react';

// =========================================================================
// 1. Types and Helper Functions (Client-Side)
// =========================================================================

interface StockData {
    rank: number;
    name: string;
    code: string;
    marketCap: string;
    price: number;
    change: number;
    rate: number;
    industry: string;
}

/**
 * 한국 주식 시장의 개장 시간(09:00 ~ 15:30)을 확인합니다.
 */
const isMarketOpen = () => {
    const now = new Date();
    const day = now.getDay(); 
    const hours = now.getHours();
    const minutes = now.getMinutes();

    if (day === 0 || day === 6) {
        return false;
    }

    const openTime = 9 * 60; 
    const closeTime = 15 * 60 + 30; 
    const currentTime = hours * 60 + minutes;

    return currentTime >= openTime && currentTime <= closeTime;
};

/**
 * [Vercel API Route 호출 함수] 서버리스 함수를 호출하여 데이터를 가져옵니다.
 */
const fetchMarketData = async (market: string): Promise<StockData[]> => {
    const API_ENDPOINT = `/api/marketdata?market=${market}`; 
    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) {
            console.error(`HTTP Error: ${response.status}`);
            return [];
        }
        const result = await response.json();
        return result.data || []; 
    } catch (error) {
        console.error("Vercel API Route Call Failed:", error);
        return [];
    }
};

const getHeatmapColor = (rate: number) => {
    const maxRate = 4;
    const intensity = Math.min(Math.abs(rate) / maxRate, 1); 
    if (rate > 0) {
        const lightness = 40 - (intensity * 15); 
        return `hsl(0, 85%, ${lightness}%)`; // Reddish (Hot)
    } else if (rate < 0) {
        const lightness = 40 - (intensity * 15);
        return `hsl(220, 85%, ${lightness}%)`; // Bluish (Cold)
    } else {
        return '#334155'; // Gray/Slate (Neutral)
    }
};

const getNaverBoardUrl = (stockCode: string) => 
    `https://finance.naver.com/item/board.naver?code=${stockCode}`;

const getDartSearchUrl = (stockName: string) => 
    `https://dart.fss.or.kr/dsac001/main.do?#searchText=${encodeURIComponent(stockName)}`;

const generateMockDetails = (stock: StockData) => {
    // 임시 Mock Details 생성
    const per = (Math.random() * 45 + 5).toFixed(2);
    const pbr = (Math.random() * 4.5 + 0.5).toFixed(2);
    const volume = Math.floor(Math.random() * 1000000 + 50000).toLocaleString();

    return {
        per, pbr, volume,
        newsRealtime: [{title: `${stock.name} 실시간 뉴스`, date: '1시간 전'}],
        analystReports: [{title: `${stock.name} 리포트: 목표가 상향`, date: '1달 전'}]
    };
};

// =========================================================================
// 2. Stock Item Component (주식 리스트 개별 항목)
// =========================================================================

const StockItem: React.FC<{ stock: StockData, activeStock: StockData | null, onSelect: (stock: StockData) => void }> = 
    React.memo(({ stock, activeStock, onSelect }) => {
    const isUp = stock.rate > 0;
    const isDown = stock.rate < 0;
    const changeClass = isUp ? 'text-red-400' : (isDown ? 'text-blue-400' : 'text-slate-400');
    const sign = isUp ? '▲' : (isDown ? '▼' : '-');
    const isActive = activeStock && activeStock.code === stock.code;

    return (
        <div 
            id={`stock-${stock.code}`}
            onClick={() => onSelect(stock)}
            className={`
                stock-item flex items-center justify-between p-3 rounded-lg shadow-sm 
                hover:shadow-lg transition duration-150 border border-gray-100 bg-white mb-1
                ${isActive ? 'border-l-4 border-emerald-500 shadow-md bg-slate-700' : 'bg-slate-800 border-slate-700'}
            `}
            style={{ backgroundColor: getHeatmapColor(stock.rate) }}
        >
            <div className="flex items-center space-x-3 min-w-0 flex-grow">
                <span className="text-sm font-bold text-yellow-300 w-6 text-center">{stock.rank}위</span>
                <p className="text-base font-semibold text-white truncate flex-grow">{stock.name}</p>
            </div>
            <div className="text-right min-w-[100px] ml-4">
                <p className={`text-lg font-bold text-white`}>{stock.price.toLocaleString('ko-KR')}</p>
                <p className={`text-sm font-medium ${changeClass}`}>
                    {sign} {Math.abs(stock.rate).toFixed(2)}%
                </p>
            </div>
        </div>
    );
});

StockItem.displayName = 'StockItem';

// =========================================================================
// 3. Main Dashboard Component (메인 컴포넌트)
// =========================================================================

const StockDashboard = () => {
    const [activeData, setActiveData] = useState<StockData[]>([]);
    const [currentMarket, setCurrentMarket] = useState<string>('KOSDAQ');
    const [activeStock, setActiveStock] = useState<StockData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [marketOpen, setMarketOpen] = useState<boolean>(isMarketOpen());

    // ------------------- Data Fetching and Polling -------------------
    const loadMarketData = useCallback(async (market: string) => {
        setIsLoading(true);
        const newData = await fetchMarketData(market);
        
        if (newData.length > 0) {
            
            // ** [최적화 로직] **
            // 새로운 데이터와 기존 데이터를 비교하여 실제 변동이 있는 종목만 업데이트합니다.
            // React가 불필요하게 모든 DOM을 다시 렌더링하는 것을 방지합니다.
            setActiveData(prevData => {
                // 이전 데이터가 없으면 새 데이터를 통째로 반환
                if (prevData.length === 0) return newData;

                const newDataMap = new Map(newData.map(item => [item.code, item]));
                let changed = false;
                
                const updatedData = prevData.map(oldItem => {
                    const newItem = newDataMap.get(oldItem.code);

                    if (newItem && (newItem.price !== oldItem.price || newItem.rate !== oldItem.rate)) {
                        // 가격이나 변동률이 바뀌었으면 업데이트
                        changed = true;
                        return newItem;
                    }
                    return oldItem;
                });
                
                // 새로운 종목이 추가되거나 (길이 다름), 기존 종목이 변동된 경우에만 상태 업데이트
                if (changed || updatedData.length !== newData.length) {
                    return newData; // 전체 목록을 새로고침 (순위 변동 등을 위해)
                }
                
                return prevData; // 상태 변화 없음 -> 렌더링 방지
            });
            // ** [/최적화 로직] **

            // 선택된 종목 정보도 최신 데이터로 업데이트
            const updatedActive = activeStock 
                ? newData.find(s => s.code === activeStock.code) 
                : newData[0];
            setActiveStock(updatedActive || newData[0]);
        } else {
            setActiveData([]);
            setActiveStock(null);
        }

        setMarketOpen(isMarketOpen());
        setIsLoading(false);
    }, [activeStock]); 

    useEffect(() => {
        // 1. 초기 로드
        loadMarketData(currentMarket);

        // 2. 주기적 업데이트 (Polling)
        const intervalId = setInterval(() => {
            // 장이 열려있을 때만 서버 API를 호출하여 데이터 업데이트 (시뮬레이션)
            if (isMarketOpen()) {
                loadMarketData(currentMarket); 
            }
            setMarketOpen(isMarketOpen());
        }, 5000); // 5초마다 업데이트

        return () => clearInterval(intervalId);
    }, [currentMarket, loadMarketData]);


    // ------------------- Handlers -------------------
    const switchMarket = (marketName: string) => {
        if (marketName !== currentMarket) {
            setCurrentMarket(marketName);
            setActiveStock(null); 
        }
    };

    const handleStockSelect = (stock: StockData) => {
        setActiveStock(stock);
    };


    // ------------------- Rendering Helpers -------------------

    const renderStockList = () => {
        if (isLoading && activeData.length === 0) {
            return (
                <div className="flex justify-center items-center h-40">
                    <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="ml-3 text-slate-400">시장 데이터 로딩 중...</p>
                </div>
            );
        }
        if (activeData.length === 0) {
            return <p className="text-center text-red-400 p-4 bg-slate-800 rounded-lg">데이터를 불러오는 데 실패했거나 목록이 비어 있습니다. 서버(API Route)를 확인하세요.</p>;
        }

        // 1. 업종별로 종목을 그룹화
        const groupedStocks: { [key: string]: StockData[] } = activeData.reduce((acc, stock) => {
            const industry = stock.industry || '기타'; 
            if (!acc[industry]) acc[industry] = [];
            acc[industry].push(stock);
            return acc;
        }, {} as { [key: string]: StockData[] });

        // 2. 그룹별 렌더링
        const industryOrder = Object.keys(groupedStocks).sort();

        return industryOrder.map((industryName) => {
            const stocksInIndustry = groupedStocks[industryName];
            
            const headerDiv = (
                <div key={industryName} className="mt-4 mb-2 p-3 flex items-center space-x-2 bg-slate-700 rounded-lg shadow-inner border border-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <h3 className="text-xl font-bold text-slate-100">{industryName} ({stocksInIndustry.length} 종목)</h3>
                </div>
            );

            const stockItems = stocksInIndustry.map(stock => (
                <StockItem 
                    key={stock.code}
                    stock={stock}
                    activeStock={activeStock}
                    onSelect={handleStockSelect}
                />
            ));

            return (
                <React.Fragment key={industryName}>
                    {headerDiv}
                    {stockItems}
                </React.Fragment>
            );
        });
    };

    const renderDetailPanel = () => {
        if (!activeStock) {
            return (
                <div className="p-4 bg-slate-800 rounded-lg shadow-xl border border-slate-700 h-full flex items-center justify-center">
                    <p className="text-center text-slate-400 mt-12">좌측 목록에서 종목을 선택해주세요.</p>
                </div>
            );
        }

        const isUp = activeStock.rate > 0;
        const isDown = activeStock.rate < 0;
        const changeClass = isUp ? 'text-red-400' : (isDown ? 'text-blue-400' : 'text-slate-300');
        const sign = isUp ? '▲' : (isDown ? '▼' : '-');
        
        // Mock Details (News/Report Links)
        const mockDetails = generateMockDetails(activeStock);

        return (
            <div className="p-4 bg-slate-800 rounded-lg shadow-xl border border-slate-700 h-full">
                <h2 className="text-2xl font-bold text-white border-b border-slate-700 pb-2 mb-4">
                    선택 종목 상세 정보
                </h2>

                <h3 className="text-3xl font-extrabold text-white mb-1">{activeStock.name}</h3>
                <p className="text-md text-slate-400 mb-4">종목코드: {activeStock.code} (시총 {activeStock.rank}위, {activeStock.industry})</p>

                {/* Real-time Price Box (Simulated) */}
                <div className="bg-slate-900 p-4 rounded-xl mb-6 shadow-inner border border-slate-700">
                    <h4 className="text-md font-semibold text-emerald-400 mb-2">
                        실시간 주가 (Vercel API 연동)
                    </h4>
                    <p className={`text-sm ${marketOpen ? 'text-emerald-500' : 'text-yellow-500'} font-bold mb-3`}>
                        {marketOpen ? '📢 장 운영 중 (5초마다 업데이트)' : '💤 장 종료 상태 (가격 변동 없음)'}
                    </p>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex flex-col">
                            <span className={`text-4xl font-extrabold font-mono ${changeClass}`} >
                                {activeStock.price.toLocaleString('ko-KR')}
                            </span>
                            <span className="text-sm text-slate-400">현재가 (KRW)</span>
                        </div>
                        <div className="flex flex-col ml-4">
                            <span className={`text-2xl font-bold ${changeClass}`}>
                                {sign} {Math.abs(activeStock.change).toLocaleString('ko-KR')}
                            </span>
                            <span className={`text-base ${changeClass}`}>
                                {activeStock.rate.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Key Stats */}
                <div className="bg-slate-700/50 p-4 rounded-xl mb-6 shadow-inner border border-slate-700">
                    <h4 className="text-md font-semibold text-slate-200 mb-2">핵심 지표 (Mock)</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                         <p><span className="text-slate-400">PER:</span> <span className="font-bold text-white">{mockDetails.per}배</span></p>
                         <p><span className="text-slate-400">PBR:</span> <span className="font-bold text-white">{mockDetails.pbr}배</span></p>
                         <p className="col-span-2"><span className="text-slate-400">거래량:</span> <span className="font-bold text-white">{mockDetails.volume}주</span></p>
                    </div>
                </div>
                
                {/* Related Info Links */}
                <div className="space-y-3">
                    {/* Dart Link */}
                    <a id="dart-link" href={getDartSearchUrl(activeStock.name)} target="_blank" className="flex items-center justify-between p-3 bg-amber-500 text-white rounded-lg shadow-md hover:bg-amber-600 transition duration-300">
                        <p className="text-sm font-bold">📄 전자공시 (DART)</p>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>

                    {/* Naver Board Link */}
                    <a id="naver-board-link-detail" href={getNaverBoardUrl(activeStock.code)} target="_blank" className="flex items-center justify-between p-3 bg-indigo-500 text-white rounded-lg shadow-md hover:bg-indigo-600 transition duration-300">
                        <p className="text-sm font-bold">💬 네이버 종목토론방</p>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                </div>
            </div>
        );
    };

    // ------------------- Main Render -------------------
    return (
        <div className="p-4 md:p-8 bg-slate-900 min-h-screen">
            <div className="max-w-7xl mx-auto bg-slate-900 shadow-2xl rounded-xl p-6 md:p-10 border border-slate-700">
                
                {/* Header */}
                <h1 className="text-3xl font-black text-white mb-2 border-b-2 border-emerald-500 pb-2">
                    🚀 국내 증시 시장 대시보드 (Vercel API 연동)
                </h1>
                
                <p className="text-sm text-yellow-300 mb-6 p-3 bg-slate-700 rounded-lg">
                    ✅ **[Vercel 연동 시뮬레이션]** 주식 데이터는 `/api/marketdata` 엔드포인트를 통해 가져오고 있으며, 5초마다 서버에서 갱신됩니다.
                </p>

                {/* Market Switch Tabs */}
                <div className="flex space-x-4 mb-6 border-b border-slate-700 pb-2">
                    <button 
                        onClick={() => switchMarket('KOSPI')}
                        className={`text-lg font-bold pb-1 transition ${currentMarket === 'KOSPI' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-white'}`}
                    >
                        KOSPI
                    </button>
                    <button 
                        onClick={() => switchMarket('KOSDAQ')}
                        className={`text-lg font-bold pb-1 transition ${currentMarket === 'KOSDAQ' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-white'}`}
                    >
                        KOSDAQ
                    </button>
                </div>
                
                {/* Main Content Grid (List and Detail Side-by-Side) */}
                <div className="lg:grid lg:grid-cols-3 lg:gap-8">
                    
                    {/* 1. Stock List Dashboard */}
                    <div id="stock-list-dashboard" className="lg:col-span-2 space-y-4 pr-4 lg:border-r lg:border-slate-700 mb-6 lg:mb-0">
                        <h2 className="text-xl font-bold text-slate-200">
                            {currentMarket} 종목 목록 (업종별)
                        </h2>
                        {renderStockList()}
                    </div>

                    {/* 2. Stock Detail Panel */}
                    <div id="detail-panel" className="lg:col-span-1">
                        {renderDetailPanel()}
                    </div>
                </div>
                
                <p className="text-center text-slate-500 text-xs mt-8">
                    데이터는 Next.js API Route를 통해 서버에서 가져오며, 5초마다 갱신됩니다.
                </p>
            </div>
        </div>
    );
};

export default StockDashboard;