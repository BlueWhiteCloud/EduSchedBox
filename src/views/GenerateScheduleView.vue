<template>
  <div class="generate-overlay">
    <div class="panel">
      <div class="panel-header">
        <h3>浏览日历（AI 建议）</h3>
        <div class="target-week">目标周：{{ targetWeekLabel }}</div>
        <div class="force-overwrite">
          <label><input type="checkbox" v-model="forceOverwrite" /> 覆盖已存在日程</label>
        </div>
        <div class="send-options">
          <label><input type="checkbox" v-model="sendOnlyUnfinished" /> 仅发送未完成任务</label>
        </div>
        <div class="actions">
          <button class="btn" @click="generateBasic" :disabled="loading">生成基础版</button>
          <button class="btn" @click="generate" :disabled="loading">AI改进版</button>
          <button v-if="generated && generated.__meta && generated.__meta.provisional" class="btn" @click="waitForDeepSeek" :disabled="waitingForDeepseek">{{ waitingForDeepseek ? '等待中...' : '等待完整结果' }}</button>
          <button class="btn" @click="acceptAll" :disabled="!generated">接受整周</button>
          <button class="btn" @click="fillSelected" :disabled="selectedCells.size===0">选择填入</button>
          <button class="btn" @click="commitPreview" :disabled="previewMode==='none'">完成</button>
          <button class="btn btn-close" @click="closeWindow">关闭</button>
        </div>
      </div>
      <div v-if="statusMessage" class="status-bar">{{ statusMessage }}</div>
      <div class="panel-body">
        <div class="left">
          <div class="gen-grid">
            <div class="grid-head">
              <div class="slot-header">时间段</div>
              <div v-for="(d, i) in weekDays" :key="i" class="day-cell">{{ d }}</div>
            </div>
            <div class="grid-body">
              <div v-for="(slot, rowIdx) in timeSlots" :key="slot" class="grid-row">
                <div class="slot-label">{{ slot }}</div>
                <div v-for="col in 7" :key="col" class="grid-cell"
                  :class="cellClass(col, slot)"
                  @click="toggleSelect(col, slot)">
                  <div class="cell-inner" v-if="cellMap[col] && cellMap[col][slot]">{{ cellMap[col][slot].taskName || cellMap[col][slot].activity }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="json-area">
            <h4>JSON 输出</h4>
            <pre v-if="generated">{{ JSON.stringify(generated, null, 2) }}</pre>
            <div v-else class="muted">尚未生成</div>            <div v-if="generated">
              <h4>校对结果</h4>
              <div v-if="generated.taskSummary && generated.taskSummary.length">
                <ul>
                  <li v-for="s in generated.taskSummary" :key="s.taskId">{{ s.taskName }} — 已安排 {{ s.scheduledHours }}h / 预计 {{ s.estimatedHours }}h — 截止{{ s.beforeDeadline === null ? '未知' : (s.beforeDeadline ? '可达成' : '可能达不到') }}</li>
                </ul>
              </div>
              <div v-if="generated.conflicts && generated.conflicts.length">
                <h5>冲突</h5>
                <ul>
                  <li v-for="(c, idx) in generated.conflicts" :key="idx">{{ c.message }}</li>
                </ul>
              </div>
            </div>          </div>
        </div>
        <div class="right">
          <h4>当前正式日历预览</h4>
          <div class="preview">
            <!-- reuse CalendarGrid for preview (read-only) -->
            <CalendarGrid :calendarCells="previewCells" :fillMode="false" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import CalendarGrid from '../components/CalendarGrid.vue'
import { useTaskStore } from '../stores/task.js'
import { useCalendarStore } from '../stores/calendar.js'
import { useConstraintsStore } from '../stores/constraints.js'
import { useGenerateStore } from '../stores/generate.js'
import { buildGeneratePayload, validateGeneratedResult } from '../utils/generateHelpers.js'
function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  if (day !== 1) d.setDate(d.getDate() - day + 1)
  d.setHours(0,0,0,0)
  return d
}
function addDays(d, n) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}
function formatDate(d) {
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`
}
function pad(n) { return n < 10 ? `0${n}` : `${n}` }
function formatISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function normalizeWeekStart(isoOrDate) {
  try {
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
const timeSlots = [
  '08:00', '09:40', '10:20', '12:00',
  '14:30', '16:10', '18:00', '19:40',
  '21:20', '22:00', '23:00', '00:00'
]

export default {
  name: 'GenerateScheduleView',
  components: { CalendarGrid },
  props: {
    weekStart: String
  },
  setup(props, { emit }) {
    const taskStore = useTaskStore()
    const calendarStore = useCalendarStore()
    const constraintsStore = useConstraintsStore()

    const generateStore = useGenerateStore()
    const loading = computed(() => generateStore.loading)
    const generated = computed(() => generateStore.lastResult)
    const selectedCells = ref(new Set())

    // simple map for display: cellMap[weekDay][slot] = { activity, taskName }
    const cellMap = computed(() => {
      const map = {}
      if (!generated.value) return map
      for (const day of generated.value.days) {
        const wd = day.weekday
        map[wd] = map[wd] || {}
        for (const s of day.slots) {
          map[wd][s.time] = s
        }
      }
      return map
    })
    // which week the generate() request will target (默认使用设备当前周)
    // 默认以设备当前周为首选，不再优先使用传入的 props.weekStart
    const requestWeekIso = ref(normalizeWeekStart(new Date()))
    // whether to only send unfinished tasks (UI toggle)
    const sendOnlyUnfinished = ref(true)
    const SETTINGS_KEY = 'generate.sendOnlyUnfinished'

    const targetWeekLabel = computed(() => {
      const raw = requestWeekIso.value || props.weekStart || generated.value?.weekStart || formatISO(getMonday(new Date()))
      const mondayIso = normalizeWeekStart(raw)
      const mondayDate = getMonday(new Date(mondayIso))
      return `${formatDate(mondayDate)} ~ ${formatDate(addDays(mondayDate, 6))}`
    })

    async function generate() {
      try {
        // 默认以设备当前周（周一对齐）作为生成起点
        const mondayIso = normalizeWeekStart(new Date())
        requestWeekIso.value = mondayIso
        // build payload with full context
        // collect locked slots from calendar store (cells with locked===true)
        const locked = []
        for (const c of calendarStore.cells) {
          if (c.locked) locked.push({ weekDay: c.weekDay, slotKey: c.slotKey, eventName: c.eventName || '' })
        }
        // refresh task progress cache so we can decide which tasks are unfinished
        try { taskStore.refreshProgressForAll() } catch (e) { console.warn('generateBasic: refreshProgressForAll failed', e) }
        let tasksToSend = taskStore.tasks
        if (sendOnlyUnfinished.value) {
          tasksToSend = taskStore.tasks.filter(t => {
            try {
              if (t.status === 'completed') return false
              if (t.progress && typeof t.progress.numerator === 'number' && typeof t.progress.denominator === 'number' && t.progress.denominator > 0) {
                const pct = Math.round((t.progress.numerator / t.progress.denominator) * 100)
                return pct < 100
              }
              return true
            } catch (e) { return true }
          })
        }
        const payload = buildGeneratePayload({
          weekStart: mondayIso,
          currentDate: formatISO(new Date()),
          tasks: tasksToSend,
          constraints: { classes: constraintsStore.classes, preferences: constraintsStore.preferences },
          sendOnlyUnfinished: sendOnlyUnfinished.value,
          lockedSlots: locked
        })
        statusMessage.value = `正在为 ${formatDate(getMonday(new Date(mondayIso)))} ~ ${formatDate(addDays(getMonday(new Date(mondayIso)),6))} 生成…`
        console.log('GenerateScheduleView: requesting generate with payload', payload)
        if (!payload.tasks || payload.tasks.length === 0) {
          statusMessage.value = '注意：当前未检测到可用任务，生成结果可能为空或仅为示例。请在主页面添加任务后重试。'
        }
        lastPayload.value = payload
        await generateStore.requestGenerate(payload)
        const result = generateStore.lastResult
        // validate structure
        const valid = validateGeneratedResult(result)
        if (!valid) {
          statusMessage.value = '生成结果格式不符合预期，已取消预览，请查看控制台日志'
          console.error('Invalid generate result:', result)
          generateStore.lastResult = null
          return
        }
        // if backend reported an error (e.g., billing), show it to the user
        const backendError = result && result.__meta && result.__meta.error
        if (backendError) {
          statusMessage.value = `后端生成失败：${backendError}；已回退到本地模拟结果`
        }
        console.log('GenerateScheduleView: received result sample:', JSON.stringify(generateStore.lastResult).slice(0,800))
        const report = generateStore.analyzeSchedule(generateStore.lastResult)
        // attach analysis results
        generateStore.lastResult = { ...generateStore.lastResult, taskSummary: report.taskSummary, conflicts: report.conflicts }
        const meta = generateStore.lastResult.__meta || {}
        const src = meta.source
        if (meta.provisional) {
          statusMessage.value = `临时结果（正在等待 DeepSeek 最终结果）`
        } else if (src === 'deepseek') statusMessage.value = `生成完成（来自 DeepSeek）：目标周 ${formatDate(getMonday(new Date(requestWeekIso.value)))} ~ ${formatDate(addDays(getMonday(new Date(requestWeekIso.value)),6))}`
        else if (src === 'python') statusMessage.value = `生成完成（来自 Python 后端）：目标周 ${formatDate(getMonday(new Date(requestWeekIso.value)))} ~ ${formatDate(addDays(getMonday(new Date(requestWeekIso.value)),6))}`
        else statusMessage.value = `生成完成（本地模拟）：目标周 ${formatDate(getMonday(new Date(requestWeekIso.value)))} ~ ${formatDate(addDays(getMonday(new Date(requestWeekIso.value)),6))}`
      } catch (e) {
        console.error('generate request failed', e)
        statusMessage.value = '生成失败，请查看控制台'
      }
    }

    async function generateBasic() {
      console.log('generateBasic: function called')
      try {
        // 默认以设备当前周（周一对齐）作为生成起点
        const mondayIso = normalizeWeekStart(new Date())
        requestWeekIso.value = mondayIso
        console.log('generateBasic: mondayIso =', mondayIso)
        // build payload with full context
        // collect locked slots from calendar store (cells with locked===true)
        const locked = []
        for (const c of calendarStore.cells) {
          if (c.locked) locked.push({ weekDay: c.weekDay, slotKey: c.slotKey, eventName: c.eventName || '' })
        }
        const payload = buildGeneratePayload({
          weekStart: mondayIso,
          currentDate: formatISO(new Date()),
          tasks: taskStore.tasks,
          constraints: { classes: constraintsStore.classes, preferences: constraintsStore.preferences },
          sendOnlyUnfinished: sendOnlyUnfinished.value,
          lockedSlots: locked
        })
        console.log('generateBasic: payload built', payload)
        statusMessage.value = `正在为 ${formatDate(getMonday(new Date(mondayIso)))} ~ ${formatDate(addDays(getMonday(new Date(mondayIso)),6))} 生成基础版…`
        console.log('GenerateScheduleView: requesting generate/basic with payload', payload)
        if (!payload.tasks || payload.tasks.length === 0) {
          statusMessage.value = '注意：当前未检测到可用任务，生成结果可能为空。请在主页面添加任务后重试。'
        }
        lastPayload.value = payload
        console.log('generateBasic: calling generateStore.requestGenerateBasic')
        await generateStore.requestGenerateBasic(payload)
        console.log('generateBasic: requestGenerateBasic completed')
        const result = generateStore.lastResult
        console.log('generateBasic: result =', result)
        // validate structure
        const valid = validateGeneratedResult(result)
        if (!valid) {
          statusMessage.value = '生成结果格式不符合预期，已取消预览，请查看控制台日志'
          console.error('Invalid generate result:', result)
          generateStore.lastResult = null
          return
        }
        // if backend reported an error (e.g., billing), show it to the user
        const backendError = result && result.__meta && result.__meta.error
        if (backendError) {
          statusMessage.value = `后端生成失败：${backendError}`
        }
        console.log('GenerateScheduleView: received basic result sample:', JSON.stringify(generateStore.lastResult).slice(0,800))
        const report = generateStore.analyzeSchedule(generateStore.lastResult)
        // attach analysis results
        const updatedResult = { ...generateStore.lastResult, taskSummary: report.taskSummary, conflicts: report.conflicts }
        generateStore.lastResult = updatedResult
        console.log('generateBasic: updated lastResult with analysis', generateStore.lastResult)
        const meta = generateStore.lastResult.__meta || {}
        const src = meta.source
        statusMessage.value = `基础版生成完成：目标周 ${formatDate(getMonday(new Date(requestWeekIso.value)))} ~ ${formatDate(addDays(getMonday(new Date(requestWeekIso.value)),6))}`
        console.log('generateBasic: statusMessage updated to', statusMessage.value)
      } catch (e) {
        console.error('generate basic request failed', e)
        statusMessage.value = '基础版生成失败，请查看控制台'
      }
    }

    onMounted(() => {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (raw !== null) sendOnlyUnfinished.value = raw === '1'
      } catch (e) { console.warn('load generate setting failed', e) }
      // ensure stores have data when this view is opened (standalone window may start with empty stores)
      try {
        taskStore.loadTasks()
        constraintsStore.loadConstraints()
        // try to ensure calendar week is loaded
        const weekIso = props.weekStart || formatISO(getMonday(new Date()))
        calendarStore.loadWeek(weekIso)
      } catch (e) { console.warn('GenerateScheduleView: store preload failed', e) }
    })

    // listen for background deepseek updates from main
    try {
      if (window && window.electronAPI && window.electronAPI.onGenerateUpdated) {
        window.electronAPI.onGenerateUpdated((payload) => {
          try {
            console.log('GenerateScheduleView: received background generate update', payload)
            // replace lastResult if it matches current weekStart
            if (payload && payload.weekStart && payload.weekStart === requestWeekIso.value) {
              generateStore.lastResult = payload
              statusMessage.value = `生成完成（来自 DeepSeek，已更新）`
            }
          } catch (e) { console.error('onGenerateUpdated handler error', e) }
        })
      }
    } catch (e) {}

    // persist setting
    watch(sendOnlyUnfinished, (v) => {
      try { localStorage.setItem(SETTINGS_KEY, v ? '1' : '0') } catch (e) { console.warn('save generate setting failed', e) }
    })

    async function waitForDeepSeek() {
      try {
        if (!lastPayload.value) return
        waitingForDeepseek.value = true
        statusMessage.value = '正在等待 DeepSeek 完整结果（最长约 120s）…'
        const serializablePayload = JSON.parse(JSON.stringify(lastPayload.value))
        const res = await window.electronAPI.generateForceRefetch(serializablePayload)
        if (res && res.ok && res.json) {
          generateStore.lastResult = { ...res.json, __meta: { source: 'deepseek', updated: true } }
          statusMessage.value = '生成完成（来自 DeepSeek，已更新）'
        } else {
          statusMessage.value = '未获取到 DeepSeek 完整结果，请稍后或点击重试'
        }
      } catch (e) {
        console.error('waitForDeepSeek error', e)
        statusMessage.value = '等待时发生错误，请查看日志'
      } finally {
        waitingForDeepseek.value = false
      }
    }

    // validateGeneratedResult now provided by utils

    const forceOverwrite = ref(false)

    function toggleSelect(weekDay, slotKey) {
      const key = `${weekDay}|${slotKey}`
      // Use immutable replace to ensure reactivity for Set
      const s = new Set(selectedCells.value)
      if (s.has(key)) s.delete(key)
      else s.add(key)
      selectedCells.value = s
      console.log('toggleSelect -> selectedCells now:', [...selectedCells.value])
    }

    function cellClass(weekDay, slotKey) {
      const key = `${weekDay}|${slotKey}`
      if (selectedCells.value.has(key)) return 'selected'
      return ''
    }

    function isStandaloneWindow() {
      try {
        return window && window.location && (window.location.hash === '#/generate' || window.location.pathname.endsWith('/generate'))
      } catch (e) { return false }
    }

    const statusMessage = ref('')
    const previewMode = ref('none') // 'none' | 'selected' | 'all'
    const lastPayload = ref(null)
    const waitingForDeepseek = ref(false)
    function acceptAll() {
      console.trace('acceptAll trace')
      if (!generated.value) return
      console.log('acceptAll clicked: show full generated schedule in preview')
      previewMode.value = 'all'
      statusMessage.value = '预览已切换为全部生成日程，点击 完成 保存到主日历'
    }

    function fillSelected() {
      console.trace('fillSelected trace')
      if (!generated.value) return
      console.log('fillSelected clicked: show selected generated slots in preview', [...selectedCells.value])
      previewMode.value = 'selected'
      statusMessage.value = '预览已应用所选条目，点击 完成 保存到主日历'
    }

    function commitPreview() {
      // compute changed cells vs original snapshot and notify main window to merge
      const rawWeekStart = requestWeekIso.value || props.weekStart || generated.value?.weekStart || formatISO(getMonday(new Date()))
      const mondayIso = normalizeWeekStart(rawWeekStart)
      const preview = previewCells.value
      const origMap = new Map()
      for (const c of originalWeek.value) {
        origMap.set(`${c.weekDay}|${c.slotKey}`, { eventName: c.eventName || '', notes: c.notes || '', taskId: c.taskId || '' })
      }
      const changedCells = []
      for (const c of preview) {
        const key = `${c.weekDay}|${c.slotKey}`
        const before = origMap.get(key) || { eventName: '', notes: '', taskId: '' }
        const after = { eventName: c.eventName || '', notes: c.notes || '', taskId: c.taskId || '' }
        const changed = before.eventName !== after.eventName || before.notes !== after.notes || before.taskId !== after.taskId
        if (changed) {
          changedCells.push({ weekDay: c.weekDay, slotKey: c.slotKey, eventName: after.eventName, notes: after.notes, taskId: after.taskId })
        }
      }
      try {
        if (window && window.electronAPI && window.electronAPI.notifyCalendarUpdated) {
          const force = Boolean(forceOverwrite.value)
          // indicate whether this commit should overwrite existing entries
          window.electronAPI.notifyCalendarUpdated({ weekStart: mondayIso, changedCells, forceOverwrite: force })
          console.log('notified other windows of calendar update (with changedCells)', changedCells.length, 'weekStart', mondayIso, 'forceOverwrite', force)
        }
        const suffix = forceOverwrite.value ? '，已覆盖已存在条目' : ''
        statusMessage.value = `已保存到主日历（变更 ${changedCells.length} 项${suffix}）`
      } catch (e) {
        console.error('commitPreview failed', e)
        statusMessage.value = '保存失败，请查看控制台'
      }
    }

    async function closeWindow() {
      console.log('closeWindow clicked')
      if (isStandaloneWindow()) {
        try {
          if (window && window.electronAPI && window.electronAPI.closeWindow) {
            const res = await window.electronAPI.closeWindow()
            console.log('electronAPI.closeWindow result', res)
            return
          }
          console.log('attempting window.close() fallback')
          window.close()
          return
        } catch (e) {
          console.error('window.close failed', e)
        }
      }
      console.log('emitting close for modal')
      emit('close')
    }

    // capture snapshot of calendar when view opens so preview can overlay selections
    const originalWeek = ref(calendarStore.cells.map(c => ({ ...c })))
    const previewCells = computed(() => {
      // start from original snapshot to avoid showing live store changes
      const base = originalWeek.value.map(c => ({ ...c }))
      // ensure full grid if snapshot empty
      if (!base || base.length === 0) {
        for (let wd = 1; wd <= 7; wd++) {
          for (const t of timeSlots) base.push({ weekDay: wd, slotKey: t, eventName: '', notes: '', taskId: '' })
        }
      }
      // overlay generated entries according to previewMode (do not persist)
      if (previewMode.value === 'all') {
        if (generated.value && generated.value.days) {
          for (const d of generated.value.days) {
            for (const s of d.slots) {
              const wd = d.weekday
              const idx = base.findIndex(c => c.weekDay === wd && c.slotKey === s.time)
              if (idx !== -1) base[idx] = { ...base[idx], eventName: s.activity, notes: s.notes || '', taskId: s.taskId || '' }
              else base.push({ weekDay: wd, slotKey: s.time, eventName: s.activity, notes: s.notes || '', taskId: s.taskId || '' })
            }
          }
        }
      } else if (previewMode.value === 'selected') {
        for (const key of [...selectedCells.value]) {
          const [wdStr, slot] = key.split('|')
          const wd = Number(wdStr)
          const day = generated.value?.days?.find(d => d.weekday === wd)
          const slotObj = day?.slots.find(s => s.time === slot)
          if (slotObj) {
            const idx = base.findIndex(c => c.weekDay === wd && c.slotKey === slot)
            if (idx !== -1) base[idx] = { ...base[idx], eventName: slotObj.activity, notes: slotObj.notes || '', taskId: slotObj.taskId || '' }
            else base.push({ weekDay: wd, slotKey: slot, eventName: slotObj.activity, notes: slotObj.notes || '', taskId: slotObj.taskId || '' })
          }
        }
      }
      return base
    })

    return {
      loading,
      generated,
      selectedCells,
      cellMap,
      forceOverwrite,
      sendOnlyUnfinished,
      timeSlots,
      weekDays: ['周一','周二','周三','周四','周五','周六','周日'],
      generate,
      generateBasic,
      toggleSelect,
      cellClass,
      acceptAll,
      fillSelected,
      closeWindow,
      statusMessage,
      targetWeekLabel,
      previewCells,
      previewMode,
      commitPreview,
      lastPayload,
      waitingForDeepseek,
      waitForDeepSeek,
      generateStore
    }
  }
}
</script>

<style scoped>
.generate-overlay {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.panel {
  width: 90%;
  height: 80%;
  background: var(--panel, #1E2327);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px }
.target-week { color: var(--muted, #9aa4b2); font-size: 14px; }
.force-overwrite { margin-left: 12px; color: var(--muted, #9aa4b2); font-size: 13px }
.force-overwrite input { margin-right: 6px }
.panel-body { display:flex; flex:1; gap:12px; padding:12px }
.left { flex:1; display:flex; flex-direction:column; gap:8px }
.right { width: 520px; display:flex; flex-direction:column }
.gen-grid { background:#12151a; border-radius:6px; padding:8px; display:flex; flex-direction:column; flex:1 }
.grid-head, .grid-row { display:flex; }
.slot-header { width: 110px; font-weight:600; padding:6px; flex:0 0 110px }
.day-cell { flex:1; text-align:center; padding:6px }
.grid-row { align-items:center }
.slot-label { width:110px; padding:6px; flex:0 0 110px }
.grid-body { overflow:auto; flex:1 }
.grid-cell { flex:1; padding:6px; border-left:1px solid #232a36; min-height:36px; cursor:pointer; display:flex; align-items:center; justify-content:center }
.grid-cell .cell-inner { width:100%; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.grid-cell.selected { background:#2a3a5a; outline:2px solid #5f9bff }
.json-area { background:#0f1216; border-radius:6px; padding:8px; color:var(--muted,#9aa4b2); max-height:140px; overflow:auto }
.preview { flex:1; background:#0f1216; border-radius:6px; padding:8px; overflow:auto }
.panel-body { padding:12px; box-sizing:border-box; height: calc(100% - 56px) }
.btn { background:var(--accent,#5f9bff); color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;width: auto;font-size: 14px; }
.btn-close { background:#2a2a2a }
</style>