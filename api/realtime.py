# Vercel Serverless Function을 위한 Python 코드
# Flask와 달리, Vercel의 요청 객체를 사용합니다.

import yfinance as yf
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# 야후 심볼을 생성하는 헬퍼 함수
# Vercel 프로젝트의 stock-app에서 미리 정의된 KOSPI/KOSDAQ 코드를 이용해야 하지만,
# 여기서는 심플하게 KOSDAQ 종목 심볼을 기본값으로 사용합니다.
# 실제 DB가 없으므로 종목 코드를 기준으로 시장을 임의로 결정할 수 없습니다.
def get_yahoo_symbol(code, market="KOSDAQ"):
    """종목 코드와 시장을 기반으로 야후 심볼을 생성합니다."""
    # 실제 앱에서는 KOSPI/KOSDAQ 종목 목록을 서버 DB에 저장하고 market 정보를 넘겨야 합니다.
    suffix = '.KQ' if market == 'KOSDAQ' else '.KS' 
    return f"{code}{suffix}"

def handler(request, response):
    """
    Vercel Serverless Function의 진입점(Entry Point).
    /api/realtime?code=247540 와 같은 쿼리를 처리합니다.
    """
    
    # 쿼리 파라미터 추출
    query_params = parse_qs(urlparse(request.url).query)
    stock_code = query_params.get('code', [None])[0]

    if not stock_code:
        response.status = 400
        response.send_header('Content-type', 'application/json')
        response.end_headers()
        response.wfile.write(json.dumps({"error": "Stock code 'code' is required."}).encode())
        return

    # KOSDAQ 종목 심볼 (247540 -> 247540.KQ)
    # NOTE: 실제 KOSPI 종목 코드를 넣을 경우, 시장 정보를 함께 넘겨줘야 정확히 작동합니다.
    # 예시를 위해 KOSDAQ으로 고정합니다.
    yahoo_symbol = get_yahoo_symbol(stock_code, "KOSDAQ") 
    
    # CORS 헤더 설정 (매우 중요: HTML 파일이 데이터를 요청할 수 있도록 허용)
    response.send_header('Access-Control-Allow-Origin', '*')
    response.send_header('Access-Control-Allow-Methods', 'GET')
    response.send_header('Access-Control-Allow-Headers', 'Content-Type')


    try:
        # yfinance를 사용하여 데이터 요청
        ticker = yf.Ticker(yahoo_symbol)
        data = ticker.fast_info 
        
        # yfinance에서 제공하는 데이터를 클라이언트가 이해할 수 있는 JSON 형태로 가공
        current_price = data.last_price
        previous_close = data.previous_close
        
        # 등락액 및 등락률 계산
        change = current_price - previous_close
        rate = (change / previous_close) * 100 if previous_close else 0
        
        # 응답 데이터
        response_data = {
            "code": stock_code,
            "price": round(current_price),
            "change": round(change), 
            "rate": round(rate, 2)
        }
        
        response.status = 200
        response.send_header('Content-type', 'application/json')
        response.end_headers()
        response.wfile.write(json.dumps(response_data).encode())

    except Exception as e:
        print(f"Error fetching data for {yahoo_symbol}: {e}")
        response.status = 500
        response.send_header('Content-type', 'application/json')
        response.end_headers()
        response.wfile.write(json.dumps({"error": f"Data fetch failed: {str(e)}"}).encode())
        
# Vercel 환경에서 요청을 처리하기 위한 메인 함수 (Flask 아님)
def main(request, response):
    """Vercel entry point adapter"""
    # BaseHTTPRequestHandler를 상속받지 않는 환경을 위한 단순화된 핸들링
    class DummyHandler(BaseHTTPRequestHandler):
        def __init__(self, request, response):
            self.rfile = request.rfile
            self.wfile = response.wfile
            self.headers = request.headers
            self.command = request.method
            self.path = request.url
            self.url = request.url
            self.raw_requestline = b''
            self.client_address = ('', 0)
            self.request_version = 'HTTP/1.1'
            self.close_connection = True
            
            # 응답 객체에 필요한 속성 추가 (status, send_header, end_headers, wfile)
            response.status = 200
            response.send_header = lambda name, value: response.headers.append((name, value))
            response.end_headers = lambda: None # Vercel 환경에서는 헤더를 수동으로 끝낼 필요 없음
            
            handler(request, response)

    DummyHandler(request, response)