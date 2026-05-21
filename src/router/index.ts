import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'upload',
      component: () => import('../views/UploadView.vue'),
    },
    {
      path: '/dashboard/:packageId',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/rule/:packageId/:ruleId',
      name: 'ruleDetail',
      component: () => import('../views/RuleDetailView.vue'),
    },
  ],
})

export default router
