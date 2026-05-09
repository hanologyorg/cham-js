import { createApp as _createApp } from 'vue'
import { createHead as createHeadSSR } from '@unhead/vue/server'
import { createHead as createHeadClient } from '@unhead/vue/client'
import { createRouterInstance, routes } from './router'
import App from './App.vue'
import './styles/main.css'

export async function createApp() {
  const router = createRouterInstance()
  const head = import.meta.env.SSR ? createHeadSSR() : createHeadClient()
  const app = _createApp(App)
  app.use(head)
  app.use(router)
  return { app, router, routes, head }
}

if (!import.meta.env.SSR) {
  createApp().then(({ app, router }) => {
    app.mount('#app')
    document.getElementById('app-loading')?.remove()
  })
}
