import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const appVue = readFileSync(
  resolve(__dirname, '../src/App.vue'),
  'utf-8',
)

describe('App.vue structure', () => {
  it('wraps router-view in Suspense', () => {
    expect(appVue).toContain('<Suspense')
  })

  it('Suspense has a fallback slot with route-loading', () => {
    expect(appVue).toContain('#fallback')
    expect(appVue).toContain('route-loading')
  })

  it('component uses route.fullPath as key', () => {
    expect(appVue).toMatch(/:key="route\.fullPath"/)
  })

  it('renders <component :is="Component" /> inside Suspense', () => {
    expect(appVue).toContain(':is="Component"')
  })

  it('has page-fade CSS transition classes', () => {
    expect(appVue).toContain('.page-fade-enter-active')
    expect(appVue).toContain('.page-fade-leave-active')
  })

  it('does NOT wrap Suspense in Transition (causes async nav failures)', () => {
    // Transition + Suspense combination breaks async component navigation
    expect(appVue).not.toMatch(/<Transition[^>]*>[\s\S]*<Suspense/)
  })
})
