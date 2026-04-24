import { defineStore } from 'pinia'

export const useConstraintsStore = defineStore('constraints', {
  state: () => ({
    classes: /** @type {Array<{weekDay: number, slots: string[]}>} */ ([]),
    preferences: {
      restSlots: /** @type {string[]} */ ([]),
      avoidWorkSlots: /** @type {string[]} */ ([])
    }
  }),
  actions: {
    setClasses(classes) {
      this.classes = classes
      this.saveConstraints()
    },
    setPreferences(preferences) {
      this.preferences = preferences
      this.saveConstraints()
    },
    loadConstraints() {
      try {
        const raw = localStorage.getItem('constraints')
        if (raw) {
          const data = JSON.parse(raw)
          this.classes = data.classes || []
          this.preferences = data.preferences || { restSlots: [], avoidWorkSlots: [] }
        }
      } catch (e) {
        console.warn('loadConstraints error', e)
      }
    },
    saveConstraints() {
      try {
        const data = { classes: this.classes, preferences: this.preferences }
        localStorage.setItem('constraints', JSON.stringify(data))
      } catch (e) {
        console.error('saveConstraints error', e)
      }
    },
    isRestricted(weekDay, slotKey) {
      // Check classes
      const classDay = this.classes.find(c => c.weekDay === weekDay)
      if (classDay && classDay.slots.includes(slotKey)) return true
      // Check preferences
      if (this.preferences.restSlots.includes(slotKey)) return true
      if (this.preferences.avoidWorkSlots.includes(slotKey)) return true
      return false
    }
  }
})