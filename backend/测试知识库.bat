@echo off
chcp 65001 >nul
echo ============================================
echo   AI Agent 知识库测试脚本
echo ============================================
echo.

echo 🔍 正在启动测试...
echo.

set SERVER_URL=http://localhost:3000
set API_KEY=test-dev-key-12345

echo 📝 测试问题列表：
echo    1. 什么是春节？
echo    2. 怎么学英语？
echo    3. 推荐一些电影
echo    4. 如何缓解压力？
echo    5. 推荐一个旅游的地方
echo.

echo ============================================
echo.

echo 测试 1: 什么是春节？
curl -X POST "%SERVER_URL%/api/dev/chat" ^
  -H "Content-Type: application/json" ^
  -H "x-developer-key: %API_KEY%" ^
  -d "{\"message\":\"什么是春节？\"}" ^
  -s | findstr /C:"content"

echo.
echo ============================================
echo.

echo 测试 2: 怎么学英语？
curl -X POST "%SERVER_URL%/api/dev/chat" ^
  -H "Content-Type: application/json" ^
  -H "x-developer-key: %API_KEY%" ^
  -d "{\"message\":\"怎么学英语？\"}" ^
  -s | findstr /C:"content"

echo.
echo ============================================
echo.

echo 测试 3: 推荐一些电影
curl -X POST "%SERVER_URL%/api/dev/chat" ^
  -H "Content-Type: application/json" ^
  -H "x-developer-key: %API_KEY%" ^
  -d "{\"message\":\"推荐一些电影\"}" ^
  -s | findstr /C:"content"

echo.
echo ============================================
echo.

echo ✅ 测试完成！
echo.
echo 💡 如果上面显示了正确的回答，说明知识库已工作！
echo 💡 如果显示"无法连接"，请先启动服务器：
echo    npm start
echo.

pause
