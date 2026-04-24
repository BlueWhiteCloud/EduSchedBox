<template>
  <div class="assignment-crawler">
    <div class="top-bar">
      <div class="left-line" v-if="!isGeneratingMode">
        <div class="btn refresh-btn" @click="runCrawler" title="刷新作业"><span>↻</span></div>
      </div>
      <div class="left-line" v-else>
        <div class="action-text clickable" @click="toggleAllSelection"><div class="checkbox" :class="{checked: isAllSelected}"><span>{{ isAllSelected ? '✓' : '' }}</span></div> {{ isAllSelected ? '取消全选' : '未完成项全选' }}</div>
      </div>

      <div class="right-line" v-if="!isGeneratingMode">
        <span class="btn clickable-btn" @click="startGenerating">生成事件</span>
        <span class="btn clickable-btn" @click="showCourseModal = true">⚙</span>
      </div>
      <div class="right-line" v-else>
        <span class="action-text clickable" @click="cancelGenerating">取消选择</span>
        <span class="btn action-btn clickable" @click="confirmGenerate">确定</span>
      </div>
    </div>
    
    <div class="content">
      <div v-if="isCrawling" class="status-msg">正在爬取中...</div>
      <div v-else-if="homeworks.length === 0" class="status-msg">暂时没有相关作业</div>
      <ul v-else class="assignment-list">
        <li v-for="(hw, index) in homeworks" :key="index" class="assignment"
            :class="{'selected-hw': selectedHomeworks.has(index), 'is-generating': isGeneratingMode}"
            @click="toggleSelection(index)">
          <div class="first-line">
            <div class="assignment-name">{{ hw.name }}</div>
            <div class="assignment-course">{{ hw.source_file }}</div>
            <div class="completion" :class="{'done': hw.completion_status === 1}">
              {{ hw.completion_status === 1 ? '已完成' : '未完成' }}
            </div>
          </div>
          <div class="second-line">
            <div class="assignment-deadline">{{ formatDeadline(hw.end_time_s) }} 截止</div>
            <a class="assignment-url" href="#" @click.prevent="openUrl(hw.homework_url)">点击查看作业</a>
          </div>
        </li>
      </ul>
    </div>

    <!-- 错误提示弹窗 -->
    <AlertModal
      :visible="showErrorModal"
      :message="errorMessage"
      @close="closeErrorModal"
    />

    <!-- 学科设置弹窗 -->
    <CourseManagerModal
      :visible="showCourseModal"
      @close="showCourseModal = false"
      @saved="onCoursesSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useTaskStore } from '../stores/task.js'
import AlertModal from './AlertModal.vue'
import CourseManagerModal from './CourseManagerModal.vue'

const homeworks = ref<any[]>([])
const isCrawling = ref(false)

const isAllSelected = computed(() => {
  const incompleteIndices = homeworks.value.map((hw, index) => hw.completion_status !== 1 ? index : -1).filter(i => i !== -1)
  return incompleteIndices.length > 0 && incompleteIndices.every(i => selectedHomeworks.value.has(i))
})

const isGeneratingMode = ref(false)
const selectedHomeworks = ref(new Set<number>())
const taskStore = useTaskStore()

// 错误弹窗状态
const showErrorModal = ref(false)
const errorMessage = ref('')

// 学科设置弹窗状态
const showCourseModal = ref(false)

const onCoursesSaved = () => {
  // 可以在保存后给出提示，或者重新加载作业
}

const startGenerating = () => {
  if (homeworks.value.length === 0) return
  isGeneratingMode.value = true
  selectedHomeworks.value.clear()
}

const cancelGenerating = () => {
  isGeneratingMode.value = false
  selectedHomeworks.value.clear()
}

const toggleSelection = (index: number) => {
  if (!isGeneratingMode.value) return
  if (selectedHomeworks.value.has(index)) {
    selectedHomeworks.value.delete(index)
  } else {
    selectedHomeworks.value.add(index)
  }
}

const toggleAllSelection = () => {
  if (isAllSelected.value) {
    selectedHomeworks.value.clear()
  } else {
    homeworks.value.forEach((hw, index) => {
      if (hw.completion_status !== 1) {
        selectedHomeworks.value.add(index)
      }
    })
  }
}

const confirmGenerate = () => {
  if (selectedHomeworks.value.size === 0) {
    return
  }
  
  let validAddedCount = 0
  let duplicateCount = 0

  selectedHomeworks.value.forEach((index) => {
    const hw = homeworks.value[index]
    
    // 检查是否存在同名任务，存在则跳过
    if (taskStore.tasks.some(t => t.name === hw.name)) {
      duplicateCount++
      return
    }

    let deadline = ''
    let highlightTime = false
    if (hw.end_time_s) {
      // transform "2026-04-08 23:59:00" to "2026-04-08T23:59"
      deadline = hw.end_time_s.slice(0, 16).replace(' ', 'T')
      const timePart = deadline.split('T')[1]
      if (timePart) {
        const hh = parseInt(timePart.split(':')[0], 10)
        if (hh < 22) {
          highlightTime = true
        }
      }
    }
    
    const newId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5)
    taskStore.addTask({
      id: newId,
      name: hw.name,
      deadline: deadline,
      estimatedHours: 1,
      notes: '',
      status: 'active',
      highlightTime
    })
    // Ensure task progress is initiated for newly added tasks
    try {
      taskStore.refreshProgressForTask(newId)
    } catch(e) {
      console.warn(e)
    }
    validAddedCount++
  })
  
  cancelGenerating()
  if (duplicateCount > 0) {
    errorMessage.value = `成功添加 ${validAddedCount} 个事件，${duplicateCount} 个事件因同名已存在被自动跳过。`
    showErrorModal.value = true
  }
  // Ensure the task list is sorted
  try {
    taskStore.sortTasks()
  } catch(e) {}
}

const loadHomeworks = async () => {
  try {
    const data = await window.electronAPI.getUpcomingHomeworks()
    homeworks.value = data || []
  } catch (error) {
    console.error('获取已有作业失败:', error)
  }
}

const runCrawler = async () => {
  if (isCrawling.value) return
  isCrawling.value = true
  try {
    const result = await window.electronAPI.runCrawlerScripts()
    if (result.success && result.data) {
      homeworks.value = result.data
      // alert('爬虫成功，数据已更新！\n如果你需要运行下一次爬虫，请保持在运行过程中 Edge 处于关闭状态即可。')
      errorMessage.value = '爬虫成功，数据已更新！\n如果你需要运行下一次爬虫，请保持在运行过程中Edge处于关闭状态即可。'
      showErrorModal.value = true
    } else {
      console.error('爬虫执行失败:', result.error)
      // 显示自定义错误弹窗
      errorMessage.value = result.error || '作业爬取失败，发生未知错误。'
      showErrorModal.value = true
    }
  } catch (error) {
    console.error('调用爬虫时出错:', error)
    errorMessage.value = '请求爬虫时发生异常: ' + String(error)
    showErrorModal.value = true
  } finally {
    isCrawling.value = false
  }
}

const closeErrorModal = () => {
  showErrorModal.value = false
  errorMessage.value = ''
}

const formatDeadline = (timeStr: string) => {
  if (!timeStr) return ''
  // 转换 "2026-04-08 23:59:00" 为 "2026.04.08 23:59"
  // 直接切掉最后3个字符也就是 ":00" 并替换 "-" 为 "."
  return timeStr.slice(0, 16).replace(/-/g, '.')
}

const openUrl = (url: string) => {
  if (window.electronAPI && window.electronAPI.openExternal) {
    window.electronAPI.openExternal(url)
  }
}

onMounted(() => {
  loadHomeworks()
})
</script>

<style scoped>
.assignment-crawler {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 16px;
    overflow-y: auto;
}
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  height:40px;
  /* background-color: var(--theme-color-dark, #232a36); */
  border-bottom: 2px solid var(--theme-color-light);
}
.left-line .refresh-btn {
  /* cursor: pointer; */
  user-select: none;
  /* font-size: 1.2em; */
  color: var(--text, #e6e8eb);
  transition: color 0.2s;
  background-color: var(--theme-color-light);
  border:2px solid var(--theme-color-light);
}
.left-line .refresh-btn span{
  transform: translateY(1px);
  font-size: 24px;
}
.left-line .refresh-btn:hover {
  background: hsl(from var(--theme-color-light) h s calc(l * 1.2));
  border: 2px solid hsl(from var(--theme-color-light) h s calc(l * 1.2));
}
.left-line .action-text {
  font-size: 0.9em;
  color: var(--text, #e6e8eb);
  /* cursor: pointer; */
  user-select: none;
  display: flex;
  align-items: center;
}
.checkbox {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--text, #e6e8eb);
  margin-right: 4px;
  text-align: center;
  line-height: 12px;
  font-size: 12px;
  vertical-align: middle;
  transition: all 0.2s;
}
.checkbox span {
  display: inline-block;
  transform: translateY(1px);
  font-size: larger;
  font-weight:1000;
}
.checkbox.checked {
  background: var(--accent, #3CFFEF);
  color: #000;
  border-color: var(--accent, #3CFFEF);
}
.left-line .action-text:hover {
  color: var(--theme-color-light);
}
.right-line {
  display: flex;
  align-items: center;
}
.right-line .clickable-btn {
  font-size: 0.9em;
  padding-left: 8px;
  padding-right: 8px;
  background-color: var(--theme-color-light);
  border-radius: 4px;
  user-select: none;
  width:auto;
}
.right-line .clickable-btn:hover {
  background-color: hsl(from var(--theme-color-light) h s calc(l * 1.2));
}
.right-line .action-text {
  font-size: 0.9em;
  color: var(--text, #e6e8eb);
  /* cursor: pointer; */
  margin-right: 12px;
  user-select: none;
}
.right-line .action-text:hover {
  color: var(--theme-color-light);
}
.right-line .action-btn {
  font-size: 0.9em;
  padding: 4px 8px;
  background-color: var(--theme-color-light);
  color: #fff;
  border-radius: 4px;
  /* cursor: pointer; */
  user-select: none;
  width:auto;
}
.right-line .action-btn:hover {
  background-color: hsl(from var(--theme-color-light) h s calc(l * 1.2));
}
.content {
  flex: 1;
  /* overflow-y: auto; */
  padding: 10px;
}
.status-msg {
  text-align: center;
  color: #888;
  margin-top: 20px;
}
.assignment-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.assignment {
  background: var(--theme-color-dark);
  border: 2px solid var(--theme-color-light);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
  transition: all 0.2s;
  box-sizing: border-box;
}
.assignment.is-generating {
  /* cursor: pointer; */
}
.assignment.is-generating:hover {
  background: hsl(from var(--panel, #1E2327) h s calc(l * 1.4));
}
.assignment.selected-hw {
  border-left: 10px solid var(--theme-color-light) !important;
  background: hsl(from var(--panel, #1E2327) h s calc(l * 1.2));
}
.first-line {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}
.assignment-name {
  /* font-weight: bold; */
  flex: 1;
  color: var(--text, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.assignment-course {
  font-size: 0.8em;
  background: rgba(255,255,255,0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
  color: #ccc;
}
.completion {
  font-size: 0.8em;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--warning, #FF3C7C);
  color: #fff;
}
.completion.done {
  background: var(--success, #4caf50);
}
.second-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85em;
  color: #aaa;
}
.assignment-url {
  color: var(--golden-color, #FEDE44);
  text-decoration: none;
}
.assignment-url:hover {
  text-decoration: underline;
}
</style>


