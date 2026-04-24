<template>
  <div class="theme-settings">
    <div class="control-zone">
      <div class="palette" :style="{ backgroundColor: currentColorHex }">
        <input type="color" v-model="currentColorHex" class="native-color-input" />
      </div>
        <div class="rgb-settings">
          <div class="rgb-row">
            <span>R</span>
            <input type="range" min="0" max="255" v-model.number="rgb.r" />
            <input type="number" min="0" max="255" v-model.number="rgb.r" class="num-input"/>
          </div>
          <div class="rgb-row">
            <span>G</span>
            <input type="range" min="0" max="255" v-model.number="rgb.g" />
            <input type="number" min="0" max="255" v-model.number="rgb.g" class="num-input"/>
          </div>
          <div class="rgb-row">
            <span>B</span>
            <input type="range" min="0" max="255" v-model.number="rgb.b" />
            <input type="number" min="0" max="255" v-model.number="rgb.b" class="num-input"/>
          </div>
        </div>
        <div class="reset-button">
          <button class="btn reset-btn" @click="resetCurrentColor">重置 {{ activeParam }} 颜色</button>
        </div>
      </div>
      
      <div class="parameter-zone">
        <div class="top-bar-params">
          <div class="theme-name-display">{{ currentThemeName }}</div>
          <button class="btn param-top-btn" @click="showLoadThemes = true">已存配置</button>
          <button class="btn param-top-btn save" @click="showSaveDialog = true">保存配置</button>
        </div>
        <div class="color-list">
          <div 
            v-for="(color, name) in editedColors" 
            :key="name"
            class="color-item"
            :class="{ active: activeParam === name }"
            @click="activeParam = String(name)"
          >
            <div class="color-preview" :style="{ backgroundColor: color }"></div>
            <div class="color-name">{{ name }}</div>
          </div>
        </div>
        <div class="action-button-line">
          <button class="btn cancel-btn" @click="cancel">取消</button>
          <button class="btn apply-btn" @click="apply">预览</button>
        </div>
      </div>
    </div>

    <!-- Theme Save Dialog -->
    <div v-if="showSaveDialog" class="modal-mask">
      <div class="modal-form" @click.stop>
        <h3 class="modal-title">保存配置</h3>
        <div class="form-row">
          <label>配置名称</label>
          <input type="text" v-model="newThemeName" placeholder="例如：我的暗黑主题" />
        </div>
        <div class="form-row actions">
          <button class="btn btn-cancel clickable" @click="showSaveDialog = false">取消</button>
          <button class="btn btn-save clickable" @click="saveTheme">保存</button>
        </div>
      </div>
    </div>

    <!-- Theme Load Dialog -->
    <div v-if="showLoadThemes" class="modal-mask alert-modal-mask" @click="showLoadThemes = false">
      <div class="alert-modal course-modal" @click.stop>
        <div class="header-row">
          <span>已存配置</span>
          <div style="display:flex; align-items:center">
            <button class="btn btn-del-mode clickable" :class="{ active: deleteMode }" @click="deleteMode = !deleteMode">-</button>
          </div>
        </div>
        
        <div v-if="Object.keys(savedThemes).length === 0" class="empty">暂无配置</div>
        <ul v-else class="task-ul">
          <li v-for="(theme, name) in savedThemes" :key="name" class="task-item clickable" :class="{ deletable: deleteMode }" @click="onSelectTheme(name)">
            <div class="task-main">
              <span class="course_name">{{ name }}</span>
              <span v-if="name === currentThemeName" class="tag active-tag">当前</span>
            </div>
            <div class="theme-preview-dots">
               <div class="dot" :style="{background: theme['--bg']}"></div>
               <div class="dot" :style="{background: theme['--theme-color-dark']}"></div>
               <div class="dot" :style="{background: theme['--accent']}"></div>
               <div class="dot" :style="{background: theme['--theme-color-light']}"></div>
            </div>
          </li>
        </ul>
        
        <div class="alert-actions">
          <button class="btn btn-cancel clickable" @click="showLoadThemes = false">关闭</button>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import defaultThemesData from '../assets/colors/defaults.json'

const emit = defineEmits(['close'])

const defaultColors = defaultThemesData['default'] || {
  '--bg': '#0f1216',
  '--panel': '#1e2327',
  '--text': '#e6e8eb',
  '--muted': '#9aa4b2',
  '--accent': '#3cffef',
  '--accent-dark': '#1e2b35',
  '--warning': '#ff3c7c',
  '--warning-dark': '#2a1818',
  '--golden-color': '#fede44',
  '--theme-color-light': '#fe19ff',
  '--theme-color-dark': '#800080',
  '--button-text': '#ffffff',
  '--task-progress-bar-bg': '#5d035d',
  '--task-scheduled-bar-bg': '#a120a1',
  '--cursor-fill': '#5d035d',
  '--cursor-stroke': '#fe19ff',
  '--pointer-cursor-fill': '#f946e0',
  '--pointer-cursor-stroke': '#fb69ff'
}

// 缓存上次应用的颜色，用于取消时恢复
const appliedColors = reactive({ ...defaultColors })

// 当前正在编辑的颜色
const editedColors = reactive({ ...defaultColors })

const activeParam = ref('--bg')

// 解析hex为rgb
function hexToRgb(hex) {
  let r = 0, g = 0, b = 0
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16)
    g = parseInt(hex.substring(3, 5), 16)
    b = parseInt(hex.substring(5, 7), 16)
  }
  return { r, g, b }
}

// rgb转hex
function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const rgb = reactive({ r: 0, g: 0, b: 0 })
let isSyncing = false

// 新增主题配置相关变量
const currentThemeName = ref('未命名配置')
const savedThemes = reactive({ ...defaultThemesData }) // 包含了 defaults 中的 default 配置
const showSaveDialog = ref(false)
const showLoadThemes = ref(false)
const deleteMode = ref(false)
const newThemeName = ref('')

// 用于判断是否在应用某个预设后用户手动修改了颜色
let isThemeDirty = false

// 当前选中的颜色的Hex值 (用于绑定色盘)
const currentColorHex = computed({
  get() {
    return editedColors[activeParam.value] || '#000000'
  },
  set(val) {
    editedColors[activeParam.value] = val
    const parsed = hexToRgb(val)
    isSyncing = true
    rgb.r = parsed.r
    rgb.g = parsed.g
    rgb.b = parsed.b
    isSyncing = false
  }
})

watch(activeParam, (newParam) => {
  const hex = editedColors[newParam] || '#000000'
  const parsed = hexToRgb(hex)
  isSyncing = true
  rgb.r = parsed.r
  rgb.g = parsed.g
  rgb.b = parsed.b
  isSyncing = false
}, { immediate: true })

// 监听RGB滑块改变
watch(rgb, (newRgb) => {
  if (!isSyncing) {
    editedColors[activeParam.value] = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
    
    // 一旦修改就标记为脏数据并修改名字
    if (!isThemeDirty && currentThemeName.value !== '未命名配置') {
      isThemeDirty = true
      currentThemeName.value = '未命名配置'
    }
  }
}, { deep: true })

// 同步从外部调色盘选择原色的修改响应
watch(currentColorHex, () => {
    if (!isSyncing && !isThemeDirty && currentThemeName.value !== '未命名配置') {
      isThemeDirty = true
      currentThemeName.value = '未命名配置'
    }
})

onMounted(async () => {
  // 恢复之前由系统或当前保存未确认的全局CSS（修复问题 1：保持预览）
  const rootStyle = getComputedStyle(document.documentElement)
  Object.keys(defaultColors).forEach(key => {
    const val = rootStyle.getPropertyValue(key).trim()
    if (val && val.startsWith('#')) {
      appliedColors[key] = val
      editedColors[key] = val
    }
  })

  // 加载保存的本地配置 (修复问题 2：读取src/assets/colors/下所有的对应.json文件)
  try {
     let localSaved = {}
     if (window.electronAPI && window.electronAPI.getThemes) {
        localSaved = await window.electronAPI.getThemes()
     } else {
        localSaved = JSON.parse(localStorage.getItem('savedThemes') || '{}')
     }
     // defaults.json 中有 default
     Object.assign(savedThemes, defaultThemesData, localSaved)
  } catch (e) {}
  
  const lastUsedTheme = localStorage.getItem('lastUsedTheme')
  if (lastUsedTheme && savedThemes[lastUsedTheme]) {
     // Check if current DOM actually strictly matches the saved named theme to decide "dirty" status
     let isMatch = true
     Object.keys(defaultColors).forEach(k => {
       const userColor = (editedColors[k] || '').toLowerCase()
       const targetColor = (savedThemes[lastUsedTheme][k] || '').toLowerCase()
       if (userColor !== targetColor) {
         isMatch = false
       }
     })
     if (isMatch) {
       currentThemeName.value = lastUsedTheme
       isThemeDirty = false
     } else {
       currentThemeName.value = '未命名配置'
       isThemeDirty = true
     }
  } else {
     currentThemeName.value = 'default'
     // 检查是否是被手动修改过但是未命名保存的预览情况
     let isMatch = true;
     Object.keys(defaultColors).forEach(k => {
       if ((editedColors[k] || '').toLowerCase() !== (savedThemes['default'][k] || '').toLowerCase()) {
         isMatch = false;
       }
     })
     if(!isMatch) {
       currentThemeName.value = '未命名配置'
       isThemeDirty = true
     }
  }
})

function resetCurrentColor() {
  currentColorHex.value = defaultColors[activeParam.value]
  isThemeDirty = true
  currentThemeName.value = '未命名配置'
}

function apply() {
  Object.assign(appliedColors, editedColors)
  // 将颜色应用到 :root
  Object.entries(appliedColors).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val)
  })
  updateCursorDataUris(appliedColors)
  
  if (currentThemeName.value !== '未命名配置') {
    localStorage.setItem('lastUsedTheme', currentThemeName.value)
  }
}

function cancel() {
  // 恢复为取消前的状态（不一定是默认状态）
  Object.assign(editedColors, appliedColors)
  Object.entries(appliedColors).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val)
  })
  updateCursorDataUris(appliedColors)
  // Revert back name to last saved name since we cancelled edits
  const lastUsed = localStorage.getItem('lastUsedTheme')
  currentThemeName.value = lastUsed || '未命名配置'
  isThemeDirty = false
  emit('close')
}

// ==============
// 新增的保存和加载逻辑
// ==============

async function saveTheme() {
  const name = newThemeName.value.trim()
  if (!name) {
    alert('请输入配置名称')
    return
  }
  
  // 复制当前正在编辑的所有参数
  savedThemes[name] = { ...editedColors }
  try {
    if (window.electronAPI && window.electronAPI.saveTheme) {
       // 转换为普通对象再传入 IPC，避免 Vue 响应式 Proxy 导致的克隆错误
       const plainData = JSON.parse(JSON.stringify(savedThemes[name]))
       await window.electronAPI.saveTheme(name, plainData)
    } else {
       localStorage.setItem('savedThemes', JSON.stringify(savedThemes))
    }
  } catch (e) {
    alert('保存出错：' + e.message)
  }
  
  currentThemeName.value = name
  localStorage.setItem('lastUsedTheme', name)
  isThemeDirty = false
  showSaveDialog.value = false
  newThemeName.value = ''
  
  // 保存完直接应用生效
  apply()
}

async function onSelectTheme(name) {
  if (deleteMode.value) {
    // 无法删除系统自带的默认配置
    if (name === 'default') {
      alert('默认配置不可删除')
      return
    }
    delete savedThemes[name]
    try {
      if (window.electronAPI && window.electronAPI.deleteTheme) {
         await window.electronAPI.deleteTheme(name)
      } else {
         localStorage.setItem('savedThemes', JSON.stringify(savedThemes))
      }
    } catch(e) {}
    
    // 如果删除的是当前正在使用的主题，重置其名字为未命名
    if (currentThemeName.value === name) {
       currentThemeName.value = '未命名配置'
       localStorage.setItem('lastUsedTheme', 'default') // 恢复为default而不是记录未命名
    }
  } else {
    // 加载该主题
    const targetTheme = savedThemes[name]
    if (targetTheme) {
       Object.assign(editedColors, targetTheme)
       currentThemeName.value = name
       isThemeDirty = false
       activeParam.value = '--bg'  // 触发刷新
       showLoadThemes.value = false
       
       // 选择完主题，立刻产生应用效果
       apply()
    }
  }
}

function updateCursorDataUris(colors) {
  const normalSvg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 32 32" style="enable-background:new 0 0 32 32;" xml:space="preserve"><path style="fill:${colors['--cursor-fill']};stroke:${colors['--cursor-stroke']};stroke-width:2;stroke-miterlimit:10;" d="M1.322,1.849l3.705,24.149 c0.066,0.428,0.626,0.55,0.863,0.187l5.828-8.929c0.062-0.095,0.156-0.165,0.265-0.196l9.538-2.736 c0.394-0.113,0.467-0.641,0.118-0.856L2.037,1.375C1.694,1.164,1.261,1.451,1.322,1.849z"/></svg>`;
  const pointerSvg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 32 32" style="enable-background:new 0 0 32 32;" xml:space="preserve"><path style="fill:${colors['--pointer-cursor-fill']};stroke:${colors['--pointer-cursor-stroke']};stroke-width:2;stroke-miterlimit:10;" d="M1.322,1.849l3.705,24.149 c0.066,0.428,0.626,0.55,0.863,0.187l5.828-8.929c0.062-0.095,0.156-0.165,0.265-0.196l9.538-2.736 c0.394-0.113,0.467-0.641,0.118-0.856L2.037,1.375C1.694,1.164,1.261,1.451,1.322,1.849z"/></svg>`;
  document.documentElement.style.setProperty('--cursor-url', `url('data:image/svg+xml;utf8,${encodeURIComponent(normalSvg)}')`);
  document.documentElement.style.setProperty('--pointer-cursor-url', `url('data:image/svg+xml;utf8,${encodeURIComponent(pointerSvg)}')`);
}
</script>

<style scoped>
.theme-settings {
  background: var(--panel, #1E2327);
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: auto;
}

.control-zone {
  flex: 1;
  border-right: 2px solid var(--theme-color-dark);
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.palette {
  width: 100%;
  height: 150px;
  border-radius: 8px;
  position: relative;
  border: 2px solid var(--muted);
  box-shadow: inset 0 0 10px rgba(0,0,0,0.3);
  margin-bottom: 20px;
}

.native-color-input {
  opacity: 0;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0; left: 0;
  cursor: pointer;
}

.rgb-settings {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.rgb-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rgb-row span {
  width: 20px;
  /* font-weight: bold; */
}

.rgb-row input[type="range"] {
  flex: 1;
}

.num-input {
  width: 50px;
  background: var(--bg);
  border: 2px solid var(--theme-color-dark);
  color: var(--text);
  padding: 4px;
  border-radius: 4px;
}

.reset-button {
  margin-top: 20px;
  text-align: center;
}

.reset-btn {
  width: 100%;
  font-size: 0.9em;
  padding: 8px 0;
  border: 2px solid var(--warning);
  background: transparent;
  color: var(--text);
}
.reset-btn:hover {
  background: var(--warning-dark);
}

.parameter-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.color-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.color-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.color-item.active {
  background: var(--theme-color-dark);
}

.color-preview {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid #000;
}

.color-name {
  /* font-size: 14px; */
}

.action-button-line {
  padding: 15px;
  border-top: 2px solid var(--theme-color-dark);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-btn, .apply-btn {
  font-size: 14px;
  /* padding: 6px 16px; */
  width: auto;
}

.cancel-btn {
  background: transparent;
  border: 2px solid var(--theme-color-light);
}
.cancel-btn:hover {
  background: rgba(255,255,255,0.1);
}

.apply-btn {
  background: var(--theme-color-dark);
  border: 2px solid var(--theme-color-light);
}
.apply-btn:hover {
  background: var(--theme-color-light);
}

/* 新增的顶部工具栏样式和弹窗样式 */
.top-bar-params {
  padding: 10px;
  border-bottom: 2px solid var(--theme-color-dark);
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--panel);
}
.theme-name-display {
  flex: 1;
  font-size: 14px;
  color: var(--text);
  /* font-weight: bold; */
}
.param-top-btn {
  font-size: 12px;
  padding: 4px 8px;
  height: auto;
  border: 2px solid var(--theme-color-light);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  transition: all 0.2s;
  width:auto;
}
.param-top-btn:hover {
  background: rgba(255,255,255,0.1);
}
.param-top-btn.save {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}
.param-top-btn.save:hover {
  background: hsl(from var(--accent) h s calc(l * 1.2));
}

.modal-mask {
  position: absolute;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}
.modal-form {
  background: var(--panel, #1E2327);
  border: 2px solid var(--theme-color-light);
  border-radius: 8px;
  padding: 20px;
  width: 300px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}
.modal-title {
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--text);
}
.form-row {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-row label {
  color: var(--muted, #9aa4b2);
}
.form-row input[type="text"] {
  padding: 6px;
  border-radius: 4px;
  border: 2px solid var(--theme-color-light);
  background: var(--theme-color-dark);
  color: var(--text, #e6e8eb);
  font-size: 1em;
}
.form-row.actions {
  flex-direction: row;
  justify-content: flex-end;
  margin-bottom: 0;
  margin-top: 10px;
}
.btn-save {
  background: var(--accent, #3CFFEF);
  color: #000;
  border: 2px solid var(--accent, #3CFFEF);
  border-radius: 4px;
  /* padding: 6px 16px; */
  font-size: 1em;
  width: auto;
}
.btn-save:hover {
  background: hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
}

/* 模仿课程管理的样式 */
.alert-modal-mask {
  z-index: 1002; /* higher than modal-mask */
}
.alert-modal {
  background: var(--panel, #1E2327);
  border: 2px solid var(--theme-color-light);
  border-radius: 8px;
  min-width: 360px;
  max-width: 500px;
  height: 480px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 4px 8px 10px;
  color: var(--text, #e6e8eb);
  height: 36px;
  border-bottom: 2px solid var(--theme-color-light);
  background-color: var(--theme-color-dark);
}
.header-row span{
  font-size: 1.2em;
}
.btn-del-mode {
  background: var(--warning, #FF3C7C);
  border: 2px solid var(--warning, #FF3C7C);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 4px;
}
.btn-del-mode:hover {
  background: hsl(from var(--warning, #FF3C7C) h s calc(l * 1.2));
}
.btn-del-mode.active {
  background: transparent;
  color: var(--warning, #FF3C7C);
}
.empty {
  color: var(--muted, #9aa4b2);
  text-align: center;
  margin-top: 40px;
  flex: 1;
}
.task-ul {
  list-style: none;
  margin: 0;
  padding: 12px;
  flex: 1;
  overflow-y: auto;
}
.task-item {
  background: var(--theme-color-dark);
  border-radius: 6px;
  margin-bottom: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--theme-color-light);
  transition: all 0.2s ease;
}
.task-item:hover {
  background: hsl(from var(--theme-color-dark) h s calc(l * 1.4));
}
.task-item.deletable:hover {
  background: #5a2a2a;
  border-color: var(--warning, #FF3C7C);
}
.task-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.active-tag {
  background: var(--theme-color-light);
  color: var(--button-text);
  padding: 2px 6px;
  border-radius: 4px;
  /* font-size: 12px; */
}
.theme-preview-dots {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
}
.alert-actions {
  display: flex;
  justify-content: flex-end;
  padding: 12px;
  border-top: 2px solid var(--theme-color-light);
  background-color: var(--theme-color-dark);
  gap: 12px;
}
.btn-cancel{
  background: transparent;
  border: 2px solid var(--theme-color-light);
  width:auto;
  font-size: 1em;
  /* padding: 6px 16px; */
}

</style>