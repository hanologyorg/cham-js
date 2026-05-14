import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveHoveredAnnotations, useAnnotationTooltip } from '../src/composables/useAnnotationRenderer'
import type { Annotation } from '../src/types'

function makeAnn(overrides: Partial<Annotation> & { id: string; kind: Annotation['kind'] }): Annotation {
  return {
    text: 'test',
    range: { scope: 'verse', verseIndex: 0, start: 0, end: 1 },
    ...overrides,
  }
}

function createMockEvent(target: HTMLElement): MouseEvent {
  return { target } as MouseEvent
}

function createAnnTarget(ids: string[], kinds: string): HTMLElement {
  const el = document.createElement('span')
  el.className = `ann-target ${kinds}`
  el.setAttribute('data-ann-ids', ids.join(','))
  el.textContent = 'test text'
  return el
}

describe('resolveHoveredAnnotations', () => {
  const annotations: Annotation[] = [
    makeAnn({ id: 'a1', kind: 'semantic' }),
    makeAnn({ id: 'p1', kind: 'pronunciation' }),
    makeAnn({ id: 'a2', kind: 'semantic' }),
  ]

  it('returns null when target is not an ann-target element', () => {
    const plain = document.createElement('span')
    const result = resolveHoveredAnnotations(createMockEvent(plain), annotations)
    expect(result).toBeNull()
  })

  it('returns matched annotations by id', () => {
    const target = createAnnTarget(['a1'], 'semantic')
    // Mock closest to return itself
    target.closest = vi.fn().mockReturnValue(target)
    const result = resolveHoveredAnnotations(createMockEvent(target), annotations)
    expect(result).toHaveLength(1)
    expect(result![0].id).toBe('a1')
  })

  it('returns multiple annotations for overlapping targets', () => {
    const target = createAnnTarget(['a1', 'p1'], 'semantic pronunciation')
    target.closest = vi.fn().mockReturnValue(target)
    const result = resolveHoveredAnnotations(createMockEvent(target), annotations)
    expect(result).toHaveLength(2)
    const ids = result!.map(a => a.id).sort()
    expect(ids).toEqual(['a1', 'p1'])
  })

  it('returns null when no matching annotation found', () => {
    const target = createAnnTarget(['unknown'], 'semantic')
    target.closest = vi.fn().mockReturnValue(target)
    const result = resolveHoveredAnnotations(createMockEvent(target), annotations)
    expect(result).toBeNull()
  })
})

describe('useAnnotationTooltip', () => {
  beforeEach(() => {
    // Mock window.innerWidth for desktop
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true })
  })

  it('starts hidden', () => {
    const { visible } = useAnnotationTooltip()
    expect(visible.value).toBe(false)
  })

  it('shows tooltip on show()', () => {
    const { visible, items, show } = useAnnotationTooltip()
    const target = createAnnTarget(['a1'], 'semantic')
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100, top: 200, bottom: 230, right: 150, width: 50, height: 30,
    })
    const anns = [makeAnn({ id: 'a1', kind: 'semantic' })]
    show(createMockEvent(target), anns)
    expect(visible.value).toBe(true)
    expect(items.value).toEqual(anns)
  })

  it('hides tooltip on hide()', () => {
    const { visible, show, hide } = useAnnotationTooltip()
    const target = createAnnTarget(['a1'], 'semantic')
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100, top: 200, bottom: 230, right: 150, width: 50, height: 30,
    })
    show(createMockEvent(target), [makeAnn({ id: 'a1', kind: 'semantic' })])
    expect(visible.value).toBe(true)
    hide()
    expect(visible.value).toBe(false)
  })

  it('toggle shows when not visible', () => {
    const { visible, toggle } = useAnnotationTooltip()
    const target = createAnnTarget(['a1'], 'semantic')
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100, top: 200, bottom: 230, right: 150, width: 50, height: 30,
    })
    expect(visible.value).toBe(false)
    toggle(createMockEvent(target), [makeAnn({ id: 'a1', kind: 'semantic' })])
    expect(visible.value).toBe(true)
  })

  describe('mobile toggle behavior', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true })
    })

    it('dismisses on toggle when same annotation on mobile', () => {
      const { visible, show, toggle } = useAnnotationTooltip()
      const target = createAnnTarget(['a1'], 'semantic')
      target.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 100, top: 200, bottom: 230, right: 150, width: 50, height: 30,
      })
      const anns = [makeAnn({ id: 'a1', kind: 'semantic' })]
      show(createMockEvent(target), anns)
      expect(visible.value).toBe(true)
      toggle(createMockEvent(target), anns)
      expect(visible.value).toBe(false)
    })

    it('shows new annotation on toggle when different on mobile', () => {
      const { visible, show, toggle, items } = useAnnotationTooltip()
      const target = createAnnTarget(['a1'], 'semantic')
      target.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 100, top: 200, bottom: 230, right: 150, width: 50, height: 30,
      })
      const anns1 = [makeAnn({ id: 'a1', kind: 'semantic' })]
      const anns2 = [makeAnn({ id: 'a2', kind: 'semantic' })]
      show(createMockEvent(target), anns1)
      toggle(createMockEvent(target), anns2)
      expect(visible.value).toBe(true)
      expect(items.value[0].id).toBe('a2')
    })
  })

  describe('desktop toggle behavior', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })
    })

    it('does NOT dismiss on toggle when same annotation on desktop', () => {
      const { visible, show, toggle } = useAnnotationTooltip()
      const target = createAnnTarget(['a1'], 'semantic')
      target.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 100, top: 200, bottom: 230, right: 150, width: 50, height: 30,
      })
      const anns = [makeAnn({ id: 'a1', kind: 'semantic' })]
      show(createMockEvent(target), anns)
      expect(visible.value).toBe(true)
      toggle(createMockEvent(target), anns)
      // Desktop: same annotation stays open
      expect(visible.value).toBe(true)
    })
  })

  it('positions tooltip for vertical layout (default)', () => {
    const { style, show } = useAnnotationTooltip()
    const target = createAnnTarget(['a1'], 'semantic')
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 200, top: 300, bottom: 330, right: 250, width: 50, height: 30,
    })
    show(createMockEvent(target), [makeAnn({ id: 'a1', kind: 'semantic' })])
    // Default layout is vertical — positioned via left + top
    expect(style.value.left).toBeTruthy()
    expect(style.value.top).toBeTruthy()
  })
})
