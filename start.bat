@echo off
setlocal
cd /d "%~dp0"

if not exist "package.json" (
  echo ERROR: package.json not found. Place start.bat inside the storewatch folder.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    echo Creating .env from .env.example...
    copy /y ".env.example" ".env" >nul
  )
)

if exist ".env" (
  findstr /b /c:"VIDEOS_REDDIT_SUBREDDITS=" ".env" >nul || (
    echo VIDEOS_REDDIT_SUBREDDITS=oddlysatisfying,RoyalMatch,Unity3D,MobileGameDiscoveries,MobileGaming,gamedev>>".env"
  )
  findstr /b /c:"VIDEOS_YOUTUBE_CHANNELS=" ".env" >nul || (
    echo VIDEOS_YOUTUBE_CHANNELS=https://www.youtube.com/@musthavegames_androidgameplay>>".env"
  )
)

if not exist "node_modules\" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Using SQLite database file: prisma\dev.db ^(no Postgres/Docker needed^)
echo.

echo Syncing Prisma client and schema...
call npx prisma generate
if errorlevel 1 (
  echo prisma generate failed. Trying fallback generate --no-engine...
  call npx prisma generate --no-engine
  if errorlevel 1 (
    echo prisma generate fallback failed. Close VS Code/Cursor/terminals using the app, then retry.
    pause
    exit /b 1
  )
)

call npm run db:push -- --skip-generate
if errorlevel 1 (
  echo prisma db push failed.
  pause
  exit /b 1
)

echo.
echo Starting Storewatch...
echo Open in your browser:  http://localhost:3000
echo Press Ctrl+C to stop the server.
echo.

call npm run dev

pause
