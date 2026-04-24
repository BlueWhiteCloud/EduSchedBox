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
    }
});
