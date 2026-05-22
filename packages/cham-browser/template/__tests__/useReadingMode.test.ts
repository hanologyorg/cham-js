import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

// useReadingMode accesses localStorage and document at module level,
// so we must mock them before importing.
const localStorageStore: Record<string, string> = {}
const attributeStore: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (k: string) => localStorageStore[k] ?? null,
  setItem: (k: string, v: string) => { localStorageStore[k] = v },
  removeItem: (k: string) => { delete localStorageStore[k] },
  clear: () => Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]),
})

vi.stubGlobal('document', {
  documentElement: {
    setAttribute: (k: string, v: string) => { attributeStore[k] = v },
    getAttribute: (k: string) => attributeStore[k] ?? null,
    style: {
      setProperty: vi.fn(),
    },
  },
})

describe('useReadingMode', () => {
  let useReadingMode: typeof import('../src/composables/useReadingMode').useReadingMode

  beforeEach(() => {
    // Clear stores
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k])
    Object.keys(attributeStore).forEach(k => delete attributeStore[k])
    // Import fresh each time to exercise module-level init
    vi.resetModules()
  })

  it('defaults to vertical layout when no saved preference', async () => {
    const mod = await import('../src/composables/useReadingMode')
    useReadingMode = mod.useReadingMode
    const { layout } = useReadingMode()
    expect(layout.value).toBe('vertical')
  })

  it('restores saved horizontal layout after nextTick', async () => {
    localStorageStore.layout = 'horizontal'
    const mod = await import('../src/composables/useReadingMode')
    useReadingMode = mod.useReadingMode
    const { layout } = useReadingMode()
    // Module-level nextTick runs during import, so by now layout is restored
    await nextTick()
    expect(layout.value).toBe('horizontal')
  })

  it('toggleLayout switches between horizontal and vertical', async () => {
    const mod = await import('../src/composables/useReadingMode')
    useReadingMode = mod.useReadingMode
    const { layout, toggleLayout } = useReadingMode()
    expect(layout.value).toBe('vertical')
    toggleLayout()
    expect(layout.value).toBe('horizontal')
    toggleLayout()
    expect(layout.value).toBe('vertical')
  })

  it('cycleTheme rotates through themes', async () => {
    const mod = await import('../src/composables/useReadingMode')
    useReadingMode = mod.useReadingMode
    const { theme, cycleTheme } = useReadingMode()
    const themes = ['light', 'sepia', 'dark', 'oled']
    expect(theme.value).toBe('light')
    for (let i = 1; i <= 4; i++) {
      cycleTheme()
      expect(theme.value).toBe(themes[i % 4])
    }
  })

  it('layout watcher writes to localStorage (not immediate)', async () => {
    localStorageStore.layout = 'horizontal'
    const mod = await import('../src/composables/useReadingMode')
    useReadingMode = mod.useReadingMode
    const { layout, setLayout } = useReadingMode()
    // Layout watcher should NOT have overwritten saved value immediately
    expect(localStorageStore.layout).toBe('horizontal')
    await nextTick()
    expect(localStorageStore.layout).toBe('horizontal')
    // Now change layout — watcher should fire
    setLayout('vertical')
    await nextTick()
    expect(localStorageStore.layout).toBe('vertical')
  })

  it('exposes all expected reactive refs and setters', async () => {
    const mod = await import('../src/composables/useReadingMode')
    useReadingMode = mod.useReadingMode
    const r = useReadingMode()
    expect(r.theme).toBeDefined()
    expect(r.layout).toBeDefined()
    expect(r.mainFontSize).toBeDefined()
    expect(r.bodyFontSize).toBeDefined()
    expect(r.annotationsVisible).toBeDefined()
    expect(r.annotationPane).toBeDefined()
    expect(r.setTheme).toBeTypeOf('function')
    expect(r.cycleTheme).toBeTypeOf('function')
    expect(r.setLayout).toBeTypeOf('function')
    expect(r.toggleLayout).toBeTypeOf('function')
    expect(r.setMainFontSize).toBeTypeOf('function')
    expect(r.setBodyFontSize).toBeTypeOf('function')
    expect(r.setAnnotationsVisible).toBeTypeOf('function')
    expect(r.toggleAnnotationsVisible).toBeTypeOf('function')
    expect(r.setAnnotationPane).toBeTypeOf('function')
    expect(r.toggleAnnotationPane).toBeTypeOf('function')
  })
})
