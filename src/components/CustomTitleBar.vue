<template>
  <div class="custom-title-bar">
    <div class="title-bar-content">
      <div class="title">NEW CALENDAR</div>
      <div class="window-controls">
        <button class="btn control-btn top" @click="toggleTop" :title="isTop ? '取消置顶' : '置顶'">
          <img :src="isTop ? fixedIcon : unfixedIcon" :alt="isTop ? '固定' : '不固定'" />
        </button>
        <button class="btn control-btn minimize" @click="minimizeWindow" title="最小化">
          <span>—</span>
        </button>
        <button class="btn control-btn maximize" @click="maximizeWindow" :title="isMaximized ? '还原' : '最大化'">
          <span>{{ isMaximized ? '🗗' : '🗖' }}</span>
        </button>
        <button class="btn control-btn close" @click="closeWindow" title="关闭">
          <span>✕</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import fixedIcon from '../assets/icons/固定图标.svg'
import unfixedIcon from '../assets/icons/不固定图标.svg'

const isMaximized = ref(false)
const isTop = ref(false)

const minimizeWindow = async () => {
  if ((window as any).electronAPI?.minimize) {
    await (window as any).electronAPI.minimize()
  }
}

const maximizeWindow = async () => {
  if ((window as any).electronAPI?.maximize) {
    await (window as any).electronAPI.maximize()
    await updateMaximizedState()
  }
}

const closeWindow = async () => {
  if ((window as any).electronAPI?.close) {
    await (window as any).electronAPI.close()
  }
}

const updateMaximizedState = async () => {
  if ((window as any).electronAPI?.isMaximized) {
    isMaximized.value = await (window as any).electronAPI.isMaximized()
  }
}

const toggleTop = async () => {
  if ((window as any).electronAPI?.toggleAlwaysOnTop) {
    isTop.value = await (window as any).electronAPI.toggleAlwaysOnTop()
  }
}

onMounted(async () => {
  await updateMaximizedState()
})
</script>

<style scoped>
.custom-title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  background-color: var(--theme-color-dark);
  border: 2px solid var(--theme-color-light);
  border-right: 3px solid var(--theme-color-light);
  border-radius: 8px 8px 0 0;
  -webkit-app-region: drag; /* 允许拖拽窗口 */
  z-index: 1000;
}

.title-bar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 4px 0 10px;
  user-select: none; /* 禁止选取文字 */
}

.title {
  font-size: 20px; /* 稍微缩小一点以适应新项目名称 */
  font-weight: bold;
  color: var(--text);
  font-family: "Microsoft YaHei", "SimSun", serif;
  letter-spacing: 2px;
  transform: translateY(2px);
}

.window-controls {
  display: flex;
  /* gap: 5px; */
}

.control-btn {
  /* width: 24px;
  height: 24px;
  border: none; */
  background: var(--theme-color-light);
  /* cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px; */
  
  -webkit-app-region: no-drag;
  /* transform: translateY(1px); */
  border: 2px solid transparent;
  /* margin-left: 0px; */
}

.control-btn.maximize span{
  /* font-size: normal; */
  transform: translateY(-2px);
}

.control-btn:hover {
  background-color: hsl(from var(--theme-color-light) h s calc(l * 1.2));
  /* border: 2px solid #e0e0e0; */
}

.control-btn.close:hover {
  background-color: var(--warning);
  border: 2px solid var(--warning);
  color: white;
}

.control-btn img {
  width: 18px;
  height: 18px;
  display: block;
}

.control-btn span {
  font-size: 12px;
  font-weight: bold;
}
</style>
