<template>
  <div v-if="visible" class="alert-modal-mask" @click="close">
    <div class="alert-modal course-modal" @click.stop>
      <div class="header-row">
        <span>学科设置</span>
        <div style="display:flex; align-items:center">
          <button class="btn btn-add clickable" @click="openForm()">+</button>
          <button class="btn btn-del-mode clickable" :class="{ active: deleteMode }" @click="deleteMode = !deleteMode">-</button>
        </div>
      </div>
      
      <div v-if="courses.length === 0" class="empty">暂无学科配置</div>
      <ul v-else class="task-ul">
        <li v-for="(course, index) in courses" :key="index" class="task-item clickable" :class="{ deletable: deleteMode }" @click="onSelectCourse(index)">
          <div class="task-main">
            <span class="course_name">{{ course.course_name }}</span>
            <span class="course-id">{{ course.course_id }}</span>
          </div>
        </li>
      </ul>
      
      <div class="alert-actions">
        <button class="btn-cancel clickable" @click="close">取消</button>
        <button class="btn-confirm clickable" @click="saveAndClose">保存</button>
      </div>

      <!-- Add / Edit Form -->
      <div v-if="showForm" class="modal-mask">
        <div class="modal-form" @click.stop>
          <div class="form-row">
            <label>课程名称</label>
            <input type="text" v-model="form.course_name" placeholder="例如：SEtest" />
          </div>
          <div class="form-row">
            <label>课程 ID</label>
            <input type="text" v-model="form.course_id" placeholder="例如：49FQSWFF" />
          </div>
          <div class="form-row actions">
            <button class="btn-cancel clickable" @click="closeForm">取消</button>
            <button class="btn-save clickable" @click="submitForm">确定</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, defineProps, defineEmits } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'saved'])

const courses = ref<{course_id: string, course_name: string}[]>([])
const deleteMode = ref(false)

const showForm = ref(false)
const editIndex = ref(-1)
const form = ref({ course_id: '', course_name: '' })

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    if (window.electronAPI) {
      const data = await window.electronAPI.getCoursesConfig()
      courses.value = data || []
    }
  } else {
    deleteMode.value = false
    showForm.value = false
  }
})

const close = () => emit('close')

const saveAndClose = async () => {
  if (window.electronAPI) {
    // Vue3 的 reactive proxy 对象有时无法直接被 Electron 的 IPC 机制序列化发送，
    // 需要先经过 JSON stringify 剥离 Proxy 外壳转化为纯原生数据数组。
    const pureData = JSON.parse(JSON.stringify(courses.value))
    const res = await window.electronAPI.saveCoursesConfig(pureData)
    if (!res.success) {
      console.error('Failed to save courses', res.error)
      alert('保存失败: ' + res.error)
      return
    }
  }
  emit('saved')
  close()
}

const openForm = () => {
  form.value = { course_id: '', course_name: '' }
  editIndex.value = -1
  showForm.value = true
}

const onSelectCourse = (index: number) => {
  if (deleteMode.value) {
    courses.value.splice(index, 1)
  } else {
    form.value = { ...courses.value[index] }
    editIndex.value = index
    showForm.value = true
  }
}

const closeForm = () => {
  showForm.value = false
}

const submitForm = () => {
  if (!form.value.course_name.trim() || !form.value.course_id.trim()) {
    alert('请填写完整信息')
    return
  }
  if (editIndex.value >= 0) {
    courses.value[editIndex.value] = { ...form.value }
  } else {
    courses.value.push({ ...form.value })
  }
  closeForm()
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

.btn-add {
  background-color: var(--accent, #3CFFEF);
  border:2px solid var(--accent, #3CFFEF);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.btn-add:hover {
  background-color: hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
}
.btn-del-mode {
  background: var(--warning, #FF3C7C);
  border: 2px solid var(--warning, #FF3C7C);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.btn-del-mode:hover {
  background: hsl(from var(--warning, #FF3C7C) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--warning, #FF3C7C) h s calc(l * 1.2));
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
.course_name {
  font-size: 1.1em;
  color: var(--text, #fff);
  /* font-weight: bold; */
}
.course-id {
  color: #aaa;
  font-size: 1.1em;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  padding: 12px;
  border-top: 2px solid var(--theme-color-light);
  background-color: var(--theme-color-dark);
  gap: 12px;
}

.btn-confirm {
  background-color: var(--accent, #3CFFEF);
  border: 2px solid var(--accent, #3CFFEF);
  color: var(--panel);
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 0.9em;
  user-select: none;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.btn-confirm:hover {
  background: hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
}
.btn-cancel {
  background: var(--theme-color-light);
  border: 2px solid var(--theme-color-light);
  color: var(--text);
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 0.9em;
  user-select: none;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.btn-cancel:hover {
  background: hsl(from var(--theme-color-light) h s calc(l * 1.4));
  border: 2px solid hsl(from var(--theme-color-light) h s calc(l * 1.4));
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
  padding-top:40px;
  width: 30%;
  min-width: 280px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}
.form-row {
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-row label {
  width: 70px;
  color: var(--muted, #9aa4b2);
  /* font-size: 14px; */
}
.form-row input[type="text"] {
  flex: 1;
  padding: 6px;
  border-radius: 4px;
  border: 2px solid var(--theme-color-light);
  background: var(--theme-color-dark);
  color: var(--text, #e6e8eb);
  font-size: 1em;
}
.form-row.actions {
  justify-content: flex-end;
  margin-bottom: 0;
  /* margin-top: 20px; */
}
.btn-save {
  background: var(--accent, #3CFFEF);
  color: #000;
  border: 2px solid var(--accent, #3CFFEF);
  border-radius: 4px;
  padding: 6px 16px;
}
.btn-save:hover {
  background: hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--accent, #3CFFEF) h s calc(l * 1.2));
}
</style>