# Vercel Serverless Function (Python/Flask)
# Filename: api/realtime.py

import os
import json
from flask import Flask, request, jsonify
import yfinance as yf
from datetime import datetime
import requests # 네이버 API 호출을 위한 requests 라이브러리 사용

# 네이버 API 설정을 환경 변수에서 불러옴 (보안을 위해 코드에 직접 키를 넣지 않음)
NAVER_CLIENT_ID = os.environ.get('NAVER_CLIENT_ID')
NAVER_CLIENT_SECRET = os.environ.get('NAVER_CLIENT_SECRET')

app = Flask(__name__)

# KOSDAQ 종목 코드를 야후 파이낸스 심볼로 변환
def get_yahoo_symbol(code):
    # 한국 주식 (KOSPI/KOSDAQ)은 종목 코드 뒤에 '.KS' 또는 '.KQ'를 붙입니다.
    # 여기서는 KOSDAQ 종목 코드를 사용한다고 가정하고 '.KQ'를 붙여서 심볼을 생성합니다.
    return f'{code}.KQ'

# 네이버 검색 API를 호출하여 뉴스 및 애널리스트 보고서를 가져오는 함수
def fetch_naver_search(query, display=5, start=1, sort='date'):
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        print("Naver API keys are not set. Returning empty list.")
        return []

    # 네이버 뉴스 검색 API 엔드포인트
    # 보고서 대체 검색도 뉴스 API를 활용합니다.
    news_url = "https://openapi.naver.com/v1/search/news.json"
    
    headers = {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
    }
    
    params = {
        'query': query,
        'display': display,
        'start': start,
        'sort': sort # 'date' (날짜순) 또는 'sim' (정확도순)
    }

    try:
        # 네이버 API 호출
        response = requests.get(news_url, headers=headers, params=params)
        response.raise_for_status()  # 200 OK가 아니면 예외 발생
        return response.json().get('items', [])
    except requests.RequestException as e:
        print(f"Error fetching Naver API for query '{query}': {e}")
        return []

# 네이버 API에서 가져온 항목을 클라이언트에서 사용하기 쉬운 형태로 포맷
def format_naver_item(item):
    # HTML 태그 제거 및 기본 형식 유지
    title = item.get('title', '').replace('<b>', '').replace('</b>', '').replace('&quot;', '"').replace('&amp;', '&')
    link = item.get('link', '#')
    
    date_formatted = ""
    date_str = item.get('pubDate')
    if date_str:
        # 네이버 API 날짜 포맷: Mon, 04 Dec 2025 09:00:00 +0900
        try:
            date_obj = datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S %z')
            date_formatted = date_obj.strftime('%Y-%m-%d')
        except ValueError:
            date_formatted = ""

    return {
        "title": title,
        "link": link,
        "date": date_formatted
    }


@app.route('/api/realtime')
def realtime_price():
    code = request.args.get('code')
    if not code:
        return jsonify({"error": "Stock code is required"}), 400

    symbol = get_yahoo_symbol(code)
    ticker = yf.Ticker(symbol)
    
    realtime_data = {}
    
    # 1. 야후 파이낸스에서 실시간/지연 가격 정보 가져오기
    try:
        info = ticker.info
        current_price = info.get('currentPrice')
        previous_close = info.get('previousClose')
        
        if current_price is None or previous_close is None:
            # 데이터가 없을 경우 클라이언트에서 시뮬레이션 폴백이 작동하도록 에러 반환
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
        print(f"Error fetching Yahoo Finance for {symbol}: {e}")
        # 야후 파이낸스 실패 시 클라이언트에서 시뮬레이션 폴백이 작동하도록 에러 반환
        return jsonify({"error": "Yahoo Finance data fetch failed"}), 503

    # 2. 네이버 검색 API를 사용하여 뉴스 및 보고서 가져오기
    # Yahoo Finance에서 종목 이름이 없을 경우 코드를 사용
    stock_name = info.get('shortName', code) 
    
    # 실시간 뉴스 (날짜순, 5개)
    news_items = fetch_naver_search(f'{stock_name} 주식', display=5, sort='date')
    
    # 애널리스트 보고서 대체 (키워드 추가하여 정확도순, 5개)
    # 네이버 뉴스 API를 사용하여 '보고서' 키워드와 함께 검색
    report_items = fetch_naver_search(f'{stock_name} 애널리스트 보고서', display=5, sort='sim')
    
    
    # 3. 최종 결과 포맷팅 및 병합
    
    formatted_news = [format_naver_item(item) for item in news_items]
    formatted_reports = [format_naver_item(item) for item in report_items]


    # 4. 최종 결과 반환
    final_response = {
        "price": realtime_data["price"],
        "change": realtime_data["change"],
        "rate": realtime_data["rate"],
        "news": formatted_news,
        "reports": formatted_reports,
        # 공시 정보는 DART 링크로 대체
        "disclosure": [
            {"title": f"{stock_name} (DART)", "link": f"https://dart.fss.or.kr/dsac001/main.do?&textCrpNm={stock_name}"}
        ]
    }

    return jsonify(final_response)

if __name__ == '__main__':
    # 로컬 테스트를 위한 더미 키 설정 (실제 환경 변수가 없으면)
    if not NAVER_CLIENT_ID:
        os.environ['NAVER_CLIENT_ID'] = 'LOCAL_ID'
        os.environ['NAVER_CLIENT_SECRET'] = 'LOCAL_SECRET'
        NAVER_CLIENT_ID = 'LOCAL_ID'
        NAVER_CLIENT_SECRET = 'LOCAL_SECRET'

    app.run(debug=True, host='0.0.0.0', port=5000)