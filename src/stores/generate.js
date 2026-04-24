import { defineStore } from 'pinia'
import { useTaskStore } from './task.js'
import { useConstraintsStore } from './constraints.js'

export const useGenerateStore = defineStore('generate', {
  state: () => ({
    loading: false,
    error: null,
    lastResult: null // CalendarWeek
  }),
  actions: {
    async requestGenerate(payload) {
      this.loading = true
      this.error = null
      try {
        if (window && window.electronAPI && window.electronAPI.generateRequest) {
          // IPC requires structured-clonable data; clone to plain objects to avoid Proxy/non-cloneable issues
          let safePayload = payload
          try {
            safePayload = payload ? JSON.parse(JSON.stringify(payload)) : payload
          } catch (e) {
            console.warn('requestGenerate: payload could not be serialized, sending original payload', e)
          }
          const res = await window.electronAPI.generateRequest(safePayload)
          console.log('requestGenerate: received response from electronAPI.generateRequest', res && res.__meta ? { source: res.__meta.source, improved: res.__meta.improved_from_basic || false, provisional: res.__meta.provisional || false } : res)
          this.lastResult = res
        } else {
          // fallback to simple mock
          const timeSlots = [
            '08:00','09:40','10:20','12:00','14:30','16:10','18:00','19:40','21:20','22:00','23:00','00:00'
          ]
          const days = []
          // if payload provided, honor weekStart and tasks for a better mock
          const weekIso = (payload && payload.weekStart) || (() => { const d = new Date(); const pad = n => (n < 10 ? `0${n}` : `${n}`); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` })()
          // build 7 days with simple sample slots; include date fields based on weekIso
          const baseDateParts = weekIso.split('-').map(Number)
          const startDate = new Date(baseDateParts[0], baseDateParts[1]-1, baseDateParts[2])
          for (let dIdx = 0; dIdx < 7; dIdx++) {
            const dayDate = new Date(startDate); dayDate.setDate(startDate.getDate() + dIdx)
            const slots = []
            for (let s = 0; s < 2; s++) {
              const t = timeSlots[(dIdx + s) % timeSlots.length]
              slots.push({ time: t, activity: `示例任务 ${dIdx+1}-${s+1}`, durationHours: 1, notes: '', taskName: `示例任务 ${dIdx+1}-${s+1}`, taskId: '' })
            }
            days.push({ date: `${dayDate.getFullYear()}-${(dayDate.getMonth()+1).toString().padStart(2,'0')}-${dayDate.getDate().toString().padStart(2,'0')}`, weekday: dIdx+1, slots })
          }
          this.lastResult = { weekStart: weekIso, days, taskSummary: [], conflicts: [], __meta: { source: 'mock', provisional: true } }
        }
        // persist
        try { localStorage.setItem('lastGenerated', JSON.stringify(this.lastResult)) } catch (e) {}
        return this.lastResult
      } catch (e) {
        this.error = e
        console.error('requestGenerate error', e)
        throw e
      } finally {
        this.loading = false
      }
    },
    async requestGenerateBasic(payload) {
      console.log('requestGenerateBasic: called with payload', payload)
      this.loading = true
      this.error = null
      try {
        if (window && window.electronAPI && window.electronAPI.generateBasicRequest) {
          console.log('requestGenerateBasic: electronAPI.generateBasicRequest exists')
          // IPC requires structured-clonable data; clone to plain objects to avoid Proxy/non-cloneable issues
          let safePayload = payload
          try {
            safePayload = payload ? JSON.parse(JSON.stringify(payload)) : payload
          } catch (e) {
            console.warn('requestGenerateBasic: payload could not be serialized, sending original payload', e)
          }
          console.log('requestGenerateBasic: calling electronAPI.generateBasicRequest')
          const res = await window.electronAPI.generateBasicRequest(safePayload)
          console.log('requestGenerateBasic: electronAPI.generateBasicRequest returned', res)
          this.lastResult = res
          console.log('requestGenerateBasic: set lastResult to', this.lastResult)
        } else {
          console.warn('requestGenerateBasic: electronAPI.generateBasicRequest not available, using fallback')
          // fallback to simple mock for basic
          const timeSlots = [
            '08:00','09:40','10:20','12:00','14:30','16:10','18:00','19:40','21:20','22:00','23:00','00:00'
          ]
          const days = []
          // if payload provided, honor weekStart and tasks for a better mock
          const weekIso = (payload && payload.weekStart) || (() => { const d = new Date(); const pad = n => (n < 10 ? `0${n}` : `${n}`); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` })()
          // build 7 days with simple sample slots; include date fields based on weekIso
          const baseDateParts = weekIso.split('-').map(Number)
          const startDate = new Date(baseDateParts[0], baseDateParts[1]-1, baseDateParts[2])
          for (let dIdx = 0; dIdx < 7; dIdx++) {
            const dayDate = new Date(startDate); dayDate.setDate(startDate.getDate() + dIdx)
            const slots = []
            for (let s = 0; s < 2; s++) {
              const t = timeSlots[(dIdx + s) % timeSlots.length]
              slots.push({ time: t, activity: `基础任务 ${dIdx+1}-${s+1}`, durationHours: 1, notes: '', taskName: `基础任务 ${dIdx+1}-${s+1}`, taskId: '' })
            }
            days.push({ date: `${dayDate.getFullYear()}-${(dayDate.getMonth()+1).toString().padStart(2,'0')}-${dayDate.getDate().toString().padStart(2,'0')}`, weekday: dIdx+1, slots })
          }
          this.lastResult = { weekStart: weekIso, days, taskSummary: [], conflicts: [], __meta: { source: 'basic', fallback: true } }
        }
        // persist
        try { localStorage.setItem('lastGenerated', JSON.stringify(this.lastResult)) } catch (e) {}
        return this.lastResult
      } catch (e) {
        this.error = e
        console.error('requestGenerateBasic error', e)
        throw e
      } finally {
        this.loading = false
      }
    },
    loadLast() {
      try {
        const raw = localStorage.getItem('lastGenerated')
        if (raw) this.lastResult = JSON.parse(raw)
      } catch (e) {
        console.warn('loadLast generate error', e)
      }
    },
    analyzeSchedule(result) {
      // result: CalendarWeek
      const taskStore = useTaskStore()
      const constraintsStore = useConstraintsStore()
      const taskSummary = []
      const conflicts = []
      if (!result || !result.days) return { taskSummary, conflicts }
      // accumulate scheduled hours per taskId or taskName
      const map = {}
      for (const day of result.days) {
        for (const s of day.slots) {
          const id = s.taskId || s.taskName || '__unassigned'
          map[id] = map[id] || { scheduledHours: 0, slots: [] }
          map[id].scheduledHours += (s.durationHours || 0)
          map[id].slots.push({ weekday: day.weekday, time: s.time })
          // constraint conflict
          if (constraintsStore.isRestricted(day.weekday, s.time)) {
            conflicts.push({ type: 'constraint', message: `Slot ${day.weekday}-${s.time} conflicts with constraints`, detail: { weekday: day.weekday, time: s.time } })
          }
        }
      }
      for (const t of taskStore.tasks) {
        const id = t.id
        const rec = map[id] || { scheduledHours: 0, slots: [] }
        const beforeDeadline = (() => {
          if (!t.deadline) return null
          try {
            const dlDate = new Date(t.deadline)
            // check if any scheduled slot date is after deadline: we only have weekdays, so we conservatively check weekStart
            const parseISOToLocal = iso => {
              try { const [y,m,day] = iso.split('-').map(Number); return new Date(y, m-1, day) } catch { return new Date(iso) }
            }
            const weekStart = parseISOToLocal(result.weekStart)
            const endDates = rec.slots.map(s => { const d = new Date(weekStart); d.setDate(d.getDate() + (s.weekday - 1)); return d })
            const anyAfter = endDates.some(d => d > dlDate)
            return !anyAfter
          } catch (e) {
            return null
          }
        })()
        taskSummary.push({ taskName: t.name, taskId: t.id, estimatedHours: t.estimatedHours, scheduledHours: rec.scheduledHours, beforeDeadline, conflicts: [] })
      }
      return { taskSummary, conflicts }
    }
  }
})