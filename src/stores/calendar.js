import { defineStore } from 'pinia'

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    weekStart: '', // YYYY-MM-DD
    cells: /** @type {Array<CalendarCell>} */ ([])
  }),
  actions: {
    setWeek(weekStart, cells) {
      this.weekStart = weekStart
      this.cells = cells
      console.log('calendar.store.setWeek:', weekStart, 'cellsCount=', Array.isArray(cells) ? cells.length : 0)
      try {
        localStorage.setItem(`calendar:${weekStart}`, JSON.stringify(cells))
      } catch (e) {
        // ignore storage errors
      }
    },
    loadWeek(weekStart) {
      try {
        const raw = localStorage.getItem(`calendar:${weekStart}`)
        if (raw) {
          this.weekStart = weekStart
          this.cells = JSON.parse(raw)
          return true
        }
      } catch (e) {
        console.warn('loadWeek error', e)
      }
      return false
    },
    updateCell(weekDay, slotKey, patch) {
      const idx = this.cells.findIndex(c => c.weekDay === weekDay && c.slotKey === slotKey)
      if (idx !== -1) {
        Object.assign(this.cells[idx], patch)
        console.log('calendar.store.updateCell:', weekDay, slotKey, patch)
        try {
          if (this.weekStart) localStorage.setItem(`calendar:${this.weekStart}`, JSON.stringify(this.cells))
        } catch (e) {}
      }
    },
    clearCell(weekDay, slotKey) {
      const idx = this.cells.findIndex(c => c.weekDay === weekDay && c.slotKey === slotKey)
      if (idx !== -1) {
        this.cells[idx].eventName = ''
        this.cells[idx].notes = ''
        this.cells[idx].taskId = ''
        // ensure completed flag is cleared when a cell is cleared
        this.cells[idx].completed = false
        try {
          if (this.weekStart) localStorage.setItem(`calendar:${this.weekStart}`, JSON.stringify(this.cells))
        } catch (e) {}
      }
    }
  }
})

/**
 * @typedef CalendarCell
 * @property {number} weekDay // 1=周一
 * @property {string} slotKey
 * @property {string} [eventName]
 * @property {string} [notes]
 * @property {string} [taskId]
 */
