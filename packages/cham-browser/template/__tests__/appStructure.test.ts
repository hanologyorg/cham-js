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

  it('Suspense keys on route.fullPath', () => {
    // router-view must destructure both Component and route
    expect(appVue).toMatch(/v-slot="\{ Component,\s*route \}"/)
    expect(appVue).toMatch(/:key="route\.fullPath"/)
  })

  it('has page-fade Transition wrapping Suspense', () => {
    expect(appVue).toContain('page-fade')
    expect(appVue).toMatch(/<Transition[^>]*name="page-fade"/)
  })

  it('has page-fade CSS transition classes', () => {
    expect(appVue).toContain('.page-fade-enter-active')
    expect(appVue).toContain('.page-fade-leave-active')
  })

  it('renders <component :is="Component" /> inside Suspense', () => {
    // Check that Component is used as a dynamic component
    expect(appVue).toContain(':is="Component"')
  })
})
