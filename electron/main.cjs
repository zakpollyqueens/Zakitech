const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
let mainWindow;
let speechProcess = null;
function stopNativeSpeech() { if (speechProcess && !speechProcess.killed) { try { speechProcess.kill(); } catch (_) {} } speechProcess = null; }
function speakWithWindowsVoice(options = {}) {
  const text = String(options.text || '').trim();
  if (!text) return Promise.resolve({ ok: true });
  if (process.platform !== 'win32') return Promise.reject(new Error('Native Molano speech is available in the Windows desktop release.'));
  if (text.length > 12000) return Promise.reject(new Error('The spoken reply is too long.'));
  stopNativeSpeech();
  const encodedText = Buffer.from(text, 'utf8').toString('base64');
  const requestedLang = String(options.lang || 'en-US').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 16) || 'en-US';
  const encodedLang = Buffer.from(requestedLang, 'utf8').toString('base64');
  const script = [
    "$ErrorActionPreference = 'Stop'", 'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    "$lang = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + encodedLang + "'))",
    "$voice = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like ($lang + '*') } | Select-Object -First 1",
    'if ($voice) { $s.SelectVoice($voice.VoiceInfo.Name) }', '$s.Rate = 0', '$s.Volume = 100',
    "$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + encodedText + "'))",
    '$s.Speak($text)', '$s.Dispose()'
  ].join('; ');
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    speechProcess = child; let errorText = '';
    child.stderr.on('data', chunk => { errorText += chunk.toString(); });
    child.on('error', error => { if (speechProcess === child) speechProcess = null; reject(new Error('Windows speech engine could not start: ' + error.message)); });
    child.on('close', code => { if (speechProcess === child) speechProcess = null; if (code === 0) resolve({ ok: true }); else if (code === null) resolve({ ok: true, stopped: true }); else reject(new Error(errorText.trim().slice(0, 500) || 'Windows speech engine exited with code ' + code)); });
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 940, minWidth: 960, minHeight: 640, backgroundColor: '#06152b', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://') || url.startsWith('mailto:')) shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('closed', () => { stopNativeSpeech(); mainWindow = null; });
}
ipcMain.handle('molano-tts:speak', (_event, options) => speakWithWindowsVoice(options));
ipcMain.handle('molano-tts:stop', () => { stopNativeSpeech(); return { ok: true }; });
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('before-quit', stopNativeSpeech);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
