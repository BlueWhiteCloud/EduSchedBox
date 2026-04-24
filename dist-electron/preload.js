"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  toggleAlwaysOnTop: () => electron.ipcRenderer.invoke("window:toggleAlwaysOnTop"),
  setAlwaysOnTop: (flag) => electron.ipcRenderer.invoke("window:setAlwaysOnTop", flag),
  openGenerateWindow: () => electron.ipcRenderer.invoke("generate:openWindow"),
  generateRequest: (payload) => electron.ipcRenderer.invoke("generate:request", payload),
  generateBasicRequest: (payload) => electron.ipcRenderer.invoke("generate:basicRequest", payload),
  onGenerateUpdated: (callback) => {
    electron.ipcRenderer.on("generate:updated", (_event, payload) => {
      try {
        callback(payload);
      } catch (e) {
        console.error("onGenerateUpdated callback error", e);
      }
    });
  },
  generateForceRefetch: (payload) => electron.ipcRenderer.invoke("generate:forceRefetch", payload),
  closeWindow: () => electron.ipcRenderer.invoke("window:closeMe"),
  getUpcomingHomeworks: () => electron.ipcRenderer.invoke("crawler:get-homeworks"),
  getCoursesConfig: () => electron.ipcRenderer.invoke("crawler:get-courses"),
  saveCoursesConfig: (courses) => electron.ipcRenderer.invoke("crawler:save-courses", courses),
  runCrawlerScripts: () => electron.ipcRenderer.invoke("crawler:run-scripts"),
  // Theme settings
  getThemes: () => electron.ipcRenderer.invoke("theme:get-themes"),
  saveTheme: (name, themeData) => electron.ipcRenderer.invoke("theme:save-theme", name, themeData),
  deleteTheme: (name) => electron.ipcRenderer.invoke("theme:delete-theme", name),
  notifyCalendarUpdated: (payload) => electron.ipcRenderer.invoke("calendar:notifyUpdated", payload),
  onCalendarUpdated: (callback) => {
    electron.ipcRenderer.on("calendar:updated", (_event, payload) => {
      try {
        callback(payload);
      } catch (e) {
        console.error("onCalendarUpdated callback error", e);
      }
    });
  },
  // 窗口控制
  minimize: () => electron.ipcRenderer.invoke("window:minimize"),
  maximize: () => electron.ipcRenderer.invoke("window:maximize"),
  close: () => electron.ipcRenderer.invoke("window:close"),
  isMaximized: () => electron.ipcRenderer.invoke("window:isMaximized"),
  openExternal: (url) => electron.ipcRenderer.invoke("window:openExternal", url)
});
