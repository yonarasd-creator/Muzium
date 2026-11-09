@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js kurulu degil. https://nodejs.org adresinden LTS surumunu kur, sonra bu dosyayi tekrar calistir. & pause & exit /b)
echo Bagimliliklar kuruluyor (ilk seferde birkac dakika surebilir)...
call npm install || (echo npm install basarisiz oldu. & pause & exit /b)
echo Kurulum dosyasi olusturuluyor...
call npm run dist || (echo Paketleme basarisiz oldu. & pause & exit /b)
echo.
echo Hazir! Kurulum dosyasi "dist" klasorunde: Yoni-Kurulum-*.exe
start "" "%~dp0dist"
pause
