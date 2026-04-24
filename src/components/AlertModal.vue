<template>
  <div v-if="visible" class="alert-modal-mask" @click="close">
    <div class="alert-modal" @click.stop>
      <div class="alert-header">
        <span>提示</span>
      </div>
      <div class="alert-content">
        <p>{{ message }}</p>
      </div>
      <div class="alert-actions">
        <button class="btn-confirm clickable" @click="close">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

const close = () => {
  emit('close')
}
</script>

<style scoped>
.alert-modal-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.alert-modal {
  background: var(--panel, #1E2327);
  border: 2px solid var(--theme-color-light);
  border-radius: 8px;
  min-width: 300px;
  max-width: 500px;
  max-height: 80%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  /* overflow:hidden; 移除此行以允许内容滚动 */
  /* position:relative; */
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 4px 8px 10px;
  color: var(--text, #e6e8eb);
  height: 36px;
  border-bottom: 2px solid var(--theme-color-light);
  background-color: var(--theme-color-dark);
  font-size: 1.2em;
}

.alert-content {
  padding: 20px;
  color: var(--text, #e6e8eb);
  line-height: 1.5;
  max-height: 300px; /* 设置最大高度以触发滚动 */
  overflow-y: auto; /* 改为 auto 以在需要时显示滚动条 */
}

.alert-content p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  padding: 10px 20px 20px 20px;
}

.btn-confirm {
  background-color: var(--accent, #3CFFEF);
  border: 2px solid var(--accent, #3CFFEF);
  color: #000;
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 0.9em;
  user-select: none;
}

.btn-confirm:hover {
  background: hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
}
</style>