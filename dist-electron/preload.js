"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    toggleAlwaysOnTop: () => electron_1.ipcRenderer.invoke('window:toggleAlwaysOnTop'),
    setAlwaysOnTop: (flag) => electron_1.ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    openGenerateWindow: () => electron_1.ipcRenderer.invoke('generate:openWindow'),
    generateRequest: (payload) => electron_1.ipcRenderer.invoke('generate:request', payload),
    generateBasicRequest: (payload) => electron_1.ipcRenderer.invoke('generate:basicRequest', payload),
    onGenerateUpdated: (callback) => {
        electron_1.ipcRenderer.on('generate:updated', (_event, payload) => {
            try {
                callback(payload);
            }
            catch (e) {
                console.error('onGenerateUpdated callback error', e);
            }
        });
    },
    generateForceRefetch: (payload) => electron_1.ipcRenderer.invoke('generate:forceRefetch', payload),
    closeWindow: () => electron_1.ipcRenderer.invoke('window:closeMe'),
    getUpcomingHomeworks: () => electron_1.ipcRenderer.invoke('crawler:get-homeworks'),
    getCoursesConfig: () => electron_1.ipcRenderer.invoke('crawler:get-courses'),
    saveCoursesConfig: (courses) => electron_1.ipcRenderer.invoke('crawler:save-courses', courses),
    runCrawlerScripts: () => electron_1.ipcRenderer.invoke('crawler:run-scripts'),
    // Theme settings
    getThemes: () => electron_1.ipcRenderer.invoke('theme:get-themes'),
    saveTheme: (name, themeData) => electron_1.ipcRenderer.invoke('theme:save-theme', name, themeData),
    deleteTheme: (name) => electron_1.ipcRenderer.invoke('theme:delete-theme', name),
    notifyCalendarUpdated: (payload) => electron_1.ipcRenderer.invoke('calendar:notifyUpdated', payload),
    onCalendarUpdated: (callback) => {
        electron_1.ipcRenderer.on('calendar:updated', (_event, payload) => {
            try {
                callback(payload);
            }
            catch (e) {
                console.error('onCalendarUpdated callback error', e);
            }
        });
    },
    // 窗口控制
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window:isMaximized'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('window:openExternal', url)
});
