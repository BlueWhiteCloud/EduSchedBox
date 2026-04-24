/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      toggleAlwaysOnTop: () => Promise<boolean>
      setAlwaysOnTop: (flag: boolean) => Promise<boolean>
      getUpcomingHomeworks: () => Promise<any[]>
      getCoursesConfig: () => Promise<any[]>
      saveCoursesConfig: (courses: any) => Promise<{ success: boolean, error?: string }>
      runCrawlerScripts: () => Promise<{ success: boolean, data?: any[], error?: string }>
      openExternal?: (url: string) => Promise<void>
    }
  }
}

export {}
