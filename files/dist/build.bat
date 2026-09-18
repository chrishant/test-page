@echo off
setlocal

echo === Printer Share: building standalone .exe ===
echo.

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo [2/4] Compiling to dist\PrinterShare.exe ...
call npx pkg . --targets node18-win-x64 --output dist\PrinterShare.exe
if errorlevel 1 goto :error

echo.
echo [3/4] Locating the SumatraPDF binary to copy alongside the .exe...
if not exist dist\bin mkdir dist\bin

for /f "delims=" %%i in ('node locate-sumatra.js') do set SUMATRA_PATH=%%i
if "%SUMATRA_PATH%"=="" (
  echo Could not locate SumatraPDF.exe automatically.
  echo Run "node locate-sumatra.js" yourself to see the error, then copy the
  echo file it points to into dist\bin\SumatraPDF.exe manually.
  goto :error
)

copy /Y "%SUMATRA_PATH%" "dist\bin\SumatraPDF.exe" >nul
echo Copied: %SUMATRA_PATH%
echo     to: dist\bin\SumatraPDF.exe

echo.
echo [4/4] Done!
echo.
echo Your standalone app is ready at:  dist\PrinterShare.exe
echo The dist\bin folder must stay next to it — copy the whole "dist"
echo folder (rename it if you like) to share or move the app.
echo.
pause
exit /b 0

:error
echo.
echo Build failed — see the error above.
pause
exit /b 1
