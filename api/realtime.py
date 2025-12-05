# Vercel Serverless Function (Python/Flask)
# Filename: api/realtime.py
# -- Vercel Routing Fix: Handle root path mapping --

import os
import json
from flask import Flask, request, jsonify
import yfinance as yf
from datetime import datetime
import requests

NAVER_CLIENT_ID = os.environ.get('NAVER_CLIENT_ID')
NAVER_CLIENT_SECRET = os.environ.get('NAVER_CLIENT_SECRET')

app = Flask(__name__)

# ... (기존 헬퍼 함수들은 그대로 유지) ...
def get_yahoo_symbol(code):
    return f'{code}.KQ'

def fetch_naver_search(query, display=5, start=1, sort='date'):
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        return []
    
    headers = {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
    }
    
    try:
        response = requests.get("https://openapi.naver.com/v1/search/news.json", headers=headers, params={'query': query, 'display': display, 'start': start, 'sort': sort})
        response.raise_for_status()
        return response.json().get('items', [])
    except Exception as e:
        print(f"Error fetching Naver API: {e}")
        return []

def format_naver_item(item):
    title = item.get('title', '').replace('<b>', '').replace('</b>', '').replace('&quot;', '"').replace('&amp;', '&')
    link = item.get('link', '#')
    date_str = item.get('pubDate')
    date_formatted = ""
    if date_str:
        try:
            date_obj = datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S %z')
            date_formatted = date_obj.strftime('%Y-%m-%d')
        except:
            pass
    return {"title": title, "link": link, "date": date_formatted}

# [여기부터 수정하세요] 어떤 주소로 들어와도 작동하게 만드는 마법 코드입니다.
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def realtime_price(path):
    # Vercel이 /api/realtime 으로 호출하든, / 로 호출하든 여기서 모두 처리합니다.
    code = request.args.get('code')
    if not code:
        # code 파라미터가 없으면 에러 대신 안내 메시지 (디버깅용)
        return jsonify({"status": "Server is running", "message": "Please provide a 'code' query parameter."})

    symbol = get_yahoo_symbol(code)
    ticker = yf.Ticker(symbol)
    
    realtime_data = {}
    
    try:
        info = ticker.info
        current_price = info.get('currentPrice')
        previous_close = info.get('previousClose')
        
        if current_price is None or previous_close is None:
             # 데이터 없음
             return jsonify({"error": "Price data not available"}), 503

        change = current_price - previous_close
        rate = (change / previous_close) * 100
        
        realtime_data.update({
            "price": round(current_price),
            "change": round(change),
            "rate": round(rate, 2),
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": f"Yahoo Finance Error: {str(e)}"}), 503

    # 네이버 뉴스/보고서
    stock_name = info.get('shortName', code)
    news_items = fetch_naver_search(f'{stock_name} 주식', display=5, sort='date')
    report_items = fetch_naver_search(f'{stock_name} 애널리스트 보고서', display=5, sort='sim')
    
    final_response = {
        "price": realtime_data["price"],
        "change": realtime_data["change"],
        "rate": realtime_data["rate"],
        "news": [format_naver_item(i) for i in news_items],
        "reports": [format_naver_item(i) for i in report_items],
        "disclosure": [
            {"title": f"{stock_name} (DART)", "link": f"https://dart.fss.or.kr/dsac001/main.do?&textCrpNm={stock_name}"}
        ]
    }

    return jsonify(final_response)

if __name__ == '__main__':
    app.run(debug=True)