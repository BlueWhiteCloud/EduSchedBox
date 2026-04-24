import { createRouter, createWebHashHistory } from 'vue-router'
import MainCalendarView from '../views/MainCalendarView.vue'
import GenerateScheduleView from '../views/GenerateScheduleView.vue'

const routes = [
  { path: '/', component: MainCalendarView },
  { path: '/generate', component: GenerateScheduleView }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
