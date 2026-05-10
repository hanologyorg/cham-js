import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  type RouteRecordRaw,
} from 'vue-router'
import LibraryHome from './views/LibraryHome.vue'
import BookHome from './views/BookHome.vue'
import PieceView from './views/PieceView.vue'
import AuthorView from './views/AuthorView.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', component: LibraryHome },
  { path: '/author/:name', component: AuthorView, props: true },
  { path: '/:bookId', component: BookHome, props: true },
  { path: '/:bookId/:num', component: PieceView, props: true },
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
