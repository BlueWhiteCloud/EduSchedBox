<template>
  <div class="constraints-editor">
    <div class="header">
      <span>课表与限制设置</span>
      <!-- <button @click="$emit('close')">关闭</button> -->
    </div>
    <div class="content">
      <div class="section">
        <h4>每周课表（点击格子设置上课时间；按住并拖动可批量设置/取消）</h4>
        <table class="constraints-table">
          <thead>
            <tr>
              <th>时间段</th>
              <th v-for="day in weekDays" :key="day.index">{{ day.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(slot, rowIdx) in timeSlots" :key="slot">
              <td class="slot-label">{{ slot }}</td>
              <td v-for="day in weekDays" :key="day.index"
                  :class="cellClass(day.index, slot, rowIdx)"
                  @click="onCellClick(day.index, slot, rowIdx, $event)"
                  @mousedown.prevent="onCellMouseDown(day.index, slot, rowIdx, day.index, $event)"
                  @mouseenter="onCellMouseEnter(day.index, slot, rowIdx, day.index)"
                  @mouseleave="onCellMouseLeave()">
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="section">
        <h4>偏好限制（勾选时间段）</h4>
        <div class="pref-row">
          <label>休息时间段</label>
          <div class="slots">
            <label v-for="slot in timeSlots" :key="slot" class="slot-checkbox">
              <input type="checkbox" :value="slot" v-model="localPreferences.restSlots" />
              {{ slot }}
            </label>
          </div>
        </div>
        <div class="pref-row">
          <label>避免工作时间段</label>
          <div class="slots">
            <label v-for="slot in timeSlots" :key="slot" class="slot-checkbox">
              <input type="checkbox" :value="slot" v-model="localPreferences.avoidWorkSlots" />
              {{ slot }}
            </label>
          </div>
        </div>
      </div>
      <div class="actions">
        <div class="btn btn-cancel" @click="$emit('close')">取消</div>
        <div class="btn btn-save" @click="save">保存</div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { useConstraintsStore } from '../stores/constraints.js'

export default {
  name: 'ConstraintsEditor',
  emits: ['close'],
  setup(props, { emit }) {
    const store = useConstraintsStore()
    const weekDays = [
      { index: 1, name: '周一' },
      { index: 2, name: '周二' },
      { index: 3, name: '周三' },
      { index: 4, name: '周四' },
      { index: 5, name: '周五' },
      { index: 6, name: '周六' },
      { index: 7, name: '周日' }
    ]
    const timeSlots = [
      '08:00', '09:40', '10:20', '12:00',
      '14:30', '16:10', '18:00', '19:40',
      '21:20', '22:00', '23:00', '00:00'
    ]

    const localClasses = reactive({})
    weekDays.forEach(day => {
      localClasses[day.index] = store.classes.find(c => c.weekDay === day.index)?.slots?.slice() || []
    })
    const localPreferences = reactive({ ...store.preferences })

    // dragging state
    const dragging = ref(false)
    const dragStart = ref(null)
    const dragEnd = ref(null)
    const dragAxis = ref(null) // 'row' or 'col'
    const suppressClick = ref(false)

    function isClassSelected(weekDay, slot) {
      return localClasses[weekDay]?.includes(slot)
    }

    function toggleClass(weekDay, slot) {
      if (!localClasses[weekDay]) localClasses[weekDay] = []
      const index = localClasses[weekDay].indexOf(slot)
      if (index > -1) {
        localClasses[weekDay].splice(index, 1)
      } else {
        localClasses[weekDay].push(slot)
      }
    }

    function onCellClick(weekDay, slot, rowIdx, ev) {
      // prevent click if it was part of a drag operation
      if (suppressClick.value) {
        suppressClick.value = false
        return
      }
      toggleClass(weekDay, slot)
    }

    function onCellMouseDown(weekDay, slot, rowIdx, colIdx, ev) {
      dragging.value = true
      dragStart.value = { weekDay, slot, rowIdx, colIdx }
      dragEnd.value = { weekDay, slot, rowIdx, colIdx }
      dragAxis.value = null
      ev.preventDefault()
    }

    function onCellMouseEnter(weekDay, slot, rowIdx, colIdx) {
      if (!dragging.value || !dragStart.value) return
      // axis lock: choose the predominant movement direction and lock
      const rowDiff = Math.abs(rowIdx - dragStart.value.rowIdx)
      const colDiff = Math.abs(colIdx - dragStart.value.colIdx)
      if (!dragAxis.value) {
        if (rowDiff > colDiff) {
          // moved more vertically -> lock to column (same weekday)
          dragAxis.value = 'col'
        } else if (colDiff > rowDiff) {
          // moved more horizontally -> lock to row (same row index)
          dragAxis.value = 'row'
        }
        // if equal and both zero, remain null until a move occurs
      }
      dragEnd.value = { weekDay, slot, rowIdx, colIdx }
    }

    function onCellMouseLeave() {
      // no-op, we rely on document mouseup to finish
    }

    function finishDrag() {
      if (!dragging.value || !dragStart.value || !dragEnd.value) {
        dragging.value = false
        dragAxis.value = null
        dragStart.value = null
        dragEnd.value = null
        return
      }
      const cells = _rangeCells(dragStart.value, dragEnd.value, dragAxis.value)
      if (cells.length) {
        // if all selected => remove them; else add them
        const allSelected = cells.every(c => (localClasses[c.weekDay] || []).includes(c.slotKey))
        for (const c of cells) {
          if (!localClasses[c.weekDay]) localClasses[c.weekDay] = []
          const idx = localClasses[c.weekDay].indexOf(c.slotKey)
          if (allSelected) {
            if (idx > -1) localClasses[c.weekDay].splice(idx, 1)
          } else {
            if (idx === -1) localClasses[c.weekDay].push(c.slotKey)
          }
        }
        // suppress click event after drag
        suppressClick.value = true
        setTimeout(() => { suppressClick.value = false }, 200)
      }
      dragging.value = false
      dragStart.value = null
      dragEnd.value = null
      dragAxis.value = null
    }

    function _rangeCells(a, b, axis) {
      const list = []
      if (!a || !b) return list
      let usedAxis = axis
      if (!usedAxis) {
        const rowDiff = Math.abs(a.rowIdx - b.rowIdx)
        const colDiff = Math.abs(a.colIdx - b.colIdx)
        usedAxis = rowDiff > colDiff ? 'col' : 'row'
      }
      if (usedAxis === 'row') {
        const row = a.rowIdx
        const startCol = Math.min(a.colIdx, b.colIdx)
        const endCol = Math.max(a.colIdx, b.colIdx)
        for (let col = startCol; col <= endCol; col++) {
          const slotKey = timeSlots[row]
          list.push({ weekDay: col, slotKey })
        }
        return list
      }
      if (usedAxis === 'col') {
        const col = a.colIdx
        const startRow = Math.min(a.rowIdx, b.rowIdx)
        const endRow = Math.max(a.rowIdx, b.rowIdx)
        for (let row = startRow; row <= endRow; row++) {
          const slotKey = timeSlots[row]
          list.push({ weekDay: col, slotKey })
        }
        return list
      }
      return list
    }

    function cellClass(weekDay, slot, rowIdx) {
      const base = []
      if (isClassSelected(weekDay, slot)) base.push('selected')
      if (dragging.value && dragStart.value && dragEnd.value) {
        const startRow = Math.min(dragStart.value.rowIdx, dragEnd.value.rowIdx)
        const endRow = Math.max(dragStart.value.rowIdx, dragEnd.value.rowIdx)
        const startCol = Math.min(dragStart.value.colIdx, dragEnd.value.colIdx)
        const endCol = Math.max(dragStart.value.colIdx, dragEnd.value.colIdx)
        if (dragAxis.value === 'row') {
          // highlight only along the same row
          if (rowIdx === dragStart.value.rowIdx && weekDay >= startCol && weekDay <= endCol) base.push('dragging')
        } else if (dragAxis.value === 'col') {
          // highlight only along the same column
          if (weekDay === dragStart.value.colIdx && rowIdx >= startRow && rowIdx <= endRow) base.push('dragging')
        } else {
          // if axis not set yet, highlight only the start cell
          if (rowIdx === dragStart.value.rowIdx && weekDay === dragStart.value.colIdx) base.push('dragging')
        }
      }
      return base.join(' ')
    }

    function save() {
      const classes = weekDays.map(day => ({
        weekDay: day.index,
        slots: (localClasses[day.index] || []).slice()
      })).filter(c => c.slots.length > 0)
      store.setClasses(classes)
      store.setPreferences(localPreferences)
      emit('close')
    }

    onMounted(() => {
      window.addEventListener('mouseup', finishDrag)
      window.addEventListener('mouseleave', finishDrag)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('mouseup', finishDrag)
      window.removeEventListener('mouseleave', finishDrag)
    })

    return {
      weekDays,
      timeSlots,
      localClasses,
      localPreferences,
      isClassSelected,
      toggleClass,
      save,
      onCellMouseDown,
      onCellMouseEnter,
      onCellMouseLeave,
      onCellClick,
      cellClass
    }
  }
}
</script>

<style scoped>
.constraints-editor {
  background: var(--panel, #1E2327);
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header span {
  font-weight: 600;
}
button {
  background: var(--accent, #5f9bff);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  /* cursor: url('./assets/cursors/my-pointer-cursor.svg'), pointer; */
}
.section {
  margin-bottom: 20px;
}
.section h4 {
  margin-bottom: 10px;
  color: var(--text, #e6e8eb);
}
.constraints-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel, #1E2327);
  margin-bottom: 20px;
}
.constraints-table th, .constraints-table td {
  border: 1px solid #232a36;
  padding: 4px;
  text-align: center;
  color: var(--text, #e6e8eb);
}
.constraints-table th {
  background: var(--bg, #0f1216);
}
.constraints-table .slot-label {
  background: var(--panel, #1E2327);
  font-weight: 500;
}
.constraints-table td.selected {
  background: var(--accent, #5f9bff);
  cursor: url('./assets/cursors/my-pointer-cursor.svg'), pointer;
}
.constraints-table td.dragging {
  background: #2a3a5a;
  outline: 2px solid #5f9bff;
}
.constraints-table td:not(.slot-label) {
  cursor: url('./assets/cursors/my-pointer-cursor.svg'), pointer;
}
.actions {
  display: flex;
  justify-content: flex-end;
  /* gap: 10px; */
}
.btn-cancel{
  font-size: 0.9em;
  padding-left: 8px;
  padding-right: 8px;
  background-color: var(--theme-color-light);
  border-radius: 4px;
  user-select: none;
  width: auto;
}
.btn-save{
  font-size: 0.9em;
  padding-left: 8px;
  padding-right: 8px;
  background-color: var(--accent, #3CFFEF);
  border-radius: 4px;
  user-select: none;
  width: auto;
}
</style>