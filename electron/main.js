const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;
let loadingWindow;

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  loadingWindow.loadURL(`data:text/html,
    <html>
    <head><style>
      body { 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex; justify-content: center; align-items: center;
        height: 100vh; margin: 0; font-family: Arial, sans-serif;
      }
      .container { text-align: center; color: white; }
      .spinner { 
        width: 50px; height: 50px; 
        border: 4px solid rgba(255,255,255,0.3);
        border-top: 4px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      h2 { margin: 0 0 10px; font-size: 24px; }
      p { margin: 0; font-size: 14px; opacity: 0.8; }
    </style></head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h2>AI Agent</h2>
        <p>正在启动服务...</p>
      </div>
    </body>
    </html>
  `);
}

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'AI Agent',
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const isPackaged = process.env.NODE_ENV === 'production';
    
    if (isPackaged) {
      const frontendPath = path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');
      console.log('Loading frontend from:', frontendPath);
      mainWindow.loadFile(frontendPath).catch(err => {
        console.error('Failed to load frontend:', err);
      });
    } else {
      mainWindow.loadURL('http://localhost:5174');
      mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Frontend loaded successfully');
      if (loadingWindow) {
        loadingWindow.close();
        loadingWindow = null;
      }
      mainWindow.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (error) {
    console.error('Error creating window:', error);
  }
}

function startBackend() {
  const isPackaged = process.env.NODE_ENV === 'production';
  let nodePath;
  let backendPath;
  let backendCwd;
  
  if (isPackaged) {
    nodePath = process.execPath;
    backendCwd = path.join(process.resourcesPath, 'backend');
    backendPath = path.join(backendCwd, 'dist', 'index.js');
  } else {
    nodePath = 'node';
    backendCwd = path.join(__dirname, '../backend');
    backendPath = path.join(backendCwd, 'dist', 'index.js');
  }
  
  console.log('=== Backend Startup ===');
  console.log('isPackaged:', isPackaged);
  console.log('nodePath:', nodePath);
  console.log('backendPath:', backendPath);
  console.log('backendCwd:', backendCwd);
  console.log('resourcesPath:', process.resourcesPath);
  
  const fs = require('fs');
  if (fs.existsSync(backendPath)) {
    console.log('✅ Backend file exists');
  } else {
    console.error('❌ Backend file not found:', backendPath);
    return;
  }
  
  try {
    backendProcess = spawn(nodePath, [backendPath], {
      cwd: backendCwd,
      shell: false,
      stdio: ['inherit', 'inherit', 'inherit'],
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    backendProcess.stdout.on('data', (data) => {
      console.log('Backend stdout:', data.toString().trim());
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error('Backend stderr:', data.toString().trim());
    });
    
    backendProcess.on('error', (err) => {
      console.error('Backend process error:', err.message);
    });
    
    backendProcess.on('exit', (code) => {
      console.log('Backend process exited with code:', code);
      if (code !== 0 && code !== null) {
        console.error('Backend crashed, attempting restart...');
        setTimeout(startBackend, 5000);
      }
    });
    
    console.log('✅ Backend process spawned successfully');
  } catch (error) {
    console.error('Failed to start backend:', error.message);
  }
}

app.whenReady().then(() => {
  console.log('App is ready...');
  
  // 先显示加载窗口，让用户知道应用正在启动
  createLoadingWindow();
  
  // 启动后端服务
  startBackend();
  
  // 等待后端启动后创建主窗口（减少等待时间）
  setTimeout(() => {
    console.log('Creating main window...');
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});