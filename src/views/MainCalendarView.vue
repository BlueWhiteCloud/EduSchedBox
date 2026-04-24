<template>
  <div class="main-calendar-view">

    <!-- <div v-if="validationMessage && !isCompact" class="validation-bar">{{ validationMessage }}</div> -->
    <div class="main-content">
      <div v-if="!isCompact" class="left-side">
        <TaskList
          @select-task="onSelectTask"
          :selectedTaskId="selectedTaskId"
          :fillMode="fillMode"
        />
        <!-- <div class="task"></div> -->
      </div>
      <!-- <div v-if="!isCompact" class="sidebar-resizer" @mousedown.prevent="startResize"></div> -->
      
      <div class="right-side">
        <div class="top-bar" v-if="!isCompact">
          <template v-if="!showMoreActions">
            <div class="week-label">
              <div class="curr-btn clickable" @click="goToCurrentWeek"></div>
              <div class="btn-nav clickable" @click="prevWeek">◀</div>
              {{ currentWeekLabel }}
              <div class="btn-nav clickable" @click="nextWeek">▶</div>
            </div>
            <div class="actions">
              <!-- <button class="btn" @click="validateCalendar">日历校验</button>
              <button class="btn" :disabled="highlightedCells.size===0" @click="clearInvalidCells">清理违规</button>
              <button class="btn" :disabled="!lastCleared.length" @click="undoClear">撤销清理</button> -->
              <button class="btn add clickable" :class="{active: fillMode}" @click="toggleFillMode">+</button>
              <button class="btn delete clickable" :class="{active: deleteMode}" @click="toggleDeleteMode">-</button>
              <button class="btn more clickable" @click="showMoreActions = true">…</button>
            </div>
          </template>
          <template v-else>
            <div class="week-label">
              <div class="btn action-btn clickable" :class="{active: showConstraintsEditor}" @click="toggleConstraintsEditor">日程限制</div>
              <div class="btn action-btn clickable" @click="openGenerateWindow">生成日程</div>
              <div class="btn action-btn clickable" :class="{active: showSpider}" @click="toggleSpiderWindow">作业爬虫</div>
              <div class="btn action-btn clickable" :class="{active: showThemeSettings}" @click="toggleThemeSettings">主题设置</div>
            </div>
            <div class="actions">
              <button class="btn back clickable" @click="closeMoreActions">↩</button>
            </div>
          </template>
        </div>
        <CalendarGrid v-show="!showConstraintsEditor && !showSpider && !showThemeSettings" :class="['calendar-area', { compact: isCompact }]"
          :compact="isCompact"
          :fillMode="fillMode"
          :selectedTask="selectedTask"
          :deleteMode="deleteMode"
          :calendarCells="calendarCells"
          :highlightedCells="highlightedCells"
          @fill-slot="onFillSlot"
          @clear-slot="onClearSlot"
          @edit-slot="onEditSlot"
          @fill-range="onFillRange"
          @clear-range="onClearRange"
        />
        <ConstraintsEditor v-if="showConstraintsEditor && !isCompact" class="calendar-area" @close="showConstraintsEditor = false" />
        <AssignmentCrawler v-if="showSpider && !isCompact" class="calendar-area placeholder-area" />
        <ThemeSettings v-if="showThemeSettings && !isCompact" class="calendar-area" @close="showThemeSettings = false" />
        <CellEditor v-if="showCellEditor && !isCompact" :cell="cellToEdit" @save="onSaveCellEdit" @delete="onDeleteCell" @close="() => { showCellEditor = false; cellToEdit = null }" />
        <GenerateScheduleView v-if="showGenerate && !isCompact" :weekStart="formatISO(monday)" @close="showGenerate = false" />
      </div>
    </div>
  </div>
</template>

<script>
import TaskList from '../components/TaskList.vue'
import CalendarGrid from '../components/CalendarGrid.vue'
import CellEditor from '../components/CellEditor.vue'
import ConstraintsEditor from '../components/ConstraintsEditor.vue'
import AssignmentCrawler from '../components/AssignmentCrawler.vue'
import GenerateScheduleView from './GenerateScheduleView.vue'
import ThemeSettings from '../components/ThemeSettings.vue'
import { useTaskStore } from '../stores/task.js'
import { useCalendarStore } from '../stores/calendar.js'
import { useConstraintsStore } from '../stores/constraints.js'
import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { onUnmounted } from 'vue'

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  if (day !== 1) d.setDate(d.getDate() - day + 1)
  d.setHours(0,0,0,0)
  return d
}
function parseISOToLocalDate(iso) {
  try {
    const [y,m,day] = iso.split('-').map(Number)
    return new Date(y, m-1, day)
  } catch { return new Date(iso) }
}
function formatDate(d) {
  // 我希望修改，能使得2026.4.6显示为2026.04.06，保持两位日期和月份
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`
}
function addDays(d, n) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}
function pad(n) { return n < 10 ? `0${n}` : `${n}` }
function formatISO(d) {
  // format using local date components to avoid UTC shifts
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
const timeSlots = [
  '08:00', '09:40', '10:20', '12:00',
  '14:30', '16:10', '18:00', '19:40',
  '21:20', '22:00', '23:00', '00:00'
]
function buildWeekCells(monday) {
  const cells = []
  for (let day = 1; day <= 7; day += 1) {
    for (const slot of timeSlots) {
      cells.push({ weekDay: day, slotKey: slot, eventName: '', notes: '', taskId: '' })
    }
  }
  return cells
}

export default defineComponent({
  name: 'MainCalendarView',
  components: { TaskList, CalendarGrid, CellEditor, ConstraintsEditor, GenerateScheduleView, AssignmentCrawler, ThemeSettings },
  setup() {
    const isTop = ref(false)
    const fillMode = ref(false)
    const deleteMode = ref(false)
    const selectedTaskId = ref('')
    const taskStore = useTaskStore()
    const calendarStore = useCalendarStore()
    const constraintsStore = useConstraintsStore()
    // 当前周一
    const monday = ref(getMonday(new Date()))
    // 生成当前周的 label
    const currentWeekLabel = computed(() => {
      const start = formatDate(monday.value)
      const end = formatDate(addDays(monday.value, 6))
      return `${start} ~ ${end}`
    })
    // 当前选中事件
    const selectedTask = computed(() => taskStore.tasks.find(t => t.id === selectedTaskId.value) || null)
    // 日历格子数据
    const calendarCells = computed(() => calendarStore.cells)
    const showCellEditor = ref(false)
    const cellToEdit = ref(null)
    const showConstraintsEditor = ref(false)
    const showGenerate = ref(false)
    const showMoreActions = ref(false)
    const showSpider = ref(false)
    const showThemeSettings = ref(false)
    const isCompact = ref(false)
    // sidebar resizer state (px)
    const sidebarWidth = ref(Number(localStorage.getItem('sidebarWidth')) || 280)
    const _isResizing = { active: false }
    let _startX = 0
    let _startWidth = 0
    const SIDEBAR_MIN = 170
    const SIDEBAR_MAX = Math.floor(window.innerWidth * 0.5)
    const COMPACT_WIDTH = 563
    const COMPACT_HEIGHT = 570
    const highlightedCells = ref(new Set())
    const validationMessage = ref('')
    const lastCleared = ref([])
    let _clearHighlightListener = null
    let _resizeListener = null

    function initWeek(dateObj) {
      const mondayDate = getMonday(dateObj)
      monday.value = mondayDate
      const iso = formatISO(mondayDate)
      // 优先从本地加载已保存的一周数据
      const loaded = calendarStore.loadWeek(iso)
      if (!loaded) calendarStore.setWeek(iso, buildWeekCells(mondayDate))
      logCurrentEvents()
      logCurrentConstraints()
    }

    function validateCalendar() {
      try {
        console.log('validateCalendar called')
        // toggle behavior: if already highlighted, clear highlights
        if (highlightedCells.value && highlightedCells.value.size > 0) {
          console.log('validateCalendar: clearing existing highlights')
          highlightedCells.value = new Set()
          validationMessage.value = ''
          // remove any leftover document listener
          if (_clearHighlightListener) {
            document.removeEventListener('click', _clearHighlightListener)
            _clearHighlightListener = null
          }
          return
        }
        const bad = new Set()
        for (const c of calendarStore.cells) {
          if (c.eventName && c.eventName.length && constraintsStore.isRestricted(c.weekDay, c.slotKey)) {
            bad.add(`${c.weekDay}|${c.slotKey}`)
          }
        }
        highlightedCells.value = bad
        if (bad.size === 0) {
          validationMessage.value = '校验通过：未发现受限制的日程'
          // auto clear after short delay
          setTimeout(() => { validationMessage.value = '' }, 3000)
          return
        }
        validationMessage.value = `发现 ${bad.size} 个受限制的条目，再次点击“日历校验”可取消高亮`
        console.log('validateCalendar: found invalid cells', [...bad])
      } catch (e) { console.error('validateCalendar failed', e) }
    }

    function clearInvalidCells() {
      try {
        if (!highlightedCells.value || highlightedCells.value.size === 0) return
        const keys = [...highlightedCells.value]
        const clearedSnapshots = []
        let cleared = 0
        for (const k of keys) {
          const [wdStr, slot] = k.split('|')
          const wd = Number(wdStr)
          const existing = calendarStore.cells.find(x => x.weekDay === wd && x.slotKey === slot)
          if (existing) {
            // save snapshot for undo
            clearedSnapshots.push({ weekDay: wd, slotKey: slot, eventName: existing.eventName || '', notes: existing.notes || '', taskId: existing.taskId || '', completed: Boolean(existing.completed) })
            // clear the cell
            calendarStore.updateCell(wd, slot, { eventName: '', notes: '', taskId: '', completed: false })
            cleared += 1
          }
        }
        lastCleared.value = clearedSnapshots
        highlightedCells.value = new Set()
        validationMessage.value = `已清理 ${cleared} 个违规条目` + (cleared > 0 && lastCleared.value.length ? '（可撤销）' : '')
        console.log('clearInvalidCells:', cleared, 'snapshots:', clearedSnapshots)
        setTimeout(() => { validationMessage.value = '' }, 3000)
        logCurrentEvents()
      } catch (e) { console.error('clearInvalidCells failed', e) }
    }

    function undoClear() {
      try {
        if (!lastCleared.value || lastCleared.value.length === 0) return
        const restored = []
        for (const s of lastCleared.value) {
          calendarStore.updateCell(s.weekDay, s.slotKey, { eventName: s.eventName || '', notes: s.notes || '', taskId: s.taskId || '', completed: Boolean(s.completed) })
          restored.push(`${s.weekDay}|${s.slotKey}`)
        }
        console.log('undoClear restored:', restored)
        validationMessage.value = `已撤销 ${restored.length} 个清理操作`
        lastCleared.value = []
        setTimeout(() => { validationMessage.value = '' }, 3000)
        logCurrentEvents()
      } catch (e) { console.error('undoClear failed', e) }
    }

    function openGenerateWindow() {
      console.log('openGenerateWindow called')
      if (window.electronAPI && window.electronAPI.openGenerateWindow) {
        try {
          window.electronAPI.openGenerateWindow().then(res => console.log('openGenerateWindow result', res)).catch(e => console.error('openGenerateWindow error', e))
        } catch (e) {
          console.error('openGenerateWindow invoke failed', e)
        }
      } else {
        // fallback: show modal and log
        console.warn('electronAPI.openGenerateWindow not available; showing modal fallback')
        showGenerate.value = true
      }
    }

    function openSpiderWindow() {
      console.log('openSpiderWindow called')
      // TODO: 实现作业爬虫逻辑
    }

    function toggleConstraintsEditor() {
      showConstraintsEditor.value = !showConstraintsEditor.value
      if (showConstraintsEditor.value) {
        showSpider.value = false
        showThemeSettings.value = false
      }
    }

    function toggleSpiderWindow() {
      showSpider.value = !showSpider.value
      if (showSpider.value) {
        showConstraintsEditor.value = false
        showThemeSettings.value = false
        openSpiderWindow()
      }
    }

    function toggleThemeSettings() {
      showThemeSettings.value = !showThemeSettings.value
      if (showThemeSettings.value) {
        showConstraintsEditor.value = false
        showSpider.value = false
      }
    }

    function closeMoreActions() {
      showMoreActions.value = false
      showConstraintsEditor.value = false
      showSpider.value = false
      showThemeSettings.value = false
    }

    function toggleTop() {
      if (window.electronAPI) {
        window.electronAPI.toggleAlwaysOnTop().then(flag => {
          isTop.value = flag
        })
      }
    }
    function toggleFillMode() {
      fillMode.value = !fillMode.value
      if (fillMode.value) deleteMode.value = false
      if (!fillMode.value) selectedTaskId.value = ''
    }
    function toggleDeleteMode() {
      deleteMode.value = !deleteMode.value
      if (deleteMode.value) {
        fillMode.value = false
        selectedTaskId.value = ''
      }
    }
    function onSelectTask(id) {
      if (fillMode.value) selectedTaskId.value = id
    }
    function goToCurrentWeek() {
      initWeek(new Date())
    }
    function onFillSlot({ weekDay, slotKey }) {
      if (!fillMode.value || !selectedTask.value) return
      const isRestricted = constraintsStore.isRestricted(weekDay, slotKey)
      console.log(`onFillSlot: weekDay=${weekDay}, slotKey=${slotKey}, isRestricted=${isRestricted}`)
      if (isRestricted) return
      calendarStore.updateCell(weekDay, slotKey, {
        eventName: selectedTask.value.name,
        notes: selectedTask.value.notes,
        taskId: selectedTask.value.id
      })
    }
    function prevWeek() {
      const newMonday = addDays(monday.value, -7)
      initWeek(newMonday)
    }
    function nextWeek() {
      const newMonday = addDays(monday.value, 7)
      initWeek(newMonday)
    }
    onMounted(() => {
      // 首次进入初始化当周空白格子
      taskStore.loadTasks()
      // ensure tasks are sorted by deadline on startup
      try { taskStore.sortTasks() } catch (e) { console.error('sortTasks on startup failed', e) }
      constraintsStore.loadConstraints()
      initWeek(new Date())
      logCurrentEvents()
      // setup compact mode detection
      checkCompact()
      _resizeListener = () => checkCompact()
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('resize', _resizeListener)
      }
      // listen for calendar updates from other windows
      try {
        if (window && window.electronAPI && window.electronAPI.onCalendarUpdated) {
          window.electronAPI.onCalendarUpdated((payload) => {
            console.log('MainCalendarView received calendar:updated', payload)
            try {
              const normalizeWeekStart = (isoOrDate) => {
                try {
                  // accept either Date or ISO string; parse ISO as local date (avoid Date("YYYY-MM-DD") UTC parsing)
                  let d
                  if (isoOrDate instanceof Date) d = new Date(isoOrDate)
                  else if (typeof isoOrDate === 'string' && isoOrDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [y,m,day] = isoOrDate.split('-').map(Number)
                    d = new Date(y, m-1, day)
                  } else d = new Date(isoOrDate)
                  const monday = getMonday(d)
                  return formatISO(monday)
                } catch { return formatISO(getMonday(new Date())) }
              }
              if (payload && payload.weekStart && payload.weekCells) {
                const mondayIso = normalizeWeekStart(payload.weekStart)
                console.log('MainCalendarView: setting week from payload.weekCells (normalized)', mondayIso)
                calendarStore.setWeek(mondayIso, payload.weekCells)
                monday.value = getMonday(parseISOToLocalDate(mondayIso))
                logCurrentEvents()
              } else if (payload && payload.weekStart && payload.changedCells) {
                console.log('MainCalendarView: merging changedCells into current week', payload.changedCells.length)
                const iso = normalizeWeekStart(payload.weekStart)
                const loaded = calendarStore.loadWeek(iso)
                if (!loaded) {
                  // initialize empty week then apply changes
                  const cells = []
                  for (let day = 1; day <= 7; day += 1) {
                    for (const slot of timeSlots) {
                      cells.push({ weekDay: day, slotKey: slot, eventName: '', notes: '', taskId: '' })
                    }
                  }
                  calendarStore.setWeek(iso, cells)
                }
                const force = Boolean(payload.forceOverwrite)
                for (const c of payload.changedCells) {
                  const existing = calendarStore.cells.find(x => x.weekDay === c.weekDay && x.slotKey === c.slotKey)
                  if (existing && existing.eventName && existing.eventName.length && !force) {
                    console.log('Skip overwrite (cell not empty):', `${c.weekDay}|${c.slotKey}=${existing.eventName}`)
                    continue
                  }
                  if (existing) {
                    if (force && existing.eventName && existing.eventName.length) {
                      console.log('Overwriting existing cell (force):', `${c.weekDay}|${c.slotKey} -> ${c.eventName}`)
                    } else {
                      console.log('Writing cell:', `${c.weekDay}|${c.slotKey} -> ${c.eventName}`)
                    }
                    calendarStore.updateCell(c.weekDay, c.slotKey, { eventName: c.eventName || '', notes: c.notes || '', taskId: c.taskId || '' })
                  } else {
                    console.log('No existing cell found, skipping or initializing as needed:', `${c.weekDay}|${c.slotKey}`)
                  }
                }
                monday.value = getMonday(parseISOToLocalDate(iso))
                console.log('MainCalendarView: merged changedCells, set monday to', formatISO(monday.value), monday.value)
                logCurrentEvents()
              } else if (payload && payload.weekStart) {
                // no cells provided, fallback to loading from localStorage
                const mondayIso = normalizeWeekStart(payload.weekStart)
                initWeek(parseISOToLocalDate(mondayIso))
                logCurrentEvents()
              } else {
                initWeek(new Date())
                logCurrentEvents()
              }
            } catch (e) {
              console.error('onCalendarUpdated handler error', e)
            }
          })
        }
      } catch (e) { console.error('onCalendarUpdated registration failed', e) }
    })
    function onClearSlot({ weekDay, slotKey }) {
      if (!fillMode.value && !deleteMode.value) return
      calendarStore.updateCell(weekDay, slotKey, { eventName: '', notes: '', taskId: '', completed: false })
    }
    function onEditSlot({ weekDay, slotKey, cell }) {
      cellToEdit.value = cell || { weekDay, slotKey, eventName: '', notes: '', taskId: '' }
      showCellEditor.value = true
    }
    function onFillRange({ cells }) {
      if (!fillMode.value || !selectedTask.value) return
      const validCells = cells.filter(c => !constraintsStore.isRestricted(c.weekDay, c.slotKey))
      for (const c of validCells) {
        calendarStore.updateCell(c.weekDay, c.slotKey, {
          eventName: selectedTask.value.name,
          notes: selectedTask.value.notes,
          taskId: selectedTask.value.id
        })
      }
    }
    function onClearRange({ cells }) {
      if (!deleteMode.value) return
      for (const c of cells) {
        calendarStore.updateCell(c.weekDay, c.slotKey, { eventName: '', notes: '', taskId: '', completed: false })
      }
    }
    function onSaveCellEdit({ weekDay, slotKey, patch }) {
      calendarStore.updateCell(weekDay, slotKey, patch)
      showCellEditor.value = false
      cellToEdit.value = null
    }
    function onDeleteCell({ weekDay, slotKey }) {
      calendarStore.clearCell(weekDay, slotKey)
      showCellEditor.value = false
      cellToEdit.value = null
      logCurrentEvents()
    }
    function logCurrentEvents() {
      try {
        const populated = calendarStore.cells.filter(c => c.eventName && c.eventName.length).map(c => `${c.weekDay}|${c.slotKey}=${c.eventName}`)
        console.log('MainCalendarView current populated cells:', populated)
      } catch (e) { console.error('logCurrentEvents error', e) }
    }
    function logCurrentConstraints() {
      try {
        console.log('MainCalendarView current constraints:')
        console.log('Classes:', constraintsStore.classes)
        console.log('Preferences:', constraintsStore.preferences)
        const restrictedSlots = []
        for (let weekDay = 1; weekDay <= 7; weekDay++) {
          for (const slot of timeSlots) {
            if (constraintsStore.isRestricted(weekDay, slot)) {
              restrictedSlots.push(`${weekDay}|${slot}`)
            }
          }
        }
        console.log('All restricted slots:', restrictedSlots)
      } catch (e) { console.error('logCurrentConstraints error', e) }
    }
    function checkCompact() {
      try {
        if (typeof window === 'undefined') return
        isCompact.value = window.innerWidth < COMPACT_WIDTH 
      } catch (e) { console.error('checkCompact error', e) }
    }
    // expose highlighted cells to calendar grid
    onBeforeUnmount(() => {
      try {
        if (_resizeListener && typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('resize', _resizeListener)
        }
        // cleanup any remaining mouse listeners
        window.removeEventListener('mousemove', _onMouseMove)
        window.removeEventListener('mouseup', _stopResize)
      } catch (e) { console.error('onBeforeUnmount cleanup failed', e) }
    })

    function _onMouseMove(e) {
      if (!_isResizing.active) return
      const dx = e.clientX - _startX
      let newW = Math.round(_startWidth + dx)
      if (newW < SIDEBAR_MIN) newW = SIDEBAR_MIN
      if (newW > SIDEBAR_MAX) newW = SIDEBAR_MAX
      sidebarWidth.value = newW
    }

    function _stopResize() {
      if (!_isResizing.active) return
      _isResizing.active = false
      try { document.body.style.cursor = '' } catch (e) {}
      window.removeEventListener('mousemove', _onMouseMove)
      window.removeEventListener('mouseup', _stopResize)
      try { localStorage.setItem('sidebarWidth', String(sidebarWidth.value)) } catch (e) {}
    }

    function startResize(e) {
      _isResizing.active = true
      _startX = e.clientX
      _startWidth = sidebarWidth.value
      document.body.style.cursor = 'col-resize'
      window.addEventListener('mousemove', _onMouseMove)
      window.addEventListener('mouseup', _stopResize)
    }
    return {
      sidebarWidth,
      startResize,
      isTop,
      fillMode,
      deleteMode,
      selectedTaskId,
      selectedTask,
      currentWeekLabel,
      calendarCells,
      highlightedCells,
      validationMessage,
      lastCleared,
      validateCalendar,
      clearInvalidCells,
      undoClear,
      toggleTop,
      toggleFillMode,
      toggleDeleteMode,
      onSelectTask,
      goToCurrentWeek,
      onFillSlot,
      onClearSlot,
      onEditSlot,
      onSaveCellEdit,
      onDeleteCell,
      onFillRange,
      onClearRange,
      showCellEditor,
      cellToEdit,
      showConstraintsEditor,
      showGenerate,
      showMoreActions,
      showSpider,
      showThemeSettings,
      isCompact,
      openGenerateWindow,
      openSpiderWindow,
      toggleConstraintsEditor,
      toggleSpiderWindow,
      toggleThemeSettings,
      closeMoreActions,
      prevWeek,
      nextWeek
    }
  },
  mounted() {
    if (window.electronAPI) {
      window.electronAPI.toggleAlwaysOnTop().then(() => {
        window.electronAPI.toggleAlwaysOnTop().then(flag => {
          this.isTop = flag
        })
      })
    }
  }
})
</script>

<style scoped>


.main-calendar-view{
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.main-content{
  padding:5%;
  display: flex;
  /* min-height: 50%; */
  align-items: center;
  justify-content: space-between;
  /* 该部件上下居中 */
  height:100%;
  /* flex: 1; */
  margin-top:36px;
  overflow: auto;
  /* height:100%; */
}

.left-side{
  height: 100%;
  width:30%;
  border: 2px solid var(--theme-color-light);
  border-radius: 12px;
  overflow: hidden;
}

.right-side{
  width:60%;
  height:100%;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--theme-color-light);
  border-radius: 12px;
  overflow: hidden;
}
.top-bar{
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 4px 8px 10px;
  /* background: var(--panel, #1E2327);
  border-bottom: 1px solid #232a36; */
  height:36px;
  background-color: var(--theme-color-dark);
  border-bottom: 2px solid var(--theme-color-light);
  /* min-height: 30px;
  max-height: 40px; */
}
.week-label{
  display: flex;
  align-items: center;
  font-size: 1.5em;
}
.curr-btn{
  /* 圆形 */
  height: 16px;
  width:16px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--theme-color-dark);
  border: 2px solid var(--theme-color-light);
  margin-right: 8px;
  /* cursor: pointer; */
}
.curr-btn:hover{
  background: var(--theme-color-light);
}

.btn-nav {
  background:none;
  color: hsl(from var(--theme-color-light) h s calc(l * 0.8));
  /* border: 1px solid #232a36; */
  /* border-radius: 6px; */
  padding: 0 4px;
  font-size: 16px;
  /* cursor: pointer; */
}
.btn-nav:hover {
  color: var(--theme-color-light);
}
.actions{
  display: flex;
  align-items: center;
}

.add{
  background-color: var(--accent, #3CFFEF);
  border:2px solid var(--accent, #3CFFEF);
}
.add:hover{
  background-color: hsl(from var(--accent, #3CFFEF) h s calc(l * 1.4));
  border:2px solid hsl(from var(--accent, #3CFFEF) h s calc(l * 1.4));
}
.add.active{
  background-color: var(--accent-dark, #1e2b35);
  color: var(--accent, #3CFFEF);
  border: 2px solid var(--accent, #3CFFEF);
}
.delete{
  background-color: var(--warning, #FF3C7C);
  border:2px solid var(--warning, #FF3C7C);
}
.delete:hover{
  background-color: hsl(from var(--warning, #FF3C7C) h s calc(l * 1.2));
  border:2px solid hsl(from var(--warning, #FF3C7C) h s calc(l * 1.2));
}
.delete.active{
  background: var(--warning-dark);
  color: var(--warning,#ff6b6b);
  border: 2px solid var(--warning,#ff6b6b);
}
.more {
  background-color: var(--theme-color-light);
  border: 2px solid var(--theme-color-light);
}
.more:hover {
  background-color: hsl(from var(--theme-color-light) h s calc(l * 1.2));
  border: hsl(from var(--theme-color-light) h s calc(l * 1.2));
}

.back {
  background-color: var(--theme-color-light);
  border: 2px solid var(--theme-color-light);
}
.back:hover {
  background-color: hsl(from var(--theme-color-light) h s calc(l * 1.2));
  border: hsl(from var(--theme-color-light) h s calc(l * 1.2));
}

.action-btn {
  /* background-color: var(--panel, #1E2327); */
  /* border: 2px solid var(--theme-color-light); */
  color: var(--text);
  
  /* margin-right: 8px; */
  width:auto;
  font-size: 0.8em;
  padding: 1px 6px;
  transition: all 0.2s ease;
  position:relative;
  /* border-top: 2px solid transparent;
  border-bottom: 2px solid transparent; */
}
/* .action-btn:hover {
  border-bottom: 2px solid var(--theme-color-light);
} */

.action-btn::after {
  content: '';
  position:absolute;
  bottom:2px;
  left:4px;
  width: 0;
  height: 2px;
  background-color: var(--theme-color-light);
  transition: width 0.2s ease;
}

.action-btn:hover::after {
  width:calc(100% - 8px);
}

.action-btn.active {
  background-color: var(--theme-color-light);
  border-radius: 6px;
}

/* .calendar-block{
  flex: 1;
  width:100%;
  background: #1077fd;
} */
/* .task{
  height:100%; 
  width:260px;
  background: var(--panel, #7285b6);
} */

/* .main-calendar-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg, #0f1216);
}
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 18px 8px 18px;
  background: var(--panel, #1E2327);
  border-bottom: 1px solid #232a36;
}
.week-label {
  font-size: 1.1em;
  color: var(--text, #e6e8eb);
  display: flex;
  align-items: center;
  gap: 8px;
}
.week-input { display:none }
.btn-nav {
  background: var(--panel, #1E2327);
  color: var(--accent, #5f9bff);
  border: 1px solid #232a36;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 16px;
  cursor: pointer;
}
.actions .btn {
  background: var(--panel, #1E2327);
  color: var(--text, #e6e8eb);
  border: 1px solid #232a36;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-left: 8px;
}
.actions .btn.active {
  background: var(--accent, #5f9bff);
  color: #fff;
}
.main-content {
  display: flex;
  min-height: 0;
  align-items: center;
   justify-content: center;
  
}
.sidebar {
  min-width: 160px;
  border-right: 1px solid #232a36;
  background: var(--panel, #1E2327);
}
.left-side {
  flex: none;
  height: 50%;
  width:260px;
}
.sidebar-resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  -webkit-user-select: none;
  user-select: none;
  margin-left: -6px;
}
.sidebar-resizer:hover {
  background: rgba(255,255,255,0.02);
}
.right-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height:50%;
  width:260px;
}
.calendar-area {
  flex: 1;
  padding: 0;
  background: var(--bg, #0f1216);
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.calendar-area.compact {
  flex: 1;
  width: 100%;
  padding: 0;
  min-height: 0;
} */
</style>
