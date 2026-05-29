import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  type RouteRecordRaw,
} from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('./views/LibraryHome.vue') },
  { path: '/author/:name', component: () => import('./views/AuthorView.vue'), props: true },
  { path: '/:bookId', component: () => import('./views/BookHome.vue'), props: true },
  { path: '/:bookId/:num', component: () => import('./views/PieceView.vue'), props: true },
]

export function createRouterInstance() {
  return createRouter({
    history: typeof window !== 'undefined'
      ? createWebHistory()
      : createMemoryHistory(),
    routes,
    scrollBehavior() {
      return { top: 0 }
    },
  })
}
