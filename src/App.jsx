import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- [강력한 에러 방어] 전역 에러 및 ResizeObserver 오류 차단 강화 ---
if (typeof window !== 'undefined') {
  // 1. ResizeObserver Monkey Patch
  const OriginalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
    constructor(callback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          if (!Array.isArray(entries) || !entries.length) return;
          try { callback(entries, observer); } catch (e) {}
        });
      });
    }
  };

  // 2. Global Error Handler ('Script error.' 무시)
  const originalOnError = window.onerror;
  window.onerror = function(msg, source, lineno, colno, error) {
    // 외부 스크립트(위젯 등)에서 발생하는 'Script error.' 및 오류 패턴 포괄
    if (typeof msg === 'string' && (msg.includes('Script error') || msg.includes('ResizeObserver') || msg.includes('SecurityError'))) {
      console.warn("Suppressed known security/script error:", msg); // 콘솔 경고로 남기고 무시
      return true; // true를 반환하여 에러 전파 중단
    }
    if (originalOnError) return originalOnError(msg, source, lineno, colno, error);
    return false;
  };

  // 3. Unhandled Promise Rejection Handler
  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    if (event.reason && (
       event.reason === 'Script error.' || 
       (event.reason.message && (event.reason.message.includes('ResizeObserver') || event.reason.message.includes('SecurityError')))
    )) {
      event.preventDefault();
      console.warn("Suppressed known promise rejection:", event.reason);
      return true;
    }
    if (originalOnUnhandledRejection) return originalOnUnhandledRejection(event);
  };
}

// --- 상수 데이터 ---
const DEFAULT_QUICK_LINKS = {
  "🌅 아침 필수 체크 (Morning Routine)": [
    { name: "미국 시장 점검", url: "https://kr.investing.com/portfolio/?portfolioID=OT4%2BZDRrZTFjM2thYTthYg%3D%3D", icon: "fa-list-check", color: "bg-blue-100 text-blue-700" },
    { name: "Finviz (미국 맵)", url: "https://finviz.com/map.ashx", icon: "fa-map", color: "bg-emerald-100 text-emerald-700" },
    { name: "필라델피아 반도체", url: "https://kr.investing.com/indices/phlx-semiconductor", icon: "fa-microchip", color: "bg-teal-100 text-teal-700" },
    { name: "공포 탐욕 지수 (CNN)", url: "https://edition.cnn.com/markets/fear-and-greed", icon: "fa-gauge-high", color: "bg-orange-100 text-orange-700" },
    { name: "크립토 지표 (MVRV)", url: "https://www.bitcoinmagazinepro.com/charts/mvrv-zscore/", icon: "fa-chart-area", color: "bg-amber-100 text-amber-700" },
    { name: "SILVER (은)", url: "https://kr.investing.com/currencies/xag-usd", icon: "fa-coins", color: "bg-slate-100 text-slate-700" },
    { name: "은시세(순수한금)", url: "https://blog.naver.com/wolfkickbox", icon: "fa-blog", color: "bg-yellow-100 text-yellow-700" }
  ],
  "💰 공모주 & 실적 (IPO & Earnings)": [
    { name: "38 커뮤니케이션", url: "http://www.38.co.kr/html/fund/index.htm?gjbcd=1460", icon: "fa-building", color: "bg-purple-100 text-purple-700" },
    { name: "DART (전자공시)", url: "https://dart.fss.or.kr/", icon: "fa-file-signature", color: "bg-yellow-100 text-yellow-700" },
    { name: "KRX 정보시스템", url: "http://data.krx.co.kr/", icon: "fa-database", color: "bg-slate-100 text-slate-700" },
    { name: "KIND (기업공시)", url: "https://kind.krx.co.kr/", icon: "fa-file-invoice", color: "bg-blue-50 text-blue-600" },
    { name: "Seibro (증권포털)", url: "https://seibro.or.kr/", icon: "fa-server", color: "bg-indigo-50 text-indigo-600" },
    // 2. 추가된 항목
    { name: "종목별 외국인 국적분류", url: "https://data.krx.co.kr/contents/MDC/HARD/hardController/MDCHARD053.cmd", icon: "fa-earth-asia", color: "bg-purple-100 text-purple-700" }
  ],
  "📈 국내 시장 심층 (Korea Market)": [
    { name: "네이버 금융", url: "https://finance.naver.com/", icon: "fa-n", color: "bg-green-50 text-green-600" },
    { name: "네이버 금융 뉴스", url: "https://finance.naver.com/news/", icon: "fa-magnifying-glass", color: "bg-blue-100 text-blue-700" },
    { name: "매일경제", url: "https://media.naver.com/press/009/newspaper", icon: "fa-newspaper", color: "bg-red-50 text-red-600" },
    { name: "한국경제", url: "https://media.naver.com/press/015/newspaper", icon: "fa-newspaper", color: "bg-teal-50 text-teal-600" },
    { name: "버틀러 (Butler)", url: "https://www.butler.works/ko/home", icon: "fa-chart-line", color: "bg-purple-50 text-purple-600" },
    { name: "한경 컨센서스", url: "https://markets.hankyung.com/consensus", icon: "fa-book-open", color: "bg-red-50 text-red-600" },
    { name: "SMIC (서울대)", url: "http://snusmic.com/research/", icon: "fa-graduation-cap", color: "bg-slate-200 text-slate-800" },
    // 3. 추가된 항목들
    { name: "FDA승인 실시간영상", url: "https://www.youtube.com/user/USFoodandDrugAdmin", icon: "fa-video", color: "bg-red-100 text-red-700" },
    { name: "주식/부동산 글모음 (모아봐)", url: "http://moabbs.com/blogs/lists", icon: "fa-users", color: "bg-orange-100 text-orange-700" },
    // 요청에 따라 이동된 항목
    { name: "전자도서관/전자잡지", url: "https://lib.ice.go.kr/elib/module/elib/moazine.do?menu_idx=37", icon: "fa-book-open", color: "bg-yellow-100 text-yellow-700" }
  ],
  "🏡 일상 & 부동산 (Daily Life)": [
    { name: "호갱노노", url: "https://hogangnono.com/", icon: "fa-map-pin", color: "bg-red-50 text-red-600" },
    { name: "네이버 부동산", url: "https://land.naver.com/", icon: "fa-building", color: "bg-green-50 text-green-600" },
    { name: "네이버 지도", url: "https://map.naver.com/", icon: "fa-location-dot", color: "bg-blue-50 text-blue-600" },
    { name: "구글 지도", url: "https://maps.google.com/", icon: "fa-location-dot", color: "bg-amber-50 text-amber-600" }
    // "전자도서관/전자잡지" 항목이 '국내 시장 심층'으로 이동됨
  ]
};

const DEFAULT_BLOG_MAP_DATA = {
  "🧬 큐리옥스바이오시스템즈": [
    {name: "한계를 깨는 사람", url: "https://blog.naver.com/unlimitedi"},
    {name: "나는 전설이다", url: "https://blog.naver.com/legendyu"},
    {name: "이공계", url: "https://blog.naver.com/shyny38"},
    {name: "공대생 주접노트", url: "https://blog.naver.com/b_g-duck"}
  ],
  "💊 에스티팜": [
    {name: "오재복", url: "https://blog.naver.com/hym090206"},
    {name: "왠지상쾌한사람", url: "https://blog.naver.com/aphorism86"},
    {name: "Chan", url: "https://blog.naver.com/chany2do"}
  ]
};

// 1. 테슬라(TSLA), 애플(AAPL) 삭제 반영
const DEFAULT_FAVORITE_SYMBOLS = [
  { code: "005930", name: "삼성전자" },
  { code: "005380", name: "현대차" },
  { code: "237690", name: "에스티팜" },
  { code: "445680", name: "큐리옥스" }
];

const EXCHANGE_RATES = {
  'USD': { krw: 1380, name: "미국 달러" },
  'JPY': { krw: 8.90, name: "일본 엔" },
  'CNY': { krw: 190, name: "중국 위안" },
  'EUR': { krw: 1480, name: "유로" },
  'VND': { krw: 0.054, name: "베트남 동" },
  'THB': { krw: 37.5, name: "태국 바트" },
  'PHP': { krw: 23.5, name: "필리핀 페소" },
  'INR': { krw: 16.5, name: "인도 루피" },
  'ARS': { krw: 1.5, name: "아르헨티나 페소" }
};

const TAX_THRESHOLD = 20000000;

// --- 유틸리티 ---
const storage = {
  get: (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } },
  getJSON: (key) => { try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : null; } catch (e) { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) {} },
  remove: (key) => { try { localStorage.removeItem(key); } catch (e) {} }
};

const formatNumber = (num) => num.toLocaleString('ko-KR');

// --- 위젯 컴포넌트 ---
const TradingViewTicker = React.memo(({ theme }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 기존 내용 및 스크립트 제거
    container.innerHTML = '';
    
    // 로딩을 100ms 지연하여 React의 렌더링 사이클 충돌을 방지
    const loadScript = setTimeout(() => {
      if (!containerRef.current) return;
      
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
      script.async = true;
      script.innerHTML = JSON.stringify({
        "symbols": [
          { "proName": "FOREXCOM:SPXUSD", "title": "S&P 500" },
          { "proName": "NASDAQ:QQQ", "title": "나스닥 QQQ" },
          { "proName": "FX_IDC:USDKRW", "title": "원달러 환율" },
          { "proName": "BINANCE:BTCUSDT", "title": "비트코인" },
          { "proName": "OANDA:XAGUSD", "title": "은 현물" },
          { "proName": "NASDAQ:IBB", "title": "바이오텍 ETF" }
        ],
        "showSymbolLogo": true,
        "colorTheme": theme,
        "isTransparent": true,
        "displayMode": "adaptive",
        "locale": "kr",
        "speed": "fast"
      });
      
      container.appendChild(script);
    }, 100);

    // 컴포넌트 언마운트 시 클린업
    return () => {
      clearTimeout(loadScript); // 지연 실행을 취소
      if (container) {
          container.innerHTML = ''; 
      }
    };
  }, [theme]);
  
  // key를 사용하여 테마 변경 시 컴포넌트를 강제 재생성하여 위젯 로딩 충돌 방지
  return <div key={`ticker-${theme}`} className="tradingview-widget-container" ref={containerRef}></div>;
});

const TradingViewHeatmap = React.memo(({ theme, marketSource }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 기존 내용 및 스크립트 제거
    container.innerHTML = '';
    
    // 로딩을 100ms 지연하여 React의 렌더링 사이클 충돌을 방지
    const loadScript = setTimeout(() => {
      if (!containerRef.current) return;

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
      script.async = true;
      script.innerHTML = JSON.stringify({
        "exchanges": [],
        "dataSource": "SPX500",
        "grouping": "sector",
        "blockSize": "market_cap_basic",
        "blockColor": "change",
        "locale": "kr",
        "symbolUrl": "",
        "colorTheme": theme,
        "hasTopBar": false,
        "isTransparent": true,
        "width": "100%",
        "height": "100%"
      });
      
      container.appendChild(script);
    }, 100);

    // 컴포넌트 언마운트 시 클린업
    return () => {
       clearTimeout(loadScript); // 지연 실행을 취소
       if (container) {
          container.innerHTML = ''; 
       }
    };
  }, [theme, marketSource]);
  
  // key를 사용하여 테마/마켓 소스 변경 시 컴포넌트를 강제 재생성하여 위젯 로딩 충돌 방지
  return <div key={`heatmap-${theme}-${marketSource}`} className="tradingview-widget-container" ref={containerRef}></div>;
});

// --- 메인 App 컴포넌트 ---
export default function App() {
  // --- States ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDark, setIsDark] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  
  // Data States
  const [quickLinks, setQuickLinks] = useState(DEFAULT_QUICK_LINKS);
  const [blogMapData, setBlogMapData] = useState(DEFAULT_BLOG_MAP_DATA);
  const [favoriteSymbols, setFavoriteSymbols] = useState(DEFAULT_FAVORITE_SYMBOLS);
  const [linkMode, setLinkMode] = useState('investment'); // investment, blogs, daily
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Market Status
  const [marketStatus, setMarketStatus] = useState({ text: '확인 중', color: 'bg-slate-500', reason: '', source: 'KRX' });

  // Calculators States
  const [targetInputs, setTargetInputs] = useState({ mode: 'cap', price: '', shares: '', currentCap: '', targetCap: '', targetRate: '' });
  const [pnlInputs, setPnlInputs] = useState({ buy: '', sell: '', fee: 0.3 });
  const [ipoInputs, setIpoInputs] = useState({ type: 0.5, price: '', qty: 10, people: 1 });
  const [avgRows, setAvgRows] = useState([{ id: 1, q: '', p: '' }, { id: 2, q: '', p: '' }]);
  const [exchangeInputs, setExchangeInputs] = useState({ base: 'USD', target: 'KRW', amount: '' });
  const [dividendInputs, setDividendInputs] = useState({ mode: 'KOR', shares: '', perShare: '', tax: 15.4 });

  // Tax States
  const [finData, setFinData] = useState([]);
  const [otherData, setOtherData] = useState([]);
  
  // Modal States
  // 'fav' 모달에서 사용할 입력 상태의 초기 구조를 명확히 했습니다.
  const initialModalInputs = { name: '', url: '', code: '', icon: '', color: '' };
  const [modal, setModal] = useState({ open: false, type: null, category: null }); // type: 'fav', 'link', 'cat'
  const [modalInputs, setModalInputs] = useState(initialModalInputs);
  const [confirmModal, setConfirmModal] = useState({ open: false, msg: '', action: null });

  // --- Effects ---
  useEffect(() => {
    // Load persisted data
    const savedLinks = storage.getJSON('myQuickLinks');
    if (savedLinks) setQuickLinks(savedLinks);
    const savedBlogs = storage.getJSON('myBlogMapData');
    if (savedBlogs) setBlogMapData(savedBlogs);
    const savedFavs = storage.getJSON('favoriteSymbols');
    // 로컬 저장소가 비어있으면 기본값으로, 그렇지 않으면 로컬 저장소 값으로 설정
    if (savedFavs && savedFavs.length > 0) setFavoriteSymbols(savedFavs);
    else setFavoriteSymbols(DEFAULT_FAVORITE_SYMBOLS);
    
    const savedFin = storage.getJSON('finData');
    if (savedFin) setFinData(savedFin);
    const savedOther = storage.getJSON('otherData');
    if (savedOther) setOtherData(savedOther);

    // Theme init
    const savedTheme = storage.get('theme');
    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && sysDark)) setIsDark(true);

    // Time & Market Status Interval
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      checkMarketStatus();
    }, 1000);
    checkMarketStatus();

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    storage.set('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // --- Logic Helpers ---
  const checkMarketStatus = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstNow = new Date(utc + (9 * 60 * 60000));
    const day = kstNow.getDay();
    const hours = kstNow.getHours();
    const minutes = kstNow.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    let status = { text: "상태 확인 중", color: "bg-slate-500", reason: "", source: 'KRX' };

    // Simple Logic for KRX vs US focus
    if (hours >= 8 && hours < 19) {
      status.source = 'KRX';
      if (day === 0 || day === 6) status = { ...status, text: "주말 휴장", color: "bg-slate-600", reason: "주말" };
      else if (totalMinutes >= 540 && totalMinutes <= 930) status = { ...status, text: "정규장 운영 중", color: "bg-green-600", reason: "09:00~15:30" };
      else if (totalMinutes >= 510 && totalMinutes < 540) status = { ...status, text: "장전 동시호가", color: "bg-cyan-600", reason: "08:30~09:00" };
      else status = { ...status, text: "장 마감", color: "bg-red-600", reason: "정규시간 종료" };
    } else {
      status.source = 'US';
      if (day === 6 || (day === 0 && hours < 22)) status = { ...status, text: "주말 휴장", color: "bg-slate-600", reason: "주말" };
      else if (hours >= 22 || hours < 7) status = { ...status, text: "정규장 운영 중", color: "bg-green-600", reason: "미국 시장" };
      else status = { ...status, text: "장 마감", color: "bg-red-600", reason: "Pre/After" };
    }
    setMarketStatus(prev => JSON.stringify(prev) !== JSON.stringify(status) ? status : prev);
  };

  const getTaxCalc = () => {
    const finTotal = finData.reduce((acc, cur) => acc + cur.amount, 0);
    const otherTotal = otherData.reduce((acc, cur) => acc + (cur.rev - cur.exp), 0);
    const limit = TAX_THRESHOLD;
    let step1 = 0, step2 = 0;

    if (finTotal <= limit) {
      step1 = finTotal * 0.154;
    } else {
      step1 = limit * 0.154;
      const excess = finTotal - limit;
      // 간이 누진세 계산 (단순화)
      const taxable = otherTotal + excess;
      const getRate = (amt) => {
        if(amt <= 14000000) return amt * 0.06;
        if(amt <= 50000000) return amt * 0.15 - 1260000;
        if(amt <= 88000000) return amt * 0.24 - 5860000;
        return amt * 0.35 - 15440000; // Simplified max
      };
      const rawTax = getRate(taxable);
      const otherTax = getRate(otherTotal);
      const diff = rawTax - otherTax;
      step2 = Math.max(diff * 1.1, excess * 0.154); // 비교과세
    }

    return { finTotal, otherTotal, total: step1 + step2, step1, step2, isTaxable: finTotal > limit };
  };

  // --- Handlers ---
  const searchSymbol = (query) => {
    if(!query) return;
    const code = query.trim();
    const url = /[a-zA-Z]/.test(code) 
      ? `https://finance.naver.com/world/sise.naver?symbol=${code}` 
      : `https://finance.naver.com/item/main.naver?code=${code}`;
    window.open(url, '_blank');
  };

  // --- Render Sections ---
  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Ticker */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden h-14">
        {/* key 속성을 추가하여 테마 변경 시 컴포넌트 강제 재생성 */}
        <TradingViewTicker key={`ticker-${isDark}`} theme={isDark ? 'dark' : 'light'} />
      </div>
      
      {/* Heatmap Section */}
      <div className="flex flex-col">
        <div className="bg-white dark:bg-slate-800 p-1 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-[500px] md:h-[600px]">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-t-xl">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <i className={`fa-solid fa-fire ${marketStatus.source === 'US' ? 'text-red-500' : 'text-blue-500'}`}></i>
              S&P 500 히트맵
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs text-white ${marketStatus.color}`}>
                {marketStatus.source === 'KRX' ? '[KRX]' : '[US]'} {marketStatus.text}
              </span>
            </h2>
            <div className="hidden md:flex gap-2">
               <a href="https://kr.tradingview.com/heatmap/stock/" target="_blank" className="text-xs text-slate-500 hover:text-blue-500"><i className="fa-solid fa-external-link-alt"></i> 전체보기</a>
            </div>
          </div>
          <div className="flex-1 bg-slate-100 dark:bg-slate-900 rounded-b-xl overflow-hidden relative">
            <div className="hidden md:block h-full w-full">
               {/* key 속성을 추가하여 테마/마켓 소스 변경 시 컴포넌트 강제 재생성 */}
               <TradingViewHeatmap key={`heatmap-${isDark}-${marketStatus.source}`} theme={isDark ? 'dark' : 'light'} marketSource={marketStatus.source} />
            </div>
            <div className="md:hidden h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
               <i className="fa-solid fa-mobile-screen-button text-4xl mb-2 text-indigo-300"></i>
               <p>모바일에서는 히트맵을 지원하지 않습니다.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Favorites */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
          <i className="fa-solid fa-magnifying-glass-chart text-indigo-500"></i> 간편 종목 검색
        </h3>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="종목 코드 (예: 005930) 또는 종목명" 
            className="flex-1 p-3 border-2 border-indigo-300 dark:border-indigo-600 rounded-lg dark:bg-slate-700 dark:text-white focus:outline-none focus:border-indigo-500"
            onKeyPress={(e) => e.key === 'Enter' && searchSymbol(e.target.value)}
          />
          {/* 설정 버튼 */}
          <button onClick={() => setModal({ open: true, type: 'fav' })} className="bg-slate-200 dark:bg-slate-700 p-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
            <i className="fa-solid fa-gear"></i>
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <span className="text-sm font-bold text-slate-500 mb-2 block">자주 찾는 종목</span>
          <div className="flex flex-wrap gap-2">
            {favoriteSymbols.map((sym, idx) => (
              <button key={idx} onClick={() => searchSymbol(sym.code)} className="bg-white border border-slate-200 dark:bg-slate-700 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm transition">
                <span className="text-slate-400 mr-1">{sym.code}</span> {sym.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderRoutine = () => {
    // Determine categories based on mode
    const allKeys = Object.keys(quickLinks);
    const dailyKeys = allKeys.filter(k => k.includes('Daily') || k.includes('부동산'));
    const investKeys = allKeys.filter(k => !k.includes('Daily') && !k.includes('부동산'));
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-end pb-4 border-b border-slate-200 dark:border-slate-700 gap-4">
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">오늘의 루틴</h2>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
              {['investment', 'blogs', 'daily'].map(mode => (
                <button key={mode} onClick={() => setLinkMode(mode)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${linkMode === mode ? 'bg-white dark:bg-slate-900 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                  {mode === 'investment' ? '투자' : mode === 'blogs' ? '인사이트' : '일상'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">편집</span>
              <button onClick={() => setIsEditMode(!isEditMode)} className={`w-10 h-5 rounded-full relative transition-colors ${isEditMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all shadow-sm ${isEditMode ? 'left-6' : 'left-1'}`}></div>
              </button>
            </div>
          </div>
        </div>

        {linkMode === 'blogs' ? (
          // Mind Map View
          <div className="flex flex-col gap-8 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700 min-h-[400px]">
             {Object.entries(blogMapData).map(([category, links]) => (
               <div key={category} className="flex flex-col md:flex-row items-center gap-4 relative group">
                  <div className="mindmap-node-main z-10">{category}
                    {isEditMode && <button onClick={() => {
                        setConfirmModal({
                            open: true, 
                            msg: `'${category}' 주제를 삭제하시겠습니까?`, 
                            action: () => {
                                const newData = {...blogMapData}; delete newData[category]; setBlogMapData(newData); storage.set('myBlogMapData', newData);
                            }
                        });
                    }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><i className="fa-solid fa-times"></i></button>}
                  </div>
                  <div className="hidden md:block w-8 h-0.5 bg-slate-300 dark:bg-slate-600"></div>
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start flex-1 pl-4 md:pl-0 border-l-2 md:border-l-0 border-dashed border-slate-300 dark:border-slate-600 md:items-center">
                      {links.map((link, idx) => (
                          <div key={idx} className="relative group/link">
                              <a href={link.url} target="_blank" className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-full text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-500 transition shadow-sm">
                                  <i className="fa-solid fa-link text-xs text-slate-400"></i> {link.name}
                              </a>
                              {isEditMode && <button onClick={() => {
                                  const newData = {...blogMapData}; newData[category].splice(idx, 1); setBlogMapData(newData); storage.set('myBlogMapData', newData);
                              }} className="absolute -top-1 -right-1 bg-red-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"><i className="fa-solid fa-minus"></i></button>}
                          </div>
                      ))}
                      {isEditMode && <button onClick={() => setModal({ open: true, type: 'link', category })} className="px-3 py-1 border border-dashed border-slate-300 text-slate-400 rounded-full text-xs hover:text-blue-500"><i className="fa-solid fa-plus"></i> 추가</button>}
                  </div>
               </div>
             ))}
             {isEditMode && <button onClick={() => setModal({ open: true, type: 'cat' })} className="w-full py-3 border-2 border-dashed border-indigo-300 text-indigo-500 rounded-xl font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20"><i className="fa-solid fa-plus-circle"></i> 새 주제 추가</button>}
          </div>
        ) : (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(linkMode === 'investment' ? investKeys : dailyKeys).map(category => (
               <div key={category} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col h-full">
                  <h3 className="text-lg font-bold mb-4 flex justify-between border-b pb-2 border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white">
                      {category}
                      {isEditMode && <div className="flex gap-2">
                          <button onClick={() => setModal({ open: true, type: 'link', category })} className="text-blue-500 text-xs bg-blue-50 p-1 rounded"><i className="fa-solid fa-plus"></i></button>
                          <button onClick={() => setConfirmModal({ open: true, msg: `'${category}' 삭제하시겠습니까?`, action: () => { const newData = {...quickLinks}; delete newData[category]; setQuickLinks(newData); storage.set('myQuickLinks', newData); } })} className="text-red-500 text-xs bg-red-50 p-1 rounded"><i className="fa-solid fa-trash"></i></button>
                      </div>}
                  </h3>
                  <div className="space-y-3 flex-1">
                      {quickLinks[category]?.map((link, idx) => (
                          <div key={idx} className="relative group">
                              <a href={link.url} target="_blank" className={`block p-3 rounded-xl border border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600 hover:shadow-md transition flex items-center gap-3 ${isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>
                                  <div className={`w-8 h-8 rounded flex items-center justify-center ${link.color} bg-opacity-20`}>
                                      <i className={`fa-solid ${link.icon || 'fa-link'}`}></i>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{link.name}</div>
                                  </div>
                                  {!isEditMode && <i className="fa-solid fa-arrow-up-right-from-square text-xs text-slate-300"></i>}
                              </a>
                              {isEditMode && <button onClick={() => {
                                  const newData = {...quickLinks}; newData[category].splice(idx, 1); setQuickLinks(newData); storage.set('myQuickLinks', newData);
                              }} className="absolute right-2 top-3 text-red-500 bg-white dark:bg-slate-800 p-1 rounded shadow"><i className="fa-solid fa-trash"></i></button>}
                          </div>
                      ))}
                  </div>
               </div>
            ))}
            {isEditMode && <button onClick={() => setModal({ open: true, type: 'cat' })} className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 min-h-[200px]"><i className="fa-solid fa-plus-circle text-3xl mb-2"></i><span className="font-bold">새 카테고리 추가</span></button>}
          </div>
        )}
      </div>
    );
  };

  const renderTools = () => {
    // Target Calc Logic
    const calcTarget = () => {
       const p = parseFloat(targetInputs.price) || 0;
       const s = parseFloat(targetInputs.shares) || 0;
       let targetP = 0, rate = 0;
       if(targetInputs.mode === 'cap') {
           const cCap = parseFloat(targetInputs.currentCap) || 0;
           const tCap = parseFloat(targetInputs.targetCap) || 0;
           if(cCap > 0) { targetP = p * (tCap / cCap); rate = ((tCap/cCap)-1)*100; }
       } else {
           const tRate = parseFloat(targetInputs.targetRate) || 0;
           targetP = tRate;
           if(p > 0) rate = ((tRate - p)/p)*100;
       }
       return { price: targetP, profit: (targetP * s) - (p * s), rate };
    };
    const targetRes = calcTarget();

    // PnL Logic
    const calcPnL = () => {
        const b = parseFloat(pnlInputs.buy) || 0;
        const s = parseFloat(pnlInputs.sell) || 0;
        const f = (parseFloat(pnlInputs.fee) || 0) / 100;
        const fee = (b * f) + (s * f);
        const net = s - b - fee;
        return { net, rate: b > 0 ? (net/b)*100 : 0 };
    };
    const pnlRes = calcPnL();

    // Exchange Logic
    const calcExch = () => {
        const rate = EXCHANGE_RATES[exchangeInputs.base === 'KRW' ? exchangeInputs.target : exchangeInputs.base]?.krw || 1;
        const amt = parseFloat(exchangeInputs.amount) || 0;
        return exchangeInputs.base === 'KRW' ? (amt / rate).toFixed(2) : Math.round(amt * rate).toLocaleString();
    };

    // Div Logic
    const calcDiv = () => {
        const s = parseFloat(dividendInputs.shares) || 0;
        const p = parseFloat(dividendInputs.perShare) || 0;
        const t = parseFloat(dividendInputs.tax) || 0;
        const gross = s * p;
        const net = gross - (gross * (t/100));
        return { gross: formatNumber(Math.round(gross)), net: formatNumber(Math.round(net)) };
    };
    const divRes = calcDiv();

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 animate-fade-in">
         {/* 1. Target Calc */}
         <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900 shadow-lg p-5 flex flex-col">
             <h3 className="font-bold text-indigo-800 dark:text-indigo-200 mb-4 flex gap-2 items-center"><i className="fa-solid fa-bullseye"></i> 목표 단가 분석</h3>
             <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mb-4">
                 <button onClick={() => setTargetInputs({...targetInputs, mode: 'cap'})} className={`flex-1 py-1.5 text-xs font-bold rounded ${targetInputs.mode === 'cap' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>시총 기반</button>
                 <button onClick={() => setTargetInputs({...targetInputs, mode: 'rate'})} className={`flex-1 py-1.5 text-xs font-bold rounded ${targetInputs.mode === 'rate' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>가격 기반</button>
             </div>
             <div className="space-y-3 flex-1">
                 <input type="number" placeholder="현재가" className="w-full p-2 border rounded dark:bg-slate-700" value={targetInputs.price} onChange={e => setTargetInputs({...targetInputs, price: e.target.value})} />
                 <input type="number" placeholder="보유 수량" className="w-full p-2 border rounded dark:bg-slate-700" value={targetInputs.shares} onChange={e => setTargetInputs({...targetInputs, shares: e.target.value})} />
                 {targetInputs.mode === 'cap' ? (
                     <>
                        <input type="number" placeholder="현재 시총 (조)" className="w-full p-2 border rounded dark:bg-slate-700" value={targetInputs.currentCap} onChange={e => setTargetInputs({...targetInputs, currentCap: e.target.value})} />
                        <input type="number" placeholder="목표 시총 (조)" className="w-full p-2 border rounded dark:bg-slate-700" value={targetInputs.targetCap} onChange={e => setTargetInputs({...targetInputs, targetCap: e.target.value})} />
                     </>
                 ) : (
                    <input type="number" placeholder="목표 매도가" className="w-full p-2 border rounded dark:bg-slate-700" value={targetInputs.targetRate} onChange={e => setTargetInputs({...targetInputs, targetRate: e.target.value})} />
                 )}
             </div>
             <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-right">
                 <div className="text-sm text-slate-500">목표 단가/수익률</div>
                 <div className="text-2xl font-bold text-indigo-600">{targetInputs.mode === 'cap' ? formatNumber(targetRes.price) + '원' : targetRes.price.toFixed(2) + '%'}</div>
                 <div className={`text-sm font-bold ${targetRes.profit > 0 ? 'text-green-500' : 'text-red-500'}`}>{formatNumber(targetRes.profit)}원 수익 예상</div>
             </div>
         </div>

         {/* 2. PnL Calc */}
         <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-red-200 dark:border-red-900 shadow-lg p-5 flex flex-col">
             <h3 className="font-bold text-red-800 dark:text-red-200 mb-4 flex gap-2 items-center"><i className="fa-solid fa-percent"></i> 실현 손익 (P&L)</h3>
             <div className="space-y-3 flex-1">
                 <input type="number" placeholder="총 매수 금액" className="w-full p-2 border rounded dark:bg-slate-700" value={pnlInputs.buy} onChange={e => setPnlInputs({...pnlInputs, buy: e.target.value})} />
                 <input type="number" placeholder="총 매도 금액" className="w-full p-2 border rounded dark:bg-slate-700" value={pnlInputs.sell} onChange={e => setPnlInputs({...pnlInputs, sell: e.target.value})} />
                 <input type="number" placeholder="수수료율 (%)" className="w-full p-2 border rounded dark:bg-slate-700" value={pnlInputs.fee} onChange={e => setPnlInputs({...pnlInputs, fee: e.target.value})} />
             </div>
             <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                 <div className="text-sm text-slate-500">순 실현 손익 (세후)</div>
                 <div className={`text-3xl font-extrabold font-mono ${pnlRes.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(pnlRes.net)}원</div>
                 <div className={`text-lg font-bold ${pnlRes.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pnlRes.rate.toFixed(2)}%</div>
             </div>
         </div>

         {/* 3. IPO Calc */}
         <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-purple-200 dark:border-purple-900 shadow-lg p-5 flex flex-col">
             <h3 className="font-bold text-purple-800 dark:text-purple-200 mb-4 flex gap-2 items-center"><i className="fa-solid fa-piggy-bank"></i> 공모주/스팩 청약</h3>
             <div className="space-y-3 flex-1">
                 <select className="w-full p-2 border rounded dark:bg-slate-700" value={ipoInputs.type} onChange={e => setIpoInputs({...ipoInputs, type: parseFloat(e.target.value)})}>
                     <option value={0.5}>일반 공모주 (50%)</option>
                     <option value={1.0}>스팩 (100%)</option>
                 </select>
                 <input type="number" placeholder="공모가" className="w-full p-2 border rounded dark:bg-slate-700" value={ipoInputs.price} onChange={e => setIpoInputs({...ipoInputs, price: e.target.value})} />
                 <div className="flex gap-2">
                    <input type="number" placeholder="수량" className="flex-1 p-2 border rounded dark:bg-slate-700" value={ipoInputs.qty} onChange={e => setIpoInputs({...ipoInputs, qty: e.target.value})} />
                    <input type="number" placeholder="인원" className="w-20 p-2 border rounded dark:bg-slate-700" value={ipoInputs.people} onChange={e => setIpoInputs({...ipoInputs, people: e.target.value})} />
                 </div>
             </div>
             <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-right">
                 <span className="text-sm text-slate-500 mr-2">필요 현금:</span>
                 <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-300 font-mono">{formatNumber((parseFloat(ipoInputs.price)||0) * (parseFloat(ipoInputs.qty)||0) * (parseFloat(ipoInputs.people)||0) * ipoInputs.type)}원</span>
             </div>
         </div>

         {/* 4. Avg Price */}
         <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-green-200 dark:border-green-900 shadow-lg p-5 flex flex-col">
             <h3 className="font-bold text-green-800 dark:text-green-200 mb-4 flex justify-between items-center">
                 <span><i className="fa-solid fa-scale-balanced"></i> 평단가 계산기</span>
                 <button onClick={() => setAvgRows([...avgRows, { id: Date.now(), q: '', p: '' }])} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"><i className="fa-solid fa-plus"></i> 추가</button>
             </h3>
             <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px]">
                 {avgRows.map((row, idx) => (
                     <div key={row.id} className="flex gap-2">
                         <input type="number" placeholder="수량" className="w-1/2 p-2 border rounded dark:bg-slate-700 text-right" value={row.q} onChange={e => {
                             const newRows = [...avgRows]; newRows[idx].q = e.target.value; setAvgRows(newRows);
                         }} />
                         <input type="number" placeholder="단가" className="w-1/2 p-2 border rounded dark:bg-slate-700 text-right" value={row.p} onChange={e => {
                             const newRows = [...avgRows]; newRows[idx].p = e.target.value; setAvgRows(newRows);
                         }} />
                     </div>
                 ))}
             </div>
             <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-right">
                 <span className="text-sm text-slate-500 mr-2">평균 단가:</span>
                 <span className="text-2xl font-extrabold text-green-600 font-mono">
                     {(() => {
                         let tQ = 0, tC = 0;
                         avgRows.forEach(r => { const q = parseFloat(r.q)||0; const p = parseFloat(r.p)||0; tQ += q; tC += q*p; });
                         return tQ ? formatNumber(Math.round(tC/tQ)) : 0;
                     })()}원
                 </span>
             </div>
         </div>

         {/* 5. Exchange */}
         <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-200 dark:border-blue-900 shadow-lg p-5 flex flex-col">
             <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-4 flex gap-2 items-center"><i className="fa-solid fa-money-bill-transfer"></i> 환율 계산기</h3>
             <div className="space-y-4 flex-1">
                 <div className="flex gap-2">
                     <select className="w-1/3 p-2 border rounded dark:bg-slate-700" value={exchangeInputs.base} onChange={e => setExchangeInputs({...exchangeInputs, base: e.target.value})}>
                         {Object.keys(EXCHANGE_RATES).map(k => <option key={k} value={k}>{k}</option>)}
                         <option value="KRW">KRW</option>
                     </select>
                     <input type="number" className="flex-1 p-2 border rounded dark:bg-slate-700 text-right" value={exchangeInputs.amount} onChange={e => setExchangeInputs({...exchangeInputs, amount: e.target.value})} />
                 </div>
                 <div className="flex justify-center text-slate-400"><i className="fa-solid fa-arrow-down"></i></div>
                 <div className="flex gap-2">
                     <div className="w-1/3 p-2 font-bold text-center text-slate-500">{exchangeInputs.base === 'KRW' ? exchangeInputs.target : 'KRW'}</div>
                     <div className="flex-1 p-2 border rounded bg-slate-50 dark:bg-slate-700 text-right font-bold text-blue-600">{calcExch()}</div>
                 </div>
             </div>
         </div>

         {/* 6. Dividend */}
         <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-amber-200 dark:border-amber-900 shadow-lg p-5 flex flex-col">
             <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-4 flex gap-2 items-center"><i className="fa-solid fa-sack-dollar"></i> 배당금 계산기</h3>
             <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mb-4">
                 <button onClick={() => setDividendInputs({...dividendInputs, mode: 'KOR'})} className={`flex-1 py-1.5 text-xs font-bold rounded ${dividendInputs.mode === 'KOR' ? 'bg-white shadow' : 'text-slate-500'}`}>국내</button>
                 <button onClick={() => setDividendInputs({...dividendInputs, mode: 'US'})} className={`flex-1 py-1.5 text-xs font-bold rounded ${dividendInputs.mode === 'US' ? 'bg-white shadow' : 'text-slate-500'}`}>해외</button>
             </div>
             <div className="space-y-3 flex-1">
                 <input type="number" placeholder="주식 수" className="w-full p-2 border rounded dark:bg-slate-700" value={dividendInputs.shares} onChange={e => setDividendInputs({...dividendInputs, shares: e.target.value})} />
                 <input type="number" placeholder={dividendInputs.mode === 'KOR' ? '주당 배당금 (원)' : '주당 배당금 (USD)'} className="w-full p-2 border rounded dark:bg-slate-700" value={dividendInputs.perShare} onChange={e => setDividendInputs({...dividendInputs, perShare: e.target.value})} />
                 <input type="number" placeholder="세율 (%)" className="w-full p-2 border rounded dark:bg-slate-700" value={dividendInputs.tax} onChange={e => setDividendInputs({...dividendInputs, tax: e.target.value})} />
             </div>
             <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-right">
                 <div className="text-xs text-slate-400">세전: {divRes.gross}{dividendInputs.mode === 'US' ? ' USD' : '원'}</div>
                 <div className="text-2xl font-bold text-amber-600">{divRes.net}{dividendInputs.mode === 'US' ? ' USD' : '원'}</div>
             </div>
         </div>
      </div>
    );
  };

  const renderTax = () => {
    const calc = getTaxCalc();
    return (
      <div className="space-y-6 animate-fade-in mt-6">
         {/* Summary Cards */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                 <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 dark:bg-blue-900/30 rounded-bl-full -mr-4 -mt-4"></div>
                 <p className="text-sm text-slate-500 relative z-10">연간 금융소득 합계</p>
                 <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-2 relative z-10">{formatNumber(calc.finTotal)} 원</h3>
                 <div className={`inline-block mt-4 px-3 py-1 text-xs font-bold rounded-full ${calc.isTaxable ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {calc.isTaxable ? '종합과세 대상' : '분리과세 종결'}
                 </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                 <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/30 rounded-bl-full -mr-4 -mt-4"></div>
                 <p className="text-sm text-slate-500 relative z-10">기타소득 합계 (순이익)</p>
                 <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-2 relative z-10">{formatNumber(calc.otherTotal)} 원</h3>
             </div>
             <div className="bg-slate-800 dark:bg-slate-700 text-white p-6 rounded-2xl shadow-lg border border-slate-700 relative">
                 <p className="text-sm text-slate-400">총 예상 세금</p>
                 <h3 className="text-3xl font-bold mt-2">{formatNumber(Math.round(calc.total))} 원</h3>
                 <div className="mt-4 pt-4 border-t border-slate-600 flex justify-between text-xs text-slate-400">
                     <span>분리과세: {formatNumber(Math.round(calc.step1))}</span>
                     <span>누진세: {formatNumber(Math.round(calc.step2))}</span>
                 </div>
             </div>
         </div>

         {/* Gauge & Details */}
         <div className="flex flex-col lg:flex-row gap-6">
             <div className="flex-1 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-cyan-200 dark:border-cyan-900 shadow-sm">
                 <h3 className="font-bold text-cyan-800 dark:text-cyan-200 mb-4 flex gap-2"><i className="fa-solid fa-calculator"></i> 예상 납부 세액 시각화</h3>
                 <div className="py-6">
                     <div className="flex justify-between text-xs text-slate-400 mb-1 font-bold"><span>0</span><span className="text-red-500">2,000만 원 (기준)</span><span>4,000만 원</span></div>
                     <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded-full relative overflow-hidden">
                         <div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, (calc.finTotal / 40000000) * 100)}%`, background: calc.isTaxable ? 'linear-gradient(90deg, #f87171, #ef4444)' : 'linear-gradient(90deg, #4ade80, #22c55e)' }}></div>
                         <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: '50%' }}></div>
                     </div>
                     <div className="text-center mt-3 text-sm font-bold text-slate-500">
                        {calc.isTaxable ? <span className="text-red-500">2,000만원 초과! 종합과세 대상입니다.</span> : <span className="text-green-600">안전합니다! 분리과세로 종결됩니다.</span>}
                     </div>
                 </div>
                 {calc.isTaxable && (
                     <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4 flex gap-3">
                         <i className="fa-solid fa-triangle-exclamation text-red-500 mt-1"></i>
                         <div>
                             <h4 className="font-bold text-red-700 text-sm">건강보험 피부양자 자격 박탈 주의</h4>
                             <p className="text-xs text-red-600 mt-1">금융소득이 연 2,000만원을 초과하면 피부양자 자격이 상실될 수 있습니다.</p>
                         </div>
                     </div>
                 )}
             </div>
         </div>

         {/* Inputs */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Financial Income Input */}
             <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                 <h3 className="font-bold mb-4 flex gap-2 items-center text-slate-700 dark:text-slate-200"><i className="fa-solid fa-coins text-blue-500"></i> 금융소득 상세</h3>
                 <div className="flex gap-2 mb-4">
                     <select id="finType" className="p-2 border rounded dark:bg-slate-700"><option>이자</option><option>배당</option></select>
                     <input id="finDesc" type="text" placeholder="내용" className="flex-1 p-2 border rounded dark:bg-slate-700" />
                     <input id="finAmt" type="number" placeholder="금액" className="w-24 p-2 border rounded dark:bg-slate-700 text-right" />
                     <button onClick={() => {
                         const type = document.getElementById('finType').value;
                         const desc = document.getElementById('finDesc').value;
                         const amt = parseInt(document.getElementById('finAmt').value) || 0;
                         if (amt > 0) {
                             const newData = [...finData, { id: Date.now(), type, desc, amount: amt }];
                             setFinData(newData); storage.set('finData', newData);
                             document.getElementById('finDesc').value = ''; document.getElementById('finAmt').value = '';
                         }
                     }} className="bg-blue-600 text-white px-3 rounded font-bold">추가</button>
                 </div>
                 <div className="max-h-60 overflow-y-auto">
                     {finData.map(item => (
                         <div key={item.id} className="flex justify-between border-b p-2 text-sm dark:border-slate-700">
                             <span><span className="bg-slate-100 dark:bg-slate-700 px-2 rounded text-xs mr-2">{item.type}</span>{item.desc}</span>
                             <div className="flex gap-2 items-center">
                                 <span className="font-bold text-blue-600">{formatNumber(item.amount)}</span>
                                 <button onClick={() => { const n = finData.filter(i => i.id !== item.id); setFinData(n); storage.set('finData', n); }} className="text-slate-300 hover:text-red-500"><i className="fa-solid fa-times"></i></button>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
             {/* Other Income Input */}
             <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                 <h3 className="font-bold mb-4 flex gap-2 items-center text-slate-700 dark:text-slate-200"><i className="fa-solid fa-file-invoice-dollar text-emerald-500"></i> 기타소득 상세</h3>
                 <div className="space-y-2 mb-4">
                     <input id="otherDesc" type="text" placeholder="내용" className="w-full p-2 border rounded dark:bg-slate-700" />
                     <div className="flex gap-2">
                         <input id="otherRev" type="number" placeholder="수입" className="w-1/2 p-2 border rounded dark:bg-slate-700 text-right" />
                         <input id="otherExp" type="number" placeholder="경비" className="w-1/2 p-2 border rounded dark:bg-slate-700 text-right" />
                         <button onClick={() => {
                             const desc = document.getElementById('otherDesc').value;
                             const rev = parseInt(document.getElementById('otherRev').value) || 0;
                             const exp = parseInt(document.getElementById('otherExp').value) || 0;
                             if (rev > 0) {
                                 const newData = [...otherData, { id: Date.now(), desc, rev, exp }];
                                 setOtherData(newData); storage.set('otherData', newData);
                                 document.getElementById('otherDesc').value = ''; document.getElementById('otherRev').value = ''; document.getElementById('otherExp').value = '';
                             }
                         }} className="bg-emerald-600 text-white px-3 rounded font-bold">추가</button>
                     </div>
                 </div>
                 <div className="max-h-60 overflow-y-auto">
                     {otherData.map(item => (
                         <div key={item.id} className="flex justify-between border-b p-2 text-sm dark:border-slate-700">
                             <span>{item.desc}</span>
                             <div className="flex gap-2 items-center">
                                 <span className="font-bold text-emerald-600">{formatNumber(item.rev - item.exp)}</span>
                                 <button onClick={() => { const n = otherData.filter(i => i.id !== item.id); setOtherData(n); storage.set('otherData', n); }} className="text-slate-300 hover:text-red-500"><i className="fa-solid fa-times"></i></button>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         </div>
      </div>
    );
  };

  // --- Modals ---
  const renderModal = () => {
    if (!modal.open) return null;

    // 모달 닫기 함수
    const closeModal = () => {
      setModal({ open: false, type: null, category: null });
      // 모달 닫을 때 입력 상태 초기화
      setModalInputs(initialModalInputs); 
    };
    
    return (
      <div className="fixed inset-0 bg-slate-900/70 z-[100] flex items-center justify-center animate-fade-in px-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl p-5">
           <div className="flex justify-between mb-4">
               <h3 className="font-bold text-lg dark:text-white">
                   {modal.type === 'fav' ? '자주 찾는 종목 관리' : modal.type === 'cat' ? '새 카테고리 추가' : '새 링크 추가'}
               </h3>
               {/* 닫기 버튼에 closeModal 적용 */}
               <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button>
           </div>
           
           {modal.type === 'fav' ? (
               <div className="space-y-3">
                   <div className="flex gap-2">
                      {/* [수정 반영] 종목 코드 입력 필드: w-1/2 적용 */}
                      <input type="text" placeholder="코드 (예: 005930)" className="w-1/2 p-2 border rounded dark:bg-slate-700" value={modalInputs.code} onChange={e => setModalInputs(prev => ({...prev, code: e.target.value}))} />
                      {/* [수정 반영] 종목명 입력 필드: w-1/2 적용 (공간 벗어남 문제 해결) */}
                      <input type="text" placeholder="종목명" className="w-1/2 p-2 border rounded dark:bg-slate-700" value={modalInputs.name} onChange={e => setModalInputs(prev => ({...prev, name: e.target.value}))} />
                   </div>
                   
                   <button onClick={() => {
                       if (modalInputs.code && modalInputs.name) {
                           const newData = [...favoriteSymbols, { code: modalInputs.code.toUpperCase(), name: modalInputs.name }];
                           setFavoriteSymbols(newData); storage.set('favoriteSymbols', newData);
                           // 종목 추가 후 입력 필드 초기화 (modalInputs 재설정)
                           setModalInputs(initialModalInputs);
                       }
                   }} className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 transition">자주 찾는 종목 추가</button>

                   <div className="mt-4 border-t pt-2 max-h-40 overflow-y-auto">
                       <p className="text-xs text-slate-500 font-bold mb-2">현재 등록된 종목 (클릭 시 삭제)</p>
                       {favoriteSymbols.map((s, i) => (
                           <div key={i} className="flex justify-between items-center p-2 border-b text-sm dark:border-slate-700 bg-slate-50 dark:bg-slate-700 rounded hover:bg-red-50 dark:hover:bg-red-900/50 transition cursor-pointer"
                                onClick={() => { 
                                    // 상태 업데이트 시 새로운 배열을 명확히 생성하여 상태 변경을 트리거
                                    const n = favoriteSymbols.filter((_, idx) => idx !== i); 
                                    setFavoriteSymbols(n); 
                                    storage.set('favoriteSymbols', n);
                                }}>
                               <span className="dark:text-white"><span className="text-slate-400 mr-2">{s.code}</span>{s.name}</span>
                               <i className="fa-solid fa-trash text-red-400"></i>
                           </div>
                       ))}
                   </div>

                   {/* 취소 버튼 추가 */}
                   <button onClick={closeModal} className="w-full py-2 bg-slate-200 text-slate-700 rounded font-bold mt-4 hover:bg-slate-300 transition">닫기 (취소)</button>
               </div>
           ) : modal.type === 'cat' ? (
               <div className="space-y-3">
                   {/* value와 onChange가 modalInputs.name과 정확히 연결 */}
                   <input type="text" placeholder="카테고리 이름" className="w-full p-2 border rounded dark:bg-slate-700" value={modalInputs.name} onChange={e => setModalInputs(prev => ({...prev, name: e.target.value}))} />
                   <button onClick={() => {
                       if (!modalInputs.name) return;
                       if (linkMode === 'blogs') {
                           const newData = { ...blogMapData, [modalInputs.name]: [] };
                           setBlogMapData(newData); storage.set('myBlogMapData', newData);
                       } else {
                           const newData = { ...quickLinks, [modalInputs.name]: [] };
                           setQuickLinks(newData); storage.set('myQuickLinks', newData);
                       }
                       closeModal(); // 성공 시 모달 닫기
                   }} className="w-full bg-blue-600 text-white py-2 rounded font-bold">추가</button>
               </div>
           ) : (
               <div className="space-y-3">
                   {/* value와 onChange가 modalInputs.name과 정확히 연결 */}
                   <input type="text" placeholder="링크 이름" className="w-full p-2 border rounded dark:bg-slate-700" value={modalInputs.name} onChange={e => setModalInputs(prev => ({...prev, name: e.target.value}))} />
                   {/* value와 onChange가 modalInputs.url과 정확히 연결 */}
                   <input type="text" placeholder="URL" className="w-full p-2 border rounded dark:bg-slate-700" value={modalInputs.url} onChange={e => setModalInputs(prev => ({...prev, url: e.target.value}))} />
                   <button onClick={() => {
                       if (!modalInputs.name || !modalInputs.url) return;
                       const newLink = { name: modalInputs.name, url: modalInputs.url, icon: 'fa-link', color: 'bg-slate-100 text-slate-700' };
                       if (linkMode === 'blogs') {
                           const newData = { ...blogMapData }; newData[modal.category].push(newLink);
                           setBlogMapData(newData); storage.set('myBlogMapData', newData);
                       } else {
                           const newData = { ...quickLinks }; newData[modal.category].push(newLink);
                           setQuickLinks(newData); storage.set('myQuickLinks', newData);
                       }
                       closeModal(); // 성공 시 모달 닫기
                   }} className="w-full bg-blue-600 text-white py-2 rounded font-bold">추가</button>
               </div>
           )}
        </div>
      </div>
    );
  };
  
  const renderConfirm = () => {
    if (!confirmModal.open) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/70 z-[110] flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-2xl max-w-sm w-full">
                <h3 className="text-lg font-bold mb-4 dark:text-white"><i className="fa-solid fa-circle-question text-red-500 mr-2"></i> 확인</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6">{confirmModal.msg}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setConfirmModal({ open: false })} className="px-4 py-2 bg-slate-200 rounded font-bold text-slate-700">취소</button>
                    <button onClick={() => { confirmModal.action(); setConfirmModal({ open: false }); }} className="px-4 py-2 bg-red-600 text-white rounded font-bold">확인</button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isDark ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        body { font-family: 'Noto Sans KR', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
        .dark ::webkit-scrollbar-thumb { background: #475569; }
        .nav-tab.active { background-color: #eff6ff; color: #2563eb; font-weight: 700; box-shadow: 0 1px 2px rgba(37,99,235,0.2); }
        .dark .nav-tab.active { background-color: #1e293b; color: #60a5fa; }
        .mindmap-node-main { background: linear-gradient(135deg, #4f46e5, #3b82f6); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); color: white; padding: 0.75rem 1rem; border-radius: 1rem; font-weight: 700; position: relative; min-width: 140px; text-align: center; }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg">
              <i className="fa-solid fa-compass text-lg"></i>
            </div>
            <div>
              <h1 className="font-bold text-xl leading-none">Investment Navigator</h1>
              <span className="text-xs text-slate-500 dark:text-slate-400">나만의 투자 비서</span>
            </div>
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl overflow-x-auto max-w-[50vw] sm:max-w-none">
            {[
              { id: 'dashboard', icon: 'fa-chart-bar', label: '대시보드' },
              { id: 'routine', icon: 'fa-clipboard-list', label: '루틴' },
              { id: 'tools', icon: 'fa-calculator', label: '도구' },
              { id: 'tax', icon: 'fa-file-invoice-dollar', label: '금융과세' }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab px-4 py-2 text-sm flex items-center gap-2 whitespace-nowrap rounded-lg transition-all ${activeTab === tab.id ? 'active' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <i className={`fa-solid ${tab.icon}`}></i>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-mono font-bold text-slate-500 dark:text-slate-400 hidden md:block">{currentTime}</span>
            <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <i className={`fa-solid ${isDark ? 'fa-sun text-amber-400' : 'fa-moon text-slate-600'}`}></i>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 py-6 flex-1">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'routine' && renderRoutine()}
        {activeTab === 'tools' && renderTools()}
        {activeTab === 'tax' && renderTax()}
      </main>

      {renderModal()}
      {renderConfirm()}
    </div>
  );
}