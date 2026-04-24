import { defineStore } from 'pinia'
import { useCalendarStore } from './calendar.js'
import { getSlotDurationMinutes } from '../utils/time.js'

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: /** @type {Array<Task>} */ ([])
  }),
  actions: {
    addTask(task) {
      this.tasks.push(task)
      console.log('Added task:', task)
      this.saveTasks()
      console.log('Tasks saved:', this.tasks)
    },
    updateTask(id, patch) {
      const idx = this.tasks.findIndex(t => t.id === id)
      if (idx !== -1) {
        const oldName = this.tasks[idx] && this.tasks[idx].name
        Object.assign(this.tasks[idx], patch)
        this.saveTasks()
        try {
          const calendarStore = useCalendarStore()
          const newName = this.tasks[idx] && this.tasks[idx].name
          for (const cell of calendarStore.cells) {
            if (cell.taskId === id || (!cell.taskId && oldName && cell.eventName === oldName)) {
              calendarStore.updateCell(cell.weekDay, cell.slotKey, { eventName: newName })
            }
          }
          // refresh cached progress for this task after renames/updates
          try { this.refreshProgressForTask(id) } catch (e) { console.warn('updateTask: refreshProgressForTask failed', e) }
        } catch (e) {
          console.warn('Failed to sync calendar event names after task update', e)
        }
      }
    },
    removeTask(id) {
      const idx = this.tasks.findIndex(t => t.id === id)
      if (idx !== -1) {
        // capture task info before removal to allow name-based matching
        const removedTask = this.tasks[idx]
        this.tasks.splice(idx, 1)
        this.saveTasks()
        // 清空日历中引用此任务的格子（同时清除 completed）
        const calendarStore = useCalendarStore()
        for (const cell of calendarStore.cells) {
          if (cell.taskId === id || (!cell.taskId && removedTask && cell.eventName === removedTask.name)) {
            // use clearCell to ensure eventName/taskId/notes and completed are cleared
            calendarStore.clearCell(cell.weekDay, cell.slotKey)
          }
        }
      }
    },
    sortTasks() {
      try {
        this.tasks.sort((a, b) => {
          const aDead = a && a.deadline ? new Date(a.deadline) : null
          const bDead = b && b.deadline ? new Date(b.deadline) : null
          if (!aDead && !bDead) return 0
          if (!aDead) return 1
          if (!bDead) return -1
          if (isNaN(aDead.getTime()) && isNaN(bDead.getTime())) return 0
          if (isNaN(aDead.getTime())) return 1
          if (isNaN(bDead.getTime())) return -1
          return aDead - bDead
        })
        this.saveTasks()
      } catch (e) {
        console.error('sortTasks failed', e)
      }
    },
    loadTasks() {
      try {
        const raw = localStorage.getItem('tasks')
        console.log('Loading tasks from localStorage:', raw)
        if (raw) {
          this.tasks = JSON.parse(raw)
          console.log('Loaded tasks:', this.tasks)
        } else {
          console.log('No tasks in localStorage')
        }
      } catch (e) {
        console.warn('loadTasks error', e)
      }
    },
    saveTasks() {
      try {
        const data = JSON.stringify(this.tasks)
        console.log('Saving tasks to localStorage:', data)
        localStorage.setItem('tasks', data)
        console.log('Tasks saved successfully')
      } catch (e) {
        console.error('saveTasks error', e)
        // ignore storage errors
      }
    }
    ,
    // 计算并刷新单个任务的已安排/已完成分钟数，并更新 task.progress 和 task.status
    refreshProgressForTask(id) {
      try {
        const calendarStore = useCalendarStore()
        const idx = this.tasks.findIndex(t => t.id === id)
        if (idx === -1) return
        const task = this.tasks[idx]
        let scheduledMins = 0
        let completedMins = 0
        for (const cell of calendarStore.cells || []) {
          if (cell.taskId === task.id || (!cell.taskId && cell.eventName === task.name)) {
            let mins = 0
            const slotStr = cell.slotKey || ''
            if (slotStr.includes('-')) {
              const parts = slotStr.split('-')
              if (parts.length === 2) {
                const [s1, s2] = parts
                const [h1, m1] = s1.split(':').map(Number)
                const [h2, m2] = s2.split(':').map(Number)
                let start = (h1 || 0) * 60 + (m1 || 0)
                let end = (h2 || 0) * 60 + (m2 || 0)
                if (end <= start) end += 24 * 60
                mins = Math.max(0, end - start)
              }
            } else if (slotStr) {
              mins = getSlotDurationMinutes(slotStr)
            }
            scheduledMins += mins
            if (cell.completed) completedMins += mins
          }
        }
        // store raw minutes
        task.progress = { numerator: completedMins, denominator: scheduledMins }
        // compute scheduled percent (based on estimatedHours)
        const expectedMins = (task.estimatedHours && Number(task.estimatedHours) > 0) ? Math.round(Number(task.estimatedHours) * 60) : 0
        let scheduledPercent = 0
        if (!scheduledMins || scheduledMins <= 0) scheduledPercent = 0
        else if (expectedMins > 0 && scheduledMins + 20 >= expectedMins) scheduledPercent = 100
        else if (expectedMins > 0) scheduledPercent = Math.round((scheduledMins / expectedMins) * 100)
        // compute progress percent (completed / scheduled)
        let progressPercent = 0
        if (scheduledMins > 0) progressPercent = Math.round((completedMins / scheduledMins) * 100)
        // combined percent = scheduledPercent * progressPercent / 100
        const combined = Math.round((scheduledPercent * progressPercent) / 100)
        task.completionPercent = combined
        // cache individual percents for UI to read (store authoritative values)
        task.scheduledPercent = scheduledPercent
        task.progressPercent = progressPercent
        // 标记完成：当合成百分比达到或超过100时视为已完成
        if (combined >= 100) task.status = 'completed'
        else if (!task.status) task.status = 'active'
        this.saveTasks()
      } catch (e) {
        console.warn('refreshProgressForTask failed', e)
      }
    },
    // 刷新所有任务的进度（遍历 tasks）
    refreshProgressForAll() {
      try {
        for (const t of this.tasks) {
          this.refreshProgressForTask(t.id)
        }
      } catch (e) {
        console.warn('refreshProgressForAll failed', e)
      }
    }
  }
})

/**
 * @typedef Task
 * @property {string} id
 * @property {string} name
 * @property {string} deadline
 * @property {number} estimatedHours
 * @property {{numerator:number,denominator:number}} progress
 * @property {string} [notes]
 * @property {'active'|'completed'|'archived'} [status]
 */
