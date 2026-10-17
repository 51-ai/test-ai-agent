$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
cd "c:\Users\51\Documents\trae_projects\test--ai agent"
npm run build:frontend
npx electron-builder --win --x64 --publish never