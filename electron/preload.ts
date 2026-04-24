import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop') as Promise<boolean>,
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', flag) as Promise<boolean>,
  openGenerateWindow: () => ipcRenderer.invoke('generate:openWindow') as Promise<boolean>,
  generateRequest: (payload?: any) => ipcRenderer.invoke('generate:request', payload) as Promise<any>,
  generateBasicRequest: (payload?: any) => ipcRenderer.invoke('generate:basicRequest', payload) as Promise<any>,
  onGenerateUpdated: (callback: (...args: any[]) => void) => {
    ipcRenderer.on('generate:updated', (_event, payload) => {
      try { callback(payload) } catch (e) { console.error('onGenerateUpdated callback error', e) }
    })
  },
  generateForceRefetch: (payload?: any) => ipcRenderer.invoke('generate:forceRefetch', payload) as Promise<any>,
  closeWindow: () => ipcRenderer.invoke('window:closeMe') as Promise<boolean>,
  getUpcomingHomeworks: () => ipcRenderer.invoke('crawler:get-homeworks'),
  getCoursesConfig: () => ipcRenderer.invoke('crawler:get-courses'),
  saveCoursesConfig: (courses: any) => ipcRenderer.invoke('crawler:save-courses', courses),
  runCrawlerScripts: () => ipcRenderer.invoke('crawler:run-scripts'),

  // Theme settings
  getThemes: () => ipcRenderer.invoke('theme:get-themes'),
  saveTheme: (name: string, themeData: any) => ipcRenderer.invoke('theme:save-theme', name, themeData),
  deleteTheme: (name: string) => ipcRenderer.invoke('theme:delete-theme', name),

  notifyCalendarUpdated: (payload?: any) => ipcRenderer.invoke('calendar:notifyUpdated', payload) as Promise<boolean>,
  onCalendarUpdated: (callback: (...args: any[]) => void) => {
    ipcRenderer.on('calendar:updated', (_event, payload) => {
      try { callback(payload) } catch (e) { console.error('onCalendarUpdated callback error', e) }
    })
  },
  // 窗口控制
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  openExternal: (url: string) => ipcRenderer.invoke('window:openExternal', url)
})
