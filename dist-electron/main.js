"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("node:path");
const electron_1 = require("electron");
const node_child_process_1 = require("node:child_process");
const fs = require("fs");
function getPythonDir() {
    if (process.env.VITE_DEV_SERVER_URL) {
        return path.join(__dirname, '../python');
    }
    return path.join(process.resourcesPath, 'python');
}
let packagedServerProcess = null;
function startPackagedServer() {
    try {
        const exeName = process.platform === 'win32' ? 'scheduler_api.exe' : 'scheduler_api';
        const serverExe = path.join(process.resourcesPath, 'server', exeName);
        if (fs.existsSync(serverExe)) {
            packagedServerProcess = (0, node_child_process_1.spawn)(serverExe, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
            packagedServerProcess.stdout?.on('data', (d) => console.log('[server]', d.toString()));
            packagedServerProcess.stderr?.on('data', (d) => console.error('[server]', d.toString()));
            packagedServerProcess.on('exit', (code) => { console.log('Packaged server exited', code); packagedServerProcess = null; });
            console.log('Started packaged server:', serverExe);
        }
        else {
            console.log('Packaged server exe not found at', serverExe);
        }
    }
    catch (e) {
        console.error('Failed to start packaged server', e);
    }
}
function createWindow() {
    const { workAreaSize } = electron_1.screen.getPrimaryDisplay();
    const maxWidth = Math.floor(workAreaSize.width / 1.5);
    const maxHeight = Math.floor(workAreaSize.height / 1.5);
    const win = new electron_1.BrowserWindow({
        width: Math.min(1074, maxWidth),
        height: Math.min(540, maxHeight),
        useContentSize: true,
        minWidth: 400,
        minHeight: 480,
        maxWidth,
        maxHeight,
        show: true,
        alwaysOnTop: false,
        autoHideMenuBar: true,
        frame: false, // 隐藏系统框架，使用自定义顶栏
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    // 窗口控制 IPC 处理
    electron_1.ipcMain.handle('window:minimize', () => {
        win.minimize();
    });
    electron_1.ipcMain.handle('window:maximize', () => {
        if (win.isMaximized()) {
            win.unmaximize();
        }
        else {
            win.maximize();
        }
    });
    electron_1.ipcMain.handle('window:close', () => {
        win.close();
    });
    electron_1.ipcMain.handle('window:isMaximized', () => {
        return win.isMaximized();
    });
    electron_1.ipcMain.handle('window:openExternal', (_e, url) => {
        if (url) {
            electron_1.shell.openExternal(url);
        }
    });
    // crawler IPC handlers
    electron_1.ipcMain.handle('crawler:get-homeworks', async () => {
        const filePath = path.join(getPythonDir(), 'upcoming_homeworks.json');
        if (fs.existsSync(filePath)) {
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(raw);
            }
            catch (err) {
                console.error('Failed to parse upcoming_homeworks.json', err);
                return [];
            }
        }
        return [];
    });
    electron_1.ipcMain.handle('crawler:get-courses', async () => {
        const filePath = path.join(getPythonDir(), 'courses_config.json');
        if (fs.existsSync(filePath)) {
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(raw);
            }
            catch (err) {
                console.error('Failed to parse courses_config.json', err);
                return [];
            }
        }
        return [];
    });
    electron_1.ipcMain.handle('crawler:save-courses', async (_e, courses) => {
        const filePath = path.join(getPythonDir(), 'courses_config.json');
        try {
            fs.writeFileSync(filePath, JSON.stringify(courses, null, 4), 'utf-8');
            return { success: true };
        }
        catch (err) {
            console.error('Failed to save courses_config.json', err);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('crawler:run-scripts', async () => {
        const pythonDir = getPythonDir();
        const scripts = ['头歌爬虫.py', '处理数据.py', '筛选作业.py'];
        const outputPath = path.join(pythonDir, 'upcoming_homeworks.json');
        try {
            for (const script of scripts) {
                const scriptPath = path.join(pythonDir, script);
                console.log(`Running crawler script: ${scriptPath}`);
                let outputLog = '';
                await new Promise((resolve, reject) => {
                    const childProcess = (0, node_child_process_1.spawn)('python', [scriptPath], {
                        cwd: pythonDir,
                        stdio: ['ignore', 'pipe', 'pipe'],
                        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                    });
                    childProcess.stdout.on('data', (d) => {
                        const str = d.toString();
                        console.log(`[${script}]`, str);
                        outputLog += str;
                    });
                    childProcess.stderr.on('data', (d) => {
                        const str = d.toString();
                        console.error(`[${script}] error:`, str);
                        outputLog += str;
                    });
                    childProcess.on('close', (code) => {
                        if (code === 0)
                            resolve();
                        else {
                            reject(new Error(outputLog.trim() || `脚本 ${script} 退出，状态码: ${code}`));
                        }
                    });
                    childProcess.on('error', (err) => {
                        reject(new Error(`启动脚本 ${script} 失败: ${err.message}`));
                    });
                });
            }
            if (fs.existsSync(outputPath)) {
                const data = fs.readFileSync(outputPath, 'utf-8');
                return { success: true, data: JSON.parse(data) };
            }
            else {
                throw new Error('未找到 upcoming_homeworks.json 文件');
            }
        }
        catch (error) {
            console.error('爬虫脚本执行失败:', error);
            return { success: false, error: error.message };
        }
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
        // win.webContents.openDevTools({ mode: 'detach' }) // 不再自动打开开发者工具
    }
    else {
        // When packaged, prefer a dist folder copied to resources via extraResources.
        const indexPath = electron_1.app.isPackaged ? path.join(process.resourcesPath, 'dist', 'index.html') : path.join(__dirname, '../dist/index.html');
        win.loadFile(indexPath);
    }
    electron_1.ipcMain.handle('window:setAlwaysOnTop', (_e, flag) => {
        win.setAlwaysOnTop(Boolean(flag), 'floating');
        return win.isAlwaysOnTop();
    });
    electron_1.ipcMain.handle('window:toggleAlwaysOnTop', () => {
        win.setAlwaysOnTop(!win.isAlwaysOnTop(), 'floating');
        return win.isAlwaysOnTop();
    });
    // open generate schedule window (can be called from renderer)
    electron_1.ipcMain.handle('generate:openWindow', () => {
        const genWin = new electron_1.BrowserWindow({
            width: Math.min(1100, maxWidth),
            height: Math.min(700, maxHeight),
            minWidth: 800,
            minHeight: 480,
            show: true,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            }
        });
        if (process.env.VITE_DEV_SERVER_URL) {
            genWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/generate`);
        }
        else {
            const genIndexPath = electron_1.app.isPackaged ? path.join(process.resourcesPath, 'dist', 'index.html') : path.join(__dirname, '../dist/index.html');
            console.log('generate:openWindow loading file:', genIndexPath);
            genWin.loadFile(genIndexPath, { hash: '/generate' });
        }
        return true;
    });
    // mock generation handler - in future call Python backend
    electron_1.ipcMain.handle('generate:request', async (_e, payload) => {
        const logFile = path.join(process.cwd(), 'main_process_generate_log.txt');
        fs.appendFileSync(logFile, `${new Date().toISOString()}: generate:request handler called with weekStart: ${payload?.weekStart}\n`);
        // prefer HTTP backend if available (scheduler_api)
        try {
            const url = 'http://127.0.0.1:8765/generate';
            fs.appendFileSync(logFile, `${new Date().toISOString()}: attempting HTTP to ${url}\n`);
            // immediate refetch handler for user-initiated 'wait' action
            electron_1.ipcMain.handle('generate:forceRefetch', async (_e2, p) => {
                try {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 120000);
                    const r = await fetch(url, { method: 'POST', body: JSON.stringify(p || payload), headers: { 'Content-Type': 'application/json' }, signal: controller.signal });
                    clearTimeout(timer);
                    if (r.ok)
                        return { ok: true, json: await r.json() };
                    return { ok: false, error: `http ${r.status}` };
                }
                catch (err) {
                    const error = err;
                    return { ok: false, error: error?.message };
                }
            });
            // Try HTTP fetch up to 3 times with increasing timeouts before falling back
            const timeouts = [150000, 180000, 200000];
            let lastErr = null;
            for (let attempt = 0; attempt < timeouts.length; attempt++) {
                const attemptStart = Date.now();
                const timeoutMs = timeouts[attempt];
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    fs.appendFileSync(logFile, `${new Date().toISOString()}: attempt ${attempt + 1} starting fetch\n`);
                    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json', 'Connection': 'close' }, signal: controller.signal });
                    clearTimeout(timer);
                    const took = Date.now() - attemptStart;
                    if (res.ok) {
                        fs.appendFileSync(logFile, `${new Date().toISOString()}: attempt ${attempt + 1} res.ok, status ${res.status}, took ${took}ms\n`);
                        console.log('generate:request res.ok, status', res.status, 'content-length', res.headers.get('content-length'));
                        try {
                            const jsonPromise = res.json();
                            const json = await Promise.race([jsonPromise, new Promise((_, reject) => setTimeout(() => reject(new Error('res.json timeout')), 60000))]);
                            fs.appendFileSync(logFile, `${new Date().toISOString()}: attempt ${attempt + 1} json parsed, weekStart: ${json?.weekStart}\n`);
                            console.log('generate:request json parsed, weekStart', json.weekStart);
                            // preserve provisional flag if backend returned a provisional mock
                            const meta = { source: 'deepseek' };
                            if (json && json.__meta && json.__meta.provisional) {
                                meta.provisional = true;
                                if (json.__meta.error)
                                    meta.error = json.__meta.error;
                            }
                            const result = { ...json, __meta: meta }; // full result now
                            fs.appendFileSync(logFile, `${new Date().toISOString()}: attempt ${attempt + 1} about to return result: ${JSON.stringify(result)}\n`);
                            console.log('generate:request about to return result', result);
                            return result;
                        }
                        catch (e) {
                            fs.appendFileSync(logFile, `${new Date().toISOString()}: attempt ${attempt + 1} res.json failed: ${e.message}\n`);
                            console.error('generate:request res.json failed', e);
                            throw e;
                        }
                    }
                    else {
                        const text = await res.text().catch(() => '');
                        fs.appendFileSync(logFile, `${new Date().toISOString()}: attempt ${attempt + 1} non-ok status ${res.status}, took ${took}ms\n`);
                        console.warn('generate:request http returned non-ok', res.status, text.slice(0, 200), 'attempt:', attempt + 1, 'tookMs:', took);
                        lastErr = new Error(`http non-ok ${res.status}`);
                        // try next attempt
                    }
                }
                catch (err) {
                    clearTimeout(timer);
                    const took = Date.now() - attemptStart;
                    fs.appendFileSync(logFile, `${new Date().toISOString()}: attempt ${attempt + 1} failed: ${err.message}, took ${took}ms\n`);
                    console.warn('generate:request http call attempt failed', { name: err?.name, message: err?.message, attempt: attempt + 1, timeoutMs, took });
                    lastErr = err;
                    // try next attempt unless it was the last
                }
            }
            fs.appendFileSync(logFile, `${new Date().toISOString()}: all attempts failed, falling back to spawn\n`);
            // if we reach here, both attempts failed
            console.warn('generate:request http failed after retries, will fallback to python spawn/mock', lastErr?.message);
        }
        catch (err) {
            fs.appendFileSync(logFile, `${new Date().toISOString()}: unexpected error before attempts: ${err.message}\n`);
            console.warn('generate:request unexpected error before http attempts, falling back to python spawn/mock:', err?.message);
        }
        // try to call python backend via spawn: python python/scheduler.py
        try {
            fs.appendFileSync(logFile, `${new Date().toISOString()}: starting python spawn\n`);
            const scriptPath = path.join(getPythonDir(), 'scheduler.py');
            // spawn python if script exists
            const res = await new Promise((resolve, reject) => {
                const proc = (0, node_child_process_1.spawn)('python', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
                let stdout = '';
                let stderr = '';
                const timer = setTimeout(() => {
                    proc.kill();
                    reject(new Error('Python scheduler timeout'));
                }, 20000);
                proc.stdout.on('data', d => stdout += d.toString());
                proc.stderr.on('data', d => stderr += d.toString());
                proc.on('error', err => { clearTimeout(timer); reject(err); });
                proc.on('close', (code) => {
                    clearTimeout(timer);
                    if (code !== 0)
                        return reject(new Error(`python exit ${code}: ${stderr}`));
                    try {
                        const parsed = JSON.parse(stdout);
                        resolve(parsed);
                    }
                    catch (e) {
                        reject(new Error('invalid json from python: ' + e.message));
                    }
                });
                // write payload to stdin
                try {
                    proc.stdin.write(JSON.stringify(payload));
                    proc.stdin.end();
                }
                catch (e) {
                    // ignore
                }
            });
            fs.appendFileSync(logFile, `${new Date().toISOString()}: python spawn returned: ${JSON.stringify(res).slice(0, 200)}\n`);
            console.log('generate:request python result', res && res.weekStart);
            // preserve provisional flag from python result when returning to renderer
            const provisionalFlag = res && res.__meta && res.__meta.provisional;
            const provisionalError = res && res.__meta && res.__meta.error;
            const returnedMeta = { source: 'python', provisional: true };
            if (provisionalFlag)
                returnedMeta.provisional = returnedMeta.provisional || true;
            if (provisionalError)
                returnedMeta.error = provisionalError;
            (async function backgroundRefetch() {
                try {
                    const url = 'http://127.0.0.1:8765/generate';
                    const attempts = 3;
                    for (let i = 0; i < attempts; i++) {
                        try {
                            const controller = new AbortController();
                            const timeoutMs = 180000; // allow more time for backend to finish
                            const timer = setTimeout(() => controller.abort(), timeoutMs);
                            const r = await fetch(url, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' }, signal: controller.signal });
                            clearTimeout(timer);
                            if (r.ok) {
                                const json = await r.json();
                                console.log('generate:request background refetch success, broadcasting update', json && json.weekStart);
                                electron_1.BrowserWindow.getAllWindows().forEach(w => w.webContents.send('generate:updated', { ...json, __meta: { source: 'deepseek', updated: true } }));
                                return;
                            }
                            else {
                                const text = await r.text().catch(() => '');
                                console.log('generate:request background refetch non-ok', r.status, text.slice(0, 200));
                            }
                        }
                        catch (e) {
                            console.log('generate:request background refetch attempt failed', i + 1, e?.message);
                        }
                        await new Promise(r => setTimeout(r, 10000));
                    }
                    console.log('generate:request background refetch exhausted attempts');
                }
                catch (e) {
                    console.error('generate:request background refetch error', e?.message);
                }
            })();
            return { ...res, __meta: returnedMeta };
        }
        catch (err) {
            fs.appendFileSync(logFile, `${new Date().toISOString()}: python spawn failed: ${err.message}\n`);
            console.warn('generate:request python call failed, falling back to mock', err?.message);
        }
        // fallback mock
        fs.appendFileSync(logFile, `${new Date().toISOString()}: falling back to mock\n`);
        const timeSlots = [
            '08:00', '09:40', '10:20', '12:00', '14:30', '16:10', '18:00', '19:40', '21:20', '22:00', '23:00', '00:00'
        ];
        const days = [];
        for (let d = 1; d <= 7; d++) {
            const slots = [];
            for (let s = 0; s < 2; s++) {
                const t = timeSlots[(d + s) % timeSlots.length];
                slots.push({ time: t, activity: `示例任务 ${d}-${s + 1}`, durationHours: 1, notes: '', taskName: `示例任务 ${d}-${s + 1}`, taskId: '' });
            }
            days.push({ date: '', weekday: d, slots });
        }
        return { weekStart: new Date().toISOString().slice(0, 10), days, taskSummary: [], conflicts: [], __meta: { source: 'mock', provisional: true } };
    });
    electron_1.ipcMain.handle('generate:basicRequest', async (_e, payload) => {
        console.log('main.ts: generate:basicRequest called with payload', payload);
        // prefer HTTP backend if available (scheduler_api)
        try {
            const url = 'http://127.0.0.1:8765/generate/basic';
            console.log('main.ts: generate:basicRequest trying HTTP to', url);
            // Try HTTP fetch with reasonable timeout
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);
            const start = Date.now();
            try {
                const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' }, signal: controller.signal });
                clearTimeout(timer);
                const took = Date.now() - start;
                if (res.ok) {
                    const json = await res.json();
                    console.log('generate:basicRequest http result', json && json.weekStart, 'response sample:', JSON.stringify(json).slice(0, 800), 'tookMs:', took);
                    return json;
                }
                else {
                    const text = await res.text();
                    console.warn('generate:basicRequest http returned non-ok', res.status, text.slice(0, 200));
                }
            }
            catch (err) {
                console.warn('generate:basicRequest http call failed', { name: err?.name, message: err?.message });
            }
        }
        catch (err) {
            console.warn('generate:basicRequest unexpected error before http attempts, falling back to python spawn/mock:', err?.message);
        }
        console.log('main.ts: generate:basicRequest falling back to mock');
        // fallback mock for basic
        const timeSlots = [
            '08:00', '09:40', '10:20', '12:00', '14:30', '16:10', '18:00', '19:40', '21:20', '22:00', '23:00', '00:00'
        ];
        const days = [];
        for (let d = 1; d <= 7; d++) {
            const slots = [];
            for (let s = 0; s < 2; s++) {
                const t = timeSlots[(d + s) % timeSlots.length];
                slots.push({ time: t, activity: `基础任务 ${d}-${s + 1}`, durationHours: 1, notes: '', taskName: `基础任务 ${d}-${s + 1}`, taskId: '' });
            }
            days.push({ date: '', weekday: d, slots });
        }
        return { weekStart: new Date().toISOString().slice(0, 10), days, taskSummary: [], conflicts: [], __meta: { source: 'basic', fallback: true } };
    });
    // allow renderer to request that its own window be closed
    electron_1.ipcMain.handle('window:closeMe', (event) => {
        try {
            const win = electron_1.BrowserWindow.fromWebContents(event.sender);
            if (win) {
                win.close();
                return true;
            }
        }
        catch (e) {
            console.error('window:closeMe error', e);
        }
        return false;
    });
    // notify other windows that calendar data changed (payload: { weekStart })
    electron_1.ipcMain.handle('calendar:notifyUpdated', (event, payload) => {
        try {
            electron_1.BrowserWindow.getAllWindows().forEach(w => {
                // send to all windows including sender — renderer can decide to ignore
                w.webContents.send('calendar:updated', payload);
            });
            return true;
        }
        catch (e) {
            console.error('calendar:notifyUpdated error', e);
            return false;
        }
    });
}
electron_1.app.whenReady().then(() => {
    startPackagedServer();
    // === 注册主题文件操作 IPC ===
    electron_1.ipcMain.handle('theme:get-themes', async () => {
        const fs = require('fs');
        const path = require('path');
        let colorsDir = path.join(__dirname, '../src/assets/colors');
        if (!fs.existsSync(colorsDir)) {
            colorsDir = path.join(__dirname, '../../src/assets/colors');
        }
        if (!fs.existsSync(colorsDir))
            return {};
        const themes = {};
        try {
            const files = fs.readdirSync(colorsDir);
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'defaults.json') {
                    const content = fs.readFileSync(path.join(colorsDir, file), 'utf-8');
                    const name = file.replace('.json', '');
                    let parsed = {};
                    try {
                        parsed = JSON.parse(content);
                    }
                    catch (e) { }
                    themes[name] = parsed[name] || parsed;
                }
            }
        }
        catch (e) {
            console.error('读取主题文件失败', e);
        }
        return themes;
    });
    electron_1.ipcMain.handle('theme:save-theme', async (_e, name, themeData) => {
        const fs = require('fs');
        const path = require('path');
        let colorsDir = path.join(__dirname, '../src/assets/colors');
        if (!fs.existsSync(colorsDir)) {
            colorsDir = path.join(__dirname, '../../src/assets/colors');
        }
        if (!fs.existsSync(colorsDir)) {
            try {
                fs.mkdirSync(colorsDir, { recursive: true });
            }
            catch (e) { }
        }
        try {
            const filePath = path.join(colorsDir, `${name}.json`);
            const saveObj = { [name]: themeData };
            fs.writeFileSync(filePath, JSON.stringify(saveObj, null, 2), 'utf-8');
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('theme:delete-theme', async (_e, name) => {
        const fs = require('fs');
        const path = require('path');
        let colorsDir = path.join(__dirname, '../src/assets/colors');
        if (!fs.existsSync(colorsDir)) {
            colorsDir = path.join(__dirname, '../../src/assets/colors');
        }
        try {
            const target = path.join(colorsDir, `${name}.json`);
            if (fs.existsSync(target)) {
                fs.unlinkSync(target);
            }
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    createWindow();
    // 拦截所有通过 target="_blank" 打开的新窗口请求，改用系统默认浏览器打开
    electron_1.app.on('web-contents-created', (_, contents) => {
        contents.setWindowOpenHandler(({ url }) => {
            // 在系统默认浏览器中打开链接
            electron_1.shell.openExternal(url);
            // 阻止 Electron 创建新窗口
            return { action: 'deny' };
        });
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('before-quit', () => {
    if (packagedServerProcess) {
        try {
            packagedServerProcess.kill();
        }
        catch (e) { }
    }
});
