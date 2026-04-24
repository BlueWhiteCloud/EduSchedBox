"use strict";
const path = require("node:path");
const electron = require("electron");
const node_child_process = require("node:child_process");
const fs = require("fs");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
let packagedServerProcess = null;
function startPackagedServer() {
  var _a, _b;
  try {
    const exeName = process.platform === "win32" ? "scheduler_api.exe" : "scheduler_api";
    const serverExe = path__namespace.join(process.resourcesPath, "server", exeName);
    if (fs__namespace.existsSync(serverExe)) {
      packagedServerProcess = node_child_process.spawn(serverExe, [], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      (_a = packagedServerProcess.stdout) == null ? void 0 : _a.on("data", (d) => console.log("[server]", d.toString()));
      (_b = packagedServerProcess.stderr) == null ? void 0 : _b.on("data", (d) => console.error("[server]", d.toString()));
      packagedServerProcess.on("exit", (code) => {
        console.log("Packaged server exited", code);
        packagedServerProcess = null;
      });
      console.log("Started packaged server:", serverExe);
    } else {
      console.log("Packaged server exe not found at", serverExe);
    }
  } catch (e) {
    console.error("Failed to start packaged server", e);
  }
}
function createWindow() {
  const { workAreaSize } = electron.screen.getPrimaryDisplay();
  const maxWidth = Math.floor(workAreaSize.width / 1.5);
  const maxHeight = Math.floor(workAreaSize.height / 1.5);
  const win = new electron.BrowserWindow({
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
    frame: false,
    // 隐藏系统框架，使用自定义顶栏
    webPreferences: {
      preload: path__namespace.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  electron.ipcMain.handle("window:minimize", () => {
    win.minimize();
  });
  electron.ipcMain.handle("window:maximize", () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  electron.ipcMain.handle("window:close", () => {
    win.close();
  });
  electron.ipcMain.handle("window:isMaximized", () => {
    return win.isMaximized();
  });
  electron.ipcMain.handle("window:openExternal", (_e, url) => {
    if (url) {
      electron.shell.openExternal(url);
    }
  });
  electron.ipcMain.handle("crawler:get-homeworks", async () => {
    const filePath = path__namespace.join(electron.app.getAppPath(), "python", "upcoming_homeworks.json");
    if (fs__namespace.existsSync(filePath)) {
      try {
        const raw = fs__namespace.readFileSync(filePath, "utf-8");
        return JSON.parse(raw);
      } catch (err) {
        console.error("Failed to parse upcoming_homeworks.json", err);
        return [];
      }
    }
    return [];
  });
  electron.ipcMain.handle("crawler:get-courses", async () => {
    const filePath = path__namespace.join(electron.app.getAppPath(), "python", "courses_config.json");
    if (fs__namespace.existsSync(filePath)) {
      try {
        const raw = fs__namespace.readFileSync(filePath, "utf-8");
        return JSON.parse(raw);
      } catch (err) {
        console.error("Failed to parse courses_config.json", err);
        return [];
      }
    }
    return [];
  });
  electron.ipcMain.handle("crawler:save-courses", async (_e, courses) => {
    const filePath = path__namespace.join(electron.app.getAppPath(), "python", "courses_config.json");
    try {
      fs__namespace.writeFileSync(filePath, JSON.stringify(courses, null, 4), "utf-8");
      return { success: true };
    } catch (err) {
      console.error("Failed to save courses_config.json", err);
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("crawler:run-scripts", async () => {
    const pythonDir = path__namespace.join(electron.app.getAppPath(), "python");
    const scripts = ["头歌爬虫.py", "处理数据.py", "筛选作业.py"];
    const outputPath = path__namespace.join(pythonDir, "upcoming_homeworks.json");
    try {
      for (const script of scripts) {
        const scriptPath = path__namespace.join(pythonDir, script);
        console.log(`Running crawler script: ${scriptPath}`);
        let outputLog = "";
        await new Promise((resolve, reject) => {
          const childProcess = node_child_process.spawn("python", [scriptPath], {
            cwd: pythonDir,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, PYTHONIOENCODING: "utf-8" }
          });
          childProcess.stdout.on("data", (d) => {
            const str = d.toString();
            console.log(`[${script}]`, str);
            outputLog += str;
          });
          childProcess.stderr.on("data", (d) => {
            const str = d.toString();
            console.error(`[${script}] error:`, str);
            outputLog += str;
          });
          childProcess.on("close", (code) => {
            if (code === 0) resolve();
            else {
              reject(new Error(outputLog.trim() || `脚本 ${script} 退出，状态码: ${code}`));
            }
          });
          childProcess.on("error", (err) => {
            reject(new Error(`启动脚本 ${script} 失败: ${err.message}`));
          });
        });
      }
      if (fs__namespace.existsSync(outputPath)) {
        const data = fs__namespace.readFileSync(outputPath, "utf-8");
        return { success: true, data: JSON.parse(data) };
      } else {
        throw new Error("未找到 upcoming_homeworks.json 文件");
      }
    } catch (error) {
      console.error("爬虫脚本执行失败:", error);
      return { success: false, error: error.message };
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = electron.app.isPackaged ? path__namespace.join(process.resourcesPath, "dist", "index.html") : path__namespace.join(__dirname, "../dist/index.html");
    win.loadFile(indexPath);
  }
  electron.ipcMain.handle("window:setAlwaysOnTop", (_e, flag) => {
    win.setAlwaysOnTop(Boolean(flag), "floating");
    return win.isAlwaysOnTop();
  });
  electron.ipcMain.handle("window:toggleAlwaysOnTop", () => {
    win.setAlwaysOnTop(!win.isAlwaysOnTop(), "floating");
    return win.isAlwaysOnTop();
  });
  electron.ipcMain.handle("generate:openWindow", () => {
    const genWin = new electron.BrowserWindow({
      width: Math.min(1100, maxWidth),
      height: Math.min(700, maxHeight),
      minWidth: 800,
      minHeight: 480,
      show: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path__namespace.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    if (process.env.VITE_DEV_SERVER_URL) {
      genWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/generate`);
    } else {
      const genIndexPath = electron.app.isPackaged ? path__namespace.join(process.resourcesPath, "dist", "index.html") : path__namespace.join(__dirname, "../dist/index.html");
      console.log("generate:openWindow loading file:", genIndexPath);
      genWin.loadFile(genIndexPath, { hash: "/generate" });
    }
    return true;
  });
  electron.ipcMain.handle("generate:request", async (_e, payload) => {
    const logFile = path__namespace.join(process.cwd(), "main_process_generate_log.txt");
    fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: generate:request handler called with weekStart: ${payload == null ? void 0 : payload.weekStart}
`);
    try {
      const url = "http://127.0.0.1:8765/generate";
      fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: attempting HTTP to ${url}
`);
      electron.ipcMain.handle("generate:forceRefetch", async (_e2, p) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12e4);
          const r = await fetch(url, { method: "POST", body: JSON.stringify(p || payload), headers: { "Content-Type": "application/json" }, signal: controller.signal });
          clearTimeout(timer);
          if (r.ok) return { ok: true, json: await r.json() };
          return { ok: false, error: `http ${r.status}` };
        } catch (err) {
          const error = err;
          return { ok: false, error: error == null ? void 0 : error.message };
        }
      });
      const timeouts = [15e4, 18e4, 2e5];
      let lastErr = null;
      for (let attempt = 0; attempt < timeouts.length; attempt++) {
        const attemptStart = Date.now();
        const timeoutMs = timeouts[attempt];
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: attempt ${attempt + 1} starting fetch
`);
          const res = await fetch(url, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json", "Connection": "close" }, signal: controller.signal });
          clearTimeout(timer);
          const took = Date.now() - attemptStart;
          if (res.ok) {
            fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: attempt ${attempt + 1} res.ok, status ${res.status}, took ${took}ms
`);
            console.log("generate:request res.ok, status", res.status, "content-length", res.headers.get("content-length"));
            try {
              const jsonPromise = res.json();
              const json = await Promise.race([jsonPromise, new Promise((_, reject) => setTimeout(() => reject(new Error("res.json timeout")), 6e4))]);
              fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: attempt ${attempt + 1} json parsed, weekStart: ${json == null ? void 0 : json.weekStart}
`);
              console.log("generate:request json parsed, weekStart", json.weekStart);
              const meta = { source: "deepseek" };
              if (json && json.__meta && json.__meta.provisional) {
                meta.provisional = true;
                if (json.__meta.error) meta.error = json.__meta.error;
              }
              const result = { ...json, __meta: meta };
              fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: attempt ${attempt + 1} about to return result: ${JSON.stringify(result)}
`);
              console.log("generate:request about to return result", result);
              return result;
            } catch (e) {
              fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: attempt ${attempt + 1} res.json failed: ${e.message}
`);
              console.error("generate:request res.json failed", e);
              throw e;
            }
          } else {
            const text = await res.text().catch(() => "");
            fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: attempt ${attempt + 1} non-ok status ${res.status}, took ${took}ms
`);
            console.warn("generate:request http returned non-ok", res.status, text.slice(0, 200), "attempt:", attempt + 1, "tookMs:", took);
            lastErr = new Error(`http non-ok ${res.status}`);
          }
        } catch (err) {
          clearTimeout(timer);
          const took = Date.now() - attemptStart;
          fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: attempt ${attempt + 1} failed: ${err.message}, took ${took}ms
`);
          console.warn("generate:request http call attempt failed", { name: err == null ? void 0 : err.name, message: err == null ? void 0 : err.message, attempt: attempt + 1, timeoutMs, took });
          lastErr = err;
        }
      }
      fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: all attempts failed, falling back to spawn
`);
      console.warn("generate:request http failed after retries, will fallback to python spawn/mock", lastErr == null ? void 0 : lastErr.message);
    } catch (err) {
      fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: unexpected error before attempts: ${err.message}
`);
      console.warn("generate:request unexpected error before http attempts, falling back to python spawn/mock:", err == null ? void 0 : err.message);
    }
    try {
      fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: starting python spawn
`);
      const scriptPath = path__namespace.join(electron.app.getAppPath(), "python", "scheduler.py");
      const res = await new Promise((resolve, reject) => {
        const proc = node_child_process.spawn("python", [scriptPath], { stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
          proc.kill();
          reject(new Error("Python scheduler timeout"));
        }, 2e4);
        proc.stdout.on("data", (d) => stdout += d.toString());
        proc.stderr.on("data", (d) => stderr += d.toString());
        proc.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
        proc.on("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) return reject(new Error(`python exit ${code}: ${stderr}`));
          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed);
          } catch (e) {
            reject(new Error("invalid json from python: " + e.message));
          }
        });
        try {
          proc.stdin.write(JSON.stringify(payload));
          proc.stdin.end();
        } catch (e) {
        }
      });
      fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: python spawn returned: ${JSON.stringify(res).slice(0, 200)}
`);
      console.log("generate:request python result", res && res.weekStart);
      const provisionalFlag = res && res.__meta && res.__meta.provisional;
      const provisionalError = res && res.__meta && res.__meta.error;
      const returnedMeta = { source: "python", provisional: true };
      if (provisionalFlag) returnedMeta.provisional = returnedMeta.provisional || true;
      if (provisionalError) returnedMeta.error = provisionalError;
      (async function backgroundRefetch() {
        try {
          const url = "http://127.0.0.1:8765/generate";
          const attempts = 3;
          for (let i = 0; i < attempts; i++) {
            try {
              const controller = new AbortController();
              const timeoutMs = 18e4;
              const timer = setTimeout(() => controller.abort(), timeoutMs);
              const r = await fetch(url, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, signal: controller.signal });
              clearTimeout(timer);
              if (r.ok) {
                const json = await r.json();
                console.log("generate:request background refetch success, broadcasting update", json && json.weekStart);
                electron.BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("generate:updated", { ...json, __meta: { source: "deepseek", updated: true } }));
                return;
              } else {
                const text = await r.text().catch(() => "");
                console.log("generate:request background refetch non-ok", r.status, text.slice(0, 200));
              }
            } catch (e) {
              console.log("generate:request background refetch attempt failed", i + 1, e == null ? void 0 : e.message);
            }
            await new Promise((r) => setTimeout(r, 1e4));
          }
          console.log("generate:request background refetch exhausted attempts");
        } catch (e) {
          console.error("generate:request background refetch error", e == null ? void 0 : e.message);
        }
      })();
      return { ...res, __meta: returnedMeta };
    } catch (err) {
      fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: python spawn failed: ${err.message}
`);
      console.warn("generate:request python call failed, falling back to mock", err == null ? void 0 : err.message);
    }
    fs__namespace.appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()}: falling back to mock
`);
    const timeSlots = [
      "08:00",
      "09:40",
      "10:20",
      "12:00",
      "14:30",
      "16:10",
      "18:00",
      "19:40",
      "21:20",
      "22:00",
      "23:00",
      "00:00"
    ];
    const days = [];
    for (let d = 1; d <= 7; d++) {
      const slots = [];
      for (let s = 0; s < 2; s++) {
        const t = timeSlots[(d + s) % timeSlots.length];
        slots.push({ time: t, activity: `示例任务 ${d}-${s + 1}`, durationHours: 1, notes: "", taskName: `示例任务 ${d}-${s + 1}`, taskId: "" });
      }
      days.push({ date: "", weekday: d, slots });
    }
    return { weekStart: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), days, taskSummary: [], conflicts: [], __meta: { source: "mock", provisional: true } };
  });
  electron.ipcMain.handle("generate:basicRequest", async (_e, payload) => {
    console.log("main.ts: generate:basicRequest called with payload", payload);
    try {
      const url = "http://127.0.0.1:8765/generate/basic";
      console.log("main.ts: generate:basicRequest trying HTTP to", url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3e4);
      const start = Date.now();
      try {
        const res = await fetch(url, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, signal: controller.signal });
        clearTimeout(timer);
        const took = Date.now() - start;
        if (res.ok) {
          const json = await res.json();
          console.log("generate:basicRequest http result", json && json.weekStart, "response sample:", JSON.stringify(json).slice(0, 800), "tookMs:", took);
          return json;
        } else {
          const text = await res.text();
          console.warn("generate:basicRequest http returned non-ok", res.status, text.slice(0, 200));
        }
      } catch (err) {
        console.warn("generate:basicRequest http call failed", { name: err == null ? void 0 : err.name, message: err == null ? void 0 : err.message });
      }
    } catch (err) {
      console.warn("generate:basicRequest unexpected error before http attempts, falling back to python spawn/mock:", err == null ? void 0 : err.message);
    }
    console.log("main.ts: generate:basicRequest falling back to mock");
    const timeSlots = [
      "08:00",
      "09:40",
      "10:20",
      "12:00",
      "14:30",
      "16:10",
      "18:00",
      "19:40",
      "21:20",
      "22:00",
      "23:00",
      "00:00"
    ];
    const days = [];
    for (let d = 1; d <= 7; d++) {
      const slots = [];
      for (let s = 0; s < 2; s++) {
        const t = timeSlots[(d + s) % timeSlots.length];
        slots.push({ time: t, activity: `基础任务 ${d}-${s + 1}`, durationHours: 1, notes: "", taskName: `基础任务 ${d}-${s + 1}`, taskId: "" });
      }
      days.push({ date: "", weekday: d, slots });
    }
    return { weekStart: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), days, taskSummary: [], conflicts: [], __meta: { source: "basic", fallback: true } };
  });
  electron.ipcMain.handle("window:closeMe", (event) => {
    try {
      const win2 = electron.BrowserWindow.fromWebContents(event.sender);
      if (win2) {
        win2.close();
        return true;
      }
    } catch (e) {
      console.error("window:closeMe error", e);
    }
    return false;
  });
  electron.ipcMain.handle("calendar:notifyUpdated", (event, payload) => {
    try {
      electron.BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send("calendar:updated", payload);
      });
      return true;
    } catch (e) {
      console.error("calendar:notifyUpdated error", e);
      return false;
    }
  });
}
electron.app.whenReady().then(() => {
  startPackagedServer();
  electron.ipcMain.handle("theme:get-themes", async () => {
    const fs2 = require("fs");
    const path2 = require("path");
    let colorsDir = path2.join(__dirname, "../src/assets/colors");
    if (!fs2.existsSync(colorsDir)) {
      colorsDir = path2.join(__dirname, "../../src/assets/colors");
    }
    if (!fs2.existsSync(colorsDir)) return {};
    const themes = {};
    try {
      const files = fs2.readdirSync(colorsDir);
      for (const file of files) {
        if (file.endsWith(".json") && file !== "defaults.json") {
          const content = fs2.readFileSync(path2.join(colorsDir, file), "utf-8");
          const name = file.replace(".json", "");
          let parsed = {};
          try {
            parsed = JSON.parse(content);
          } catch (e) {
          }
          themes[name] = parsed[name] || parsed;
        }
      }
    } catch (e) {
      console.error("读取主题文件失败", e);
    }
    return themes;
  });
  electron.ipcMain.handle("theme:save-theme", async (_e, name, themeData) => {
    const fs2 = require("fs");
    const path2 = require("path");
    let colorsDir = path2.join(__dirname, "../src/assets/colors");
    if (!fs2.existsSync(colorsDir)) {
      colorsDir = path2.join(__dirname, "../../src/assets/colors");
    }
    if (!fs2.existsSync(colorsDir)) {
      try {
        fs2.mkdirSync(colorsDir, { recursive: true });
      } catch (e) {
      }
    }
    try {
      const filePath = path2.join(colorsDir, `${name}.json`);
      const saveObj = { [name]: themeData };
      fs2.writeFileSync(filePath, JSON.stringify(saveObj, null, 2), "utf-8");
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("theme:delete-theme", async (_e, name) => {
    const fs2 = require("fs");
    const path2 = require("path");
    let colorsDir = path2.join(__dirname, "../src/assets/colors");
    if (!fs2.existsSync(colorsDir)) {
      colorsDir = path2.join(__dirname, "../../src/assets/colors");
    }
    try {
      const target = path2.join(colorsDir, `${name}.json`);
      if (fs2.existsSync(target)) {
        fs2.unlinkSync(target);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  createWindow();
  electron.app.on("web-contents-created", (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      electron.shell.openExternal(url);
      return { action: "deny" };
    });
  });
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  if (packagedServerProcess) {
    try {
      packagedServerProcess.kill();
    } catch (e) {
    }
  }
});
