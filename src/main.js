import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { router } from './router/index.js';
import App from './App.vue';
import './style.css';
import defaultThemesData from './assets/colors/defaults.json';
const app = createApp(App);
app.use(createPinia());
app.use(router);
// ====== 初始化加载上次所选颜色主题 ======
async function initThemeAndMount() {
    try {
        const lastUsedTheme = localStorage.getItem('lastUsedTheme') || 'default';
        let localThemes = {};
        if (window.electronAPI && window.electronAPI.getThemes) {
            localThemes = await window.electronAPI.getThemes();
        }
        else {
            localThemes = JSON.parse(localStorage.getItem('savedThemes') || '{}');
        }
        const mergedThemes = { ...defaultThemesData, ...localThemes };
        if (mergedThemes[lastUsedTheme]) {
            const themeToLoad = mergedThemes[lastUsedTheme];
            Object.entries(themeToLoad).forEach(([key, val]) => {
                document.documentElement.style.setProperty(key, val);
            });
            // 初始化SVG光标
            const cursors = themeToLoad;
            if (cursors['--cursor-fill']) {
                const normalSvg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 32 32" style="enable-background:new 0 0 32 32;" xml:space="preserve"><path style="fill:${cursors['--cursor-fill']};stroke:${cursors['--cursor-stroke']};stroke-width:2;stroke-miterlimit:10;" d="M1.322,1.849l3.705,24.149 c0.066,0.428,0.626,0.55,0.863,0.187l5.828-8.929c0.062-0.095,0.156-0.165,0.265-0.196l9.538-2.736 c0.394-0.113,0.467-0.641,0.118-0.856L2.037,1.375C1.694,1.164,1.261,1.451,1.322,1.849z"/></svg>`;
                const pointerSvg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 32 32" style="enable-background:new 0 0 32 32;" xml:space="preserve"><path style="fill:${cursors['--pointer-cursor-fill']};stroke:${cursors['--pointer-cursor-stroke']};stroke-width:2;stroke-miterlimit:10;" d="M1.322,1.849l3.705,24.149 c0.066,0.428,0.626,0.55,0.863,0.187l5.828-8.929c0.062-0.095,0.156-0.165,0.265-0.196l9.538-2.736 c0.394-0.113,0.467-0.641,0.118-0.856L2.037,1.375C1.694,1.164,1.261,1.451,1.322,1.849z"/></svg>`;
                document.documentElement.style.setProperty('--cursor-url', `url('data:image/svg+xml;utf8,${encodeURIComponent(normalSvg)}')`);
                document.documentElement.style.setProperty('--pointer-cursor-url', `url('data:image/svg+xml;utf8,${encodeURIComponent(pointerSvg)}')`);
            }
        }
    }
    catch (e) {
        console.error('Failed to load initial theme', e);
    }
    finally {
        app.mount('#app');
    }
}
initThemeAndMount();
