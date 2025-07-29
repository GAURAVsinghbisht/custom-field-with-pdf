import { createRouter, createWebHistory } from 'vue-router'
import Editor from '../components/Editor.vue'
import PatientList from '../components/PatientList.vue'

const routes = [
  { path: '/editor',       name: 'Editor',      component: Editor },
  { path: '/patients',     name: 'PatientList', component: PatientList },
  { path: '/:catchAll(.*)', redirect: '/editor' }
]

export default createRouter({
  history: createWebHistory(),
  routes,
})