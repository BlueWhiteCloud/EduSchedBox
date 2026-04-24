import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    openGenerateWindow: () => ipcRenderer.invoke('generate:openWindow'),
    generateRequest: (payload) => ipcRenderer.invoke('generate:request', payload),
    generateBasicRequest: (payload) => ipcRenderer.invoke('generate:basicRequest', payload),
    onGenerateUpdated: (callback) => {
        ipcRenderer.on('generate:updated', (_event, payload) => {
            try {
                callback(payload);
            }
            catch (e) {
                console.error('onGenerateUpdated callback error', e);
            }
        });
    },
    generateForceRefetch: (payload) => ipcRenderer.invoke('generate:forceRefetch', payload),
    closeWindow: () => ipcRenderer.invoke('window:closeMe'),
    getUpcomingHomeworks: () => ipcRenderer.invoke('crawler:get-homeworks'),
    getCoursesConfig: () => ipcRenderer.invoke('crawler:get-courses'),
    saveCoursesConfig: (courses) => ipcRenderer.invoke('crawler:save-courses', courses),
    runCrawlerScripts: () => ipcRenderer.invoke('crawler:run-scripts'),
    // Theme settings
    getThemes: () => ipcRenderer.invoke('theme:get-themes'),
    saveTheme: (name, themeData) => ipcRenderer.invoke('theme:save-theme', name, themeData),
    deleteTheme: (name) => ipcRenderer.invoke('theme:delete-theme', name),
    notifyCalendarUpdated: (payload) => ipcRenderer.invoke('calendar:notifyUpdated', payload),
    onCalendarUpdated: (callback) => {
        ipcRenderer.on('calendar:updated', (_event, payload) => {
            try {
                callback(payload);
            }
            catch (e) {
                console.error('onCalendarUpdated callback error', e);
            }
        });
    },
    // 窗口控制
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    openExternal: (url) => ipcRenderer.invoke('window:openExternal', url)
});
