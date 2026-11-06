@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js kurulu degil. https://nodejs.org adresinden LTS surumunu kur. & pause & exit /b)
if not exist node_modules (echo Bagimliliklar kuruluyor... & call npm install --omit=dev)
start "" http://localhost:3000
node server/index.js
pause
