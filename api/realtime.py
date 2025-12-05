from flask import Flask, jsonify
import requests
import yfinance as yf
import os

app = Flask(__name__)
# 한글이 깨지지 않게 설정하는 부분입니다
app.config['JSON_AS_ASCII'] = False

@app.route('/')
def home():
    return "Hello! 주식 대시보드 서버가 정상 작동 중입니다."

# 테스트용 API
@app.route('/api/test')
def test():
    return jsonify({"message": "테스트 성공! 한글도 잘 나옵니다."})