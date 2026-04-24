<template>
  <div class="calendar-grid" :class="{ compact: compact }" :style="{'--rows': timeSlots.length}">
    <table>
      <thead>
        <tr>
          <th class="slot-header">时间段</th>
          <th v-for="(day, i) in weekDays" :key="i">{{ day }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(slot, rowIdx) in timeSlots" :key="slot">
          <td class="slot-label" :title="slot">{{ compact ? slot.split('-')[0] : slot }}</td>
              <td v-for="col in 7" :key="col"
                :class="[cellClass(rowIdx, col), { 'dragging': isInDragAxis(rowIdx, col) && !deleteMode, 'drag-delete': isInDragAxis(rowIdx, col) && deleteMode }]"
              @click="onCellClick(col, slot)"
              :disabled="fillMode && !selectedTask && !deleteMode"
              @mousedown.prevent="onCellMouseDown(col, slot, rowIdx, col, $event)"
              @mouseenter="(e) => { onCellHover(rowIdx, col); onCellMouseEnter(col, slot, rowIdx, col) }"
              @mouseleave="onCellHover(-1, -1)"
              @contextmenu.prevent="onCellRightClick(col, slot)">
            <div v-if="cellMap[col] && cellMap[col][slot] && cellMap[col][slot].eventName">
              <span class="cell-event clickable">{{ cellMap[col][slot].eventName }}</span>
              <span v-if="cellMap[col][slot].notes" class="cell-notes">({{ cellMap[col][slot].notes }})</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { useConstraintsStore } from '../stores/constraints.js'
import { useCalendarStore } from '../stores/calendar.js'

export default {
  name: 'CalendarGrid',
  props: {
    fillMode: Boolean,
    selectedTask: Object,
    deleteMode: Boolean,
    compact: Boolean,
    calendarCells: Array,
    highlightedCells: { type: [Array, Object], default: () => [] }
  },
  emits: ['fill-slot', 'clear-slot', 'edit-slot', 'fill-range', 'clear-range'],
  data() {
    return {
      weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      timeSlots: [
        '08:00', '09:40', '10:20', '12:00',
        '14:30', '16:10', '18:00', '19:40',
        '21:20', '22:00', '23:00', '00:00'
      ],
      hoverCell: { row: -1, col: -1 },
      // drag selection
      dragging: false,
      dragStart: null,
      dragEnd: null,
      dragAxis: null // 'row' or 'col'
    }
  },
  computed: {
    cellMap() {
      // cellMap[weekDay][slotKey] = cell
      const map = {}
      if (Array.isArray(this.calendarCells)) {
        for (const cell of this.calendarCells) {
          if (!map[cell.weekDay]) map[cell.weekDay] = {}
          map[cell.weekDay][cell.slotKey] = cell
        }
      }
      return map
    }
  },
  methods: {
    onCellClick(weekDay, slotKey) {
      const cell = (this.cellMap[weekDay] || {})[slotKey]
      const calendarStore = useCalendarStore()
      if (this.deleteMode) {
        if (cell && (cell.eventName || cell.notes)) this.$emit('clear-slot', { weekDay, slotKey })
        return
      }
      // fill mode still fills
      if (this.fillMode && this.selectedTask) {
        this.$emit('fill-slot', { weekDay, slotKey })
        return
      }
      // when not in any special mode, toggle completed status for assigned cells
      if (cell && (cell.eventName || cell.taskId)) {
        const newCompleted = !Boolean(cell.completed)
        calendarStore.updateCell(weekDay, slotKey, { completed: newCompleted })
        return
      }
      // fallback: if empty cell and not in fill/delete, do nothing
    },
    onCellMouseDown(weekDay, slotKey, rowIdx, colIdx, ev) {
      if (!(this.deleteMode || (this.fillMode && this.selectedTask))) return
      this.dragging = true
      this.dragStart = { weekDay, slotKey, rowIdx, colIdx }
      this.dragEnd = { weekDay, slotKey, rowIdx, colIdx }
      // prevent text selection while dragging
      ev.preventDefault()
    },
    onCellMouseEnter(weekDay, slotKey, rowIdx, colIdx) {
      if (!this.dragging) return
      // determine axis lock if needed
      if (!this.dragAxis && this.dragStart) {
        const rowDiff = Math.abs(rowIdx - this.dragStart.rowIdx)
        const colDiff = Math.abs(colIdx - this.dragStart.colIdx)
        // if both moved, choose predominant direction
        if (rowDiff > 0 && colDiff > 0) {
          this.dragAxis = colDiff > rowDiff ? 'row' : 'col'
        } else if (rowDiff > 0) {
          this.dragAxis = 'col'
        } else if (colDiff > 0) {
          this.dragAxis = 'row'
        }
      }
      this.dragEnd = { weekDay, slotKey, rowIdx, colIdx }
    },
    finishDrag() {
      if (!this.dragging || !this.dragStart || !this.dragEnd) {
        this.dragging = false
        this.dragAxis = null
        return
      }
      const cells = this._rangeCells(this.dragStart, this.dragEnd, this.dragAxis)
      if (cells.length) {
        if (this.deleteMode) this.$emit('clear-range', { cells })
        else this.$emit('fill-range', { cells })
      }
      this.dragging = false
      this.dragStart = null
      this.dragEnd = null
      this.dragAxis = null
    },
    _rangeCells(a, b, axis) {
      // a/b: { weekDay, slotKey, rowIdx, colIdx }
      const list = []
      if (axis === 'row') {
        const row = a.rowIdx
        const startCol = Math.min(a.colIdx, b.colIdx)
        const endCol = Math.max(a.colIdx, b.colIdx)
        for (let col = startCol; col <= endCol; col++) {
          const slotKey = this.timeSlots[row]
          list.push({ weekDay: col, slotKey })
        }
        return list
      }
      if (axis === 'col') {
        const col = a.colIdx
        const startRow = Math.min(a.rowIdx, b.rowIdx)
        const endRow = Math.max(a.rowIdx, b.rowIdx)
        for (let row = startRow; row <= endRow; row++) {
          const slotKey = this.timeSlots[row]
          list.push({ weekDay: col, slotKey })
        }
        return list
      }
      // fallback: rectangle
      const startRow = Math.min(a.rowIdx, b.rowIdx)
      const endRow = Math.max(a.rowIdx, b.rowIdx)
      const startCol = Math.min(a.colIdx, b.colIdx)
      const endCol = Math.max(a.colIdx, b.colIdx)
      for (let col = startCol; col <= endCol; col++) {
        for (let row = startRow; row <= endRow; row++) {
          const slotKey = this.timeSlots[row]
          list.push({ weekDay: col, slotKey })
        }
      }
      return list
    },
    onCellRightClick(weekDay, slotKey) {
      if ((this.fillMode && this.selectedTask) || this.deleteMode) {
        this.$emit('clear-slot', { weekDay, slotKey })
      }
    },
    onCellHover(row, col) {
      // Do not set hover highlight while dragging; we only want axis highlights then
      if (this.dragging) {
        this.hoverCell = { row: -1, col: -1 }
        return
      }
      this.hoverCell = { row, col }
    },
    cellClass(rowIdx, col) {
      const base = []
      const constraintsStore = useConstraintsStore()
      const weekDay = col
      const slotKey = this.timeSlots[rowIdx]
      if (constraintsStore.isRestricted(weekDay, slotKey)) {
        base.push('restricted')
      }
      if (this.fillMode) {
        if (this.selectedTask) base.push('fillable')
        else base.push('disabled')
      }
      if (this.deleteMode) {
        base.push('deletable')
      }
      // show hover only when NOT dragging; while dragging we use axis-only highlights
      if (!this.dragging && this.hoverCell.row === rowIdx && this.hoverCell.col === col) {
        if (this.fillMode && this.selectedTask) base.push('hovered')
        if (this.deleteMode) base.push('hovered-delete')
      }
      // highlight invalid cells (from parent validation)
      try {
        const key = `${weekDay}|${slotKey}`
        if (this.highlightedCells) {
          if (this.highlightedCells.has && this.highlightedCells.has(key)) base.push('highlight-invalid')
          else if (Array.isArray(this.highlightedCells) && this.highlightedCells.includes(key)) base.push('highlight-invalid')
        }
      } catch (e) { /* ignore */ }
      // completed state from cellMap
      try {
        const cell = (this.cellMap[weekDay] || {})[slotKey]
        if (cell && cell.completed) base.push('completed')
        // mark cells that have an assigned event/task so we can show pointer cursor
        if (cell && (cell.eventName || cell.taskId)) base.push('has-event')
      } catch (e) {}
      return base.join(' ')
    },
    isInDrag(rowIdx, colIdx) {
      if (!this.dragging || !this.dragStart || !this.dragEnd) return false
      const startRow = Math.min(this.dragStart.rowIdx, this.dragEnd.rowIdx)
      const endRow = Math.max(this.dragStart.rowIdx, this.dragEnd.rowIdx)
      const startCol = Math.min(this.dragStart.colIdx, this.dragEnd.colIdx)
      const endCol = Math.max(this.dragStart.colIdx, this.dragEnd.colIdx)
      return rowIdx >= startRow && rowIdx <= endRow && colIdx >= startCol && colIdx <= endCol
    },
    isInDragAxis(rowIdx, colIdx) {
      if (!this.dragging || !this.dragStart || !this.dragEnd) return false
      const startRow = Math.min(this.dragStart.rowIdx, this.dragEnd.rowIdx)
      const endRow = Math.max(this.dragStart.rowIdx, this.dragEnd.rowIdx)
      const startCol = Math.min(this.dragStart.colIdx, this.dragEnd.colIdx)
      const endCol = Math.max(this.dragStart.colIdx, this.dragEnd.colIdx)
      if (this.dragAxis === 'row') {
        return rowIdx === this.dragStart.rowIdx && colIdx >= startCol && colIdx <= endCol
      }
      if (this.dragAxis === 'col') {
        return colIdx === this.dragStart.colIdx && rowIdx >= startRow && rowIdx <= endRow
      }
      // axis not set yet: only highlight start cell
      return rowIdx === this.dragStart.rowIdx && colIdx === this.dragStart.colIdx
    }
  }
  ,
  mounted() {
    window.addEventListener('mouseup', this.finishDrag)
    window.addEventListener('mouseleave', this.finishDrag)
  },
  beforeUnmount() {
    window.removeEventListener('mouseup', this.finishDrag)
    window.removeEventListener('mouseleave', this.finishDrag)
  }
}
</script>

<style scoped>
.calendar-grid {
  width: 100%;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  /* Firefox 滚动条全局属性 */
  /* scrollbar-color: var(--theme-color-light) var(--theme-color-dark); */
}

.calendar-grid {
  --rows: 12;
  --header-height: 36px;
  /* per-cell clamp settings */
  --cell-line-height: 18px;
  --cell-max-lines: 3;
}
table {
  width: 100%;
  height: 100%;
  table-layout: fixed;
  /* use separate model with zero spacing to avoid collapsed-border rendering seams
     when header becomes sticky (subpixel rounding issues on some DPRs) */
  border-collapse: separate;
  border-spacing: 0;
  background: var(--panel, #1E2327);
  /* border:2px solid var(--theme-color-light) */
  /* 内投影 */
  
}

/* Ensure content shows a normal/default cursor everywhere in the calendar */
.calendar-grid th,
.calendar-grid td {
  cursor:  url('../assets/cursors/my-cursor.svg'), default;
}

/* assigned cells should show clickable pointer */
.calendar-grid td.has-event {
  cursor: url('../assets/cursors/my-pointer-cursor.svg'), pointer;
}

.calendar-grid {
  position: relative;
}

/* Compact mode: disable text selection and prevent pointer events (no clicks, hovers, context menu, etc.) */
.calendar-grid.compact,
.calendar-grid.compact * {
  -webkit-user-select: none;
  user-select: none;
}
.calendar-grid.compact th,
.calendar-grid.compact td {
  pointer-events: none;
}
thead th {
  height: var(--header-height, 36px);
  background: var(--theme-color-dark, #800080);
  /* font-weight: 600; */
  position: sticky;
  top: 0;
  z-index: 3;
  border-top: none;
  border-color: var(--theme-color-light, #FE19FF);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(0);
}
th, td {
  border: 2px solid var(--theme-color-dark);
  /* remove fixed min-width & height to allow flexible sizing */
  text-align: center;
  color: var(--text, #e6e8eb);
  box-sizing: border-box;
  padding: 4px 6px;
  font-weight: normal;
}
th:not(:first-child), td:not(:first-child) {
  border-left: none;
}

th:first-child, td:first-child {
  border-left: none;
}

.slot-header {
  /* remove min-width; allow flexible sizing */
  background:  var(--theme-color-dark);
}
.slot-label {
  background:  var(--theme-color-dark);
  /* font-weight: 500; */
  border-color: var(--theme-color-light);
}
/* 周日列右侧边框改为主题色 */
thead th:nth-child(8),
tbody td:nth-child(8) {
  border-right: none;
}
/* distribute remaining height across rows evenly */
tbody tr {
  height: calc((100% - var(--header-height, 36px)) / var(--rows));
  max-height: 10px;
}
.calendar-grid table td {
  vertical-align: middle;
  /* allow wrapping like header so text can occupy multiple lines instead of truncating */
  white-space: normal;
  overflow: hidden;
  /* max-height:5px; */
  /* background-color: #5f9bff; */
  /* max-height: 5px; */
}
/* allow td to shrink in constrained layouts so child clamps can work */
.calendar-grid td {
  min-width: 0;
}
/* remove bottom border from last row */
tbody tr:last-child td {
  border-bottom: none;
}
/* when using separate borders, avoid double visual seam by hiding the top border of body cells
   so the header's bottom border (or shadow) is the visible divider */
.calendar-grid tbody td {
  border-top: none;
}
/* clamp long content inside a cell to a maximum number of lines, then show ellipsis */
.cell-event {
  line-height: var(--cell-line-height);
  max-height: calc(var(--cell-line-height) * var(--cell-max-lines));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--cell-max-lines);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  width: 100%;
  min-width: 0;
  word-break: break-word;
  hyphens: auto;
}
.completed {
  /* use color-mix so editors show the hex --accent color directly while producing a semi-transparent result */
  background: color-mix(in srgb, var(--accent) 50%, transparent) !important;
  color: #ffffff !important;
}
.restricted {
  background: color-mix(in srgb, var(--warning) 40%, transparent) !important;
  opacity: 0.6;
  cursor: not-allowed;
}
.fillable {
  cursor: url('../assets/cursors/my-pointer-cursor.svg'), pointer;
  background: #1a2332;
  transition: background 0.15s;
}
.fillable.hovered {
  background: #2a3a5a;
  outline: 2px solid #5f9bff;
}
.disabled {
  cursor: not-allowed;
  background: #181e2a;
  opacity: 0.5;
}
.deletable {
  cursor: url('./assets/cursors/my-pointer-cursor.svg'), pointer;
  background: #2a1818;
}
.deletable.hovered-delete {
  background: #5a2a2a;
  outline: 2px solid var(--warning,#ff5f5f);
}
.dragging {
  background: #2a3a5a;
  outline: 2px solid #5f9bff;
}
.drag-delete {
  background: #5a2a2a;
  outline: 2px solid var(--warning,#ff5f5f);
}
.highlight-invalid {
  background: color-mix(in srgb, var(--warning) 85%, transparent) !important;
  transition: background 160ms, outline 160ms;
}
</style>
