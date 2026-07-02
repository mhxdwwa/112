@echo off
chcp 65001 >nul 2>nul

echo ============================================
echo   Upload to GitHub Pages
echo ============================================
echo.

git config --global user.email "mhxdwwa@users.noreply.github.com"
git config --global user.name "mhxdwwa"

git init
git add .
git commit -m "first commit" 2>nul

git remote remove origin 2>nul
git remote add origin https://github.com/mhxdwwa/112.git

git remote -v

echo.
echo Pushing to GitHub...
echo.

git push -u origin main --force 2>nul
if %errorlevel% neq 0 (
    git push -u origin master --force
)

echo.
echo ============================================
echo   Done!
echo   Your site: https://mhxdwwa.github.io/112/
echo ============================================
pause
