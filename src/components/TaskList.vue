<template>
  <div class="task-list">
    <div class="header-row">
      <span>事件列表</span>
      <div style="display:flex; align-items:center">
        <button class="btn btn-add clickable" @click="resetForm(); showForm = true">+</button>
        <button class="btn btn-del-mode clickable" :class="{ active: deleteMode }" @click="deleteMode = !deleteMode">-</button>
        <button class="btn btn-refresh clickable" title="按截止时间刷新排序" @click.stop="refreshSort"><span>↻</span></button>
      </div>
    </div>
    <div v-if="tasks.length === 0" class="empty">暂无事件</div>
    <ul v-else class="task-ul">
        <li v-for="task in tasks" :key="task.id" class="task-item clickable"
          :class="{selected: fillMode && selectedTaskId === task.id && !deleteMode, deletable: deleteMode, fillable: fillMode && !deleteMode, clickable: true}"
          @click="onSelectTask(task.id)">
        <div class="task-main">
          <span class="task-name" :title="task.name">{{ task.name }}</span>
          <span class="task-deadline">
            <template v-if="formatDatePart(task.deadline)">
              {{ formatDatePart(task.deadline) }} <span :class="{'highlight-time': task.highlightTime}">{{ formatTimePart(task.deadline) }}</span>
            </template>
          </span>
        </div>
        <div class="task-progress-bar">
          <!-- 若progress-label超过50%则字体变成黑色 -->
          <span class="progress-label" :class="{'dark': parseInt(percentLabel(task), 10) >= 50}">{{ percentLabel(task) }}</span>

          <div class="progress-scheduled" :style="{ width: scheduledPercentForTask(task) + '%' }">
            <div class="progress-fill" :style="{ width: progressPercentForTask(task) + '%' }">
            </div>
          </div>


        </div>
      </li>
    </ul>
    <div v-if="showForm" class="modal-mask">
      <div class="modal-form">
        <h4>{{ editing ? '编辑事件' : '新建事件' }}</h4>
        <form @submit.prevent="submitForm">
          <div class="form-row">
            <label>名称</label>
            <input v-model="form.name" required />
          </div>
          <div class="form-row">
            <label>截止时间</label>
            <input v-model="form.deadline" type="datetime-local" required />
          </div>
          <div class="form-row">
            <label>预计总时长(h)</label>
            <input v-model.number="form.estimatedHours" type="number" min="1" required />
          </div>
          
          <div class="form-row">
            <label>备注</label>
            <input v-model="form.notes" />
          </div>
          <div class="form-row actions">
            <button type="submit" class="btn-save clickable">保存</button>
            <button type="button" class="btn-cancel clickable" @click="closeForm">取消</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { useTaskStore } from '../stores/task.js'
import { useCalendarStore } from '../stores/calendar.js'
import { defineComponent, ref, computed, watch, onMounted } from 'vue'

export default defineComponent({
  name: 'TaskList',
  props: {
    fillMode: Boolean,
    selectedTaskId: String
  },
  emits: ['select-task'],
  setup(props, { emit }) {
    const store = useTaskStore()
    console.log('TaskList setup, tasks:', store.tasks)
    const deleteMode = ref(false)
    const tasksComputed = computed(() => {
      console.log('tasksComputed:', store.tasks, 'length:', store.tasks.length)
      return store.tasks
    })
    const showForm = ref(false)
    const editing = ref(false)
    const editId = ref('')
    const form = ref({
      name: '',
      deadline: '',
      estimatedHours: 1,
      progress: { numerator: 0, denominator: 1 },
      notes: ''
    })

    // removed manual progress fields; progress is derived from calendar cells
    const calendarStore = useCalendarStore()
    // ensure stored task progress is populated initially and when calendar changes
    try {
      store.refreshProgressForAll()
    } catch (e) { console.warn('initial refreshProgressForAll failed', e) }
    // when calendar cells change, refresh cached progress
    watch(() => calendarStore.cells, () => {
      try { store.refreshProgressForAll() } catch (e) { console.warn('watch refreshProgressForAll failed', e) }
    }, { deep: true })

    function refreshSort() {
      try {
        store.sortTasks()
      } catch (e) {
        console.error('refreshSort failed', e)
      }
    }

    function parseSlotMinutes(slotKey) {
      try {
        const parts = slotKey.split('-')
        if (parts.length !== 2) return 0
        const [s1, s2] = parts
        const [h1, m1] = s1.split(':').map(Number)
        const [h2, m2] = s2.split(':').map(Number)
        let start = (h1 || 0) * 60 + (m1 || 0)
        let end = (h2 || 0) * 60 + (m2 || 0)
        if (end <= start) end += 24 * 60
        return Math.max(0, end - start)
      } catch (e) { return 0 }
    }

    function progressPercentForTask(task) {
      // read authoritative cached value from task (store is single source of truth)
      if (!task) return 0
      if (typeof task.progressPercent === 'number') return task.progressPercent
      // fallback: derive from task.progress if available
      try {
        if (task.progress && typeof task.progress.numerator === 'number' && typeof task.progress.denominator === 'number' && task.progress.denominator > 0) {
          return Math.round((task.progress.numerator / task.progress.denominator) * 100)
        }
      } catch (e) {}
      return 0
    }

    // 计算已安排时长占预计时长的百分比（用于灰色进度条）
    function scheduledPercentForTask(task) {
      // read authoritative cached value from task (store is single source of truth)
      if (!task) return 0
      if (typeof task.scheduledPercent === 'number') return task.scheduledPercent
      // fallback: attempt to derive from task.progress.denominator
      try {
        if (task.progress && typeof task.progress.denominator === 'number' && task.progress.denominator > 0) {
          const expectedMins = (task.estimatedHours && Number(task.estimatedHours) > 0) ? Math.round(Number(task.estimatedHours) * 60) : 0
          const scheduled = task.progress.denominator
          if (!scheduled || scheduled <= 0) return 0
          if (expectedMins > 0 && scheduled + 20 >= expectedMins) return 100
          if (expectedMins <= 0) return 0
          return Math.round((scheduled / expectedMins) * 100)
        }
      } catch (e) {}
      return 0
    }

    function percentLabel(task) {
      try {
        if (task && typeof task.completionPercent === 'number') return `${Math.round(task.completionPercent)}%`
      } catch (e) {}
      return `${Math.round((scheduledPercentForTask(task) * progressPercentForTask(task) / 100))}%`
    }
    function formatDatePart(deadline) {
      if (!deadline) return ''
      const d = new Date(deadline)
      if (isNaN(d.getTime())) return ''
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}.${m}.${day}`
    }
    function formatTimePart(deadline) {
      if (!deadline) return ''
      const d = new Date(deadline)
      if (isNaN(d.getTime())) return ''
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    }
    function resetForm() {
      const now = new Date()
      now.setMinutes(now.getMinutes() + 1)
      const defaultDeadline = now.toISOString().slice(0, 16)
      form.value = { name: '', deadline: defaultDeadline, estimatedHours: 1, notes: '' }
      editing.value = false
      editId.value = ''
    }
    function submitForm() {
      if (!form.value.name || !form.value.deadline || !form.value.estimatedHours) return
      
      // 添加查重：检查是否已有除自己外的同名事件
      const isDuplicate = store.tasks.some(t => t.name === form.value.name && (!editing.value || t.id !== editId.value))
      if (isDuplicate) {
        alert('已存在同名事件，请修改名称或选择其他事件')
        return
      }

      if (editing.value) {
        store.updateTask(editId.value, { ...form.value })
      } else {
        const newId = Date.now().toString(36)
        store.addTask({ id: newId, ...form.value, status: 'active' })
        try { store.refreshProgressForTask(newId) } catch (e) { console.warn('submitForm: refreshProgressForTask failed', e) }
      }
      closeForm()
    }
    function editTask(task) {
      form.value = { ...task }
      editing.value = true
      editId.value = task.id
      showForm.value = true
    }
    function removeTask(id) {
      // locate task before removing so we can clear matching calendar cells
      const target = store.tasks.find(t => t.id === id)
      store.removeTask(id)
      // clear any calendar cells that referenced this task (clear completed as well)
      try {
        for (const c of calendarStore.cells || []) {
          if (c.taskId === id || (!c.taskId && target && c.eventName === target.name)) {
            // use clearCell to ensure completed is cleared too
            calendarStore.clearCell(c.weekDay, c.slotKey)
          }
        }
      } catch (e) { console.error('removeTask: failed to clear calendar cells for task', id, e) }
      if (props.selectedTaskId === id) {
        emit('select-task', '')
      }
    }
    function closeForm() {
      showForm.value = false
      resetForm()
    }
    function onSelectTask(id) {
      if (deleteMode.value) {
        removeTask(id)
      } else if (props.fillMode) {
        emit('select-task', id)
      } else {
        const task = store.tasks.find(t => t.id === id)
        if (task) {
          editTask(task)
        }
      }
    }
    // legacy helper kept for compatibility (not used)
    return {
      deleteMode,
      tasks: tasksComputed,
      showForm,
      editing,
      form,
      refreshSort,
      // expose new calendar-derived helpers
      progressPercentForTask,
      scheduledPercentForTask,
      percentLabel,
      formatDatePart,
      formatTimePart,
      submitForm,
      editTask,
      removeTask,
      closeForm,
      onSelectTask,
      resetForm
    }
  }
})
</script>

<style scoped>
.task-list {
  min-width: 160px;
  background: var(--panel, #1E2327);
  /* border-right: 1px solid #232a36; */
  height: 100%;
  padding: 0 0;
  display: flex;
  flex-direction: column;
  /* task name clamp defaults */
  --task-line-height: 1.3em;
  --task-max-lines: 2;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 4px 8px 10px;
  /* font-weight: 600; */
  color: var(--text, #e6e8eb);
  height:36px;
  border-bottom: 2px solid var(--theme-color-light);
  background-color: var(--theme-color-dark);
}
.header-row span{
  font-size: 1.5em;
}
.btn-add {
  background-color: var(--accent, #3CFFEF);
  border:2px solid var(--accent, #3CFFEF);
}
.btn-add:hover {
  background-color: hsl(from var(--accent) h s calc(l * 1.4));
  border:2px solid hsl(from var(--accent) h s calc(l * 1.4));
}
.btn-del-mode {
  background: var(--warning,#ff6b6b);
  border:2px solid var(--warning,#ff6b6b);
}
.btn-del-mode:hover {
  background: hsl(from var(--warning,#ff6b6b) h s calc(l * 1.2));
  border:2px solid hsl(from var(--warning,#ff6b6b) h s calc(l * 1.2));
}
.btn-del-mode.active {
  background: var(--warning-dark);
  color: var(--warning,#ff6b6b);
  border: 2px solid var(--warning,#ff6b6b);
}
.btn-del-mode.active:hover {
  background: hsl(from var(--warning-dark) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--warning,#ff6b6b) h s calc(l * 1.2));
}
.task-item.deletable.delete-hover, .task-item.deletable:hover {
  background: #5a2a2a;
  outline: 2px solid var(--warning,#ff6b6b);
}
.btn-refresh{
  background: var(--theme-color-light);
  border: 2px solid var(--theme-color-light);
}
.btn-refresh span{
  transform: translateY(1px);
  font-size: 24px;
}
.btn-refresh:hover {
  background: hsl(from var(--theme-color-light) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--theme-color-light) h s calc(l * 1.2));
}
.task-ul {
  list-style: none;
  margin: 0;
  padding: 8px;
  flex: 1;
  overflow-y: auto;
}
.task-item {
  background: var(--theme-color-dark);
  border-radius: 6px;
  margin-bottom: 8px;
  padding: 8px 6px 8px 8px;
  display: flex;
  flex-direction: column;
  /* cursor: pointer; */
  border: 2px solid var(--theme-color-light);
  transition: all 0.2s ease;
}
.task-item.fillable:hover {
  background: hsl(from var(--accent-dark, #1e2b35) h s calc(l * 1.4));
  border-color: hsl(from var(--accent, #5f9bff) h s calc(l * 1.4));
}
.task-item.selected {
  border: 2px solid var(--accent, #5f9bff);
  background: var(--accent-dark, #1e2b35);
}
.task-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
}
.task-name {
  /* font-weight: 500; */
  font-size: 1.3em;
  flex: 1;
  min-width: 0;
  line-height: var(--task-line-height);
  max-height: calc(var(--task-line-height) * var(--task-max-lines));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--task-max-lines);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;
  hyphens: auto;
}
.task-progress-bar {
  margin-top: 6px;
  height: 20px;
  background: var(--task-progress-bar-bg);
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  border:2px solid var(--theme-color-light);
}
.task-progress-bar .progress-scheduled {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--task-scheduled-bar-bg);
  z-index: 50; /* under the blue fill */
  transition:width 0.3s ease;
}
.task-progress-bar .progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--accent, #5f9bff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  z-index: 110; /* above scheduled bar */
  transition:width 0.3s ease;
}
.progress-label {
  z-index: 200;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 0 6px;
  font-size: large;
  transition:color 0.3s ease;
  pointer-events: none;
}
.progress-label.dark {
  color:var(--accent-dark);
}
.task-deadline {
  color: var(--text, #e6e8eb);
  font-size: 1.1em;
}
.empty {
  color: var(--muted, #9aa4b2);
  text-align: center;
  margin-top: 40px;
}
.modal-mask {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-form {
  background: #232a36;
  border-radius: 10px;
  padding: 24px 28px 18px 28px;
  min-width: 320px;
  box-shadow: 0 2px 16px #0008;
}
.form-row {
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-row label {
  width: 80px;
  color: var(--muted, #9aa4b2);
  font-size: 14px;
}
.form-row input[type="number"], .form-row input[type="text"], .form-row input[type="datetime-local"] {
  flex: 1;
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid #232a36;
  background: #181e2a;
  color: var(--text, #e6e8eb);
}
.form-row .percent {
  color: var(--muted, #9aa4b2);
  font-size: 13px;
}
.form-row.actions {
  justify-content: flex-end;
  gap: 12px;
}
.btn-save {
  background: var(--accent, #5f9bff);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 4px 16px;
  /* cursor: pointer; */
}
.btn-cancel {
  background: none;
  border: 1px solid #232a36;
  color: var(--muted, #9aa4b2);
  border-radius: 6px;
  padding: 4px 16px;
  /* cursor: pointer; */
}
.highlight-time {
  color: var(--golden-color, #FEDE44);
  /* font-weight: bold; */
}
</style>
