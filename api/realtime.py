from flask import Flask, jsonify, request
import requests
import yfinance as yf
from bs4 import BeautifulSoup
import time
import re

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

# [중요 변경] 서버 부담을 5배 줄이는 캐시 설정 (5분)
COMMUNITY_CACHE = {}
CACHE_DURATION = 300 

@app.route('/')
def home():
    return "Stock & Community Server is Running!"

# [기능 1] 주식 정보 가져오기 (가격/뉴스)
@app.route('/api/info')
def stock_info():
    symbol = request.args.get('symbol', '005930')
    try:
        if symbol.isdigit():
            ticker = f"{symbol}.KQ" if symbol.startswith(('2', '9')) else f"{symbol}.KS"
        else:
            ticker = symbol
            
        stock = yf.Ticker(ticker)
        
        # 가격 정보 (안전하게 가져오기)
        try:
            price = stock.fast_info.last_price
            prev = stock.fast_info.previous_close
            change = price - prev
            pct = (change / prev) * 100
        except:
            hist = stock.history(period="5d")
            if not hist.empty:
                price = hist['Close'].iloc[-1]
                prev = hist['Close'].iloc[-2] if len(hist) > 1 else price
                change = price - prev
                pct = (change / prev) * 100 if prev != 0 else 0
            else:
                price, change, pct = 0, 0, 0

        # 뉴스
        news = []
        try:
            for n in stock.news[:3]:
                news.append({
                    'title': n.get('title'), 
                    'link': n.get('link'),
                    'publisher': n.get('publisher'),
                    'thumbnail': n.get('thumbnail', {}).get('resolutions', [{}])[0].get('url', '') if n.get('thumbnail') else ''
                })
        except: pass

        return jsonify({
            "symbol": symbol,
            "price": price,
            "change": change,
            "change_percent": pct,
            "news": news,
            "dart_url": f"https://finance.naver.com/item/dart.naver?code={symbol}"
        })
    except Exception as e:
        return jsonify({"error": str(e)})

# [기능 2] 토론방 크롤링 & 자체 베스트 정렬 (100개 글 탐색)
@app.route('/api/community')
def community():
    code = request.args.get('code', '005930')
    
    # 캐시 확인 (서버 부담 방지)
    current_time = time.time()
    if code in COMMUNITY_CACHE:
        if current_time - COMMUNITY_CACHE[code]['timestamp'] < CACHE_DURATION:
            return jsonify(COMMUNITY_CACHE[code]['data'])

    try:
        posts = []
        # 1페이지부터 5페이지까지 순회하며 글을 긁어옵니다 (약 100개)
        for page in range(1, 6): 
            url = f"https://finance.naver.com/item/board.naver?code={code}&page={page}"
            headers = {'User-Agent': 'Mozilla/5.0'}
            
            resp = requests.get(url, headers=headers)
            soup = BeautifulSoup(resp.content.decode('euc-kr', 'replace'), 'html.parser')
            
            rows = soup.select('table.type2 tr')
            
            for row in rows:
                if 'onMouseOver' in str(row):
                    cols = row.find_all('td')
                    if len(cols) >= 6:
                        title = cols[1].get_text(strip=True)
                        link = "https://finance.naver.com" + cols[1].find('a')['href']
                        date = cols[0].get_text(strip=True)
                        views = cols[4].get_text(strip=True)
                        likes = cols[5].get_text(strip=True)
                        
                        posts.append({
                            "title": title,
                            "link": link,
                            "date": date,
                            "views": views,
                            "likes": likes,
                            "views_int": int(views.replace(',', '')),
                            "likes_int": int(likes.replace(',', ''))
                        })
        
        # 조회수 + (공감수 * 10) 점수로 랭킹 산정하여 베스트 5개를 찾습니다.
        best_posts = sorted(posts, key=lambda x: x['views_int'] + (x['likes_int'] * 10), reverse=True)
        
        result = {
            "best": best_posts[:5],    # 100개 중 가장 좋은 글 5개
            "latest": posts           # 100개 전체 글 (최신순)
        }
        
        COMMUNITY_CACHE[code] = {'data': result, 'timestamp': current_time}
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e), "best": [], "latest": []})