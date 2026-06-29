import { describe, it, expect } from 'vitest'
import {
  TargetResolver,
  TargetResolutionError,
} from '../resolver/target-resolver.js'
import type { TextBlock, MarkerTable, AnnotationTarget } from '../types.js'

// ─── Fixtures ──────────────────────────────────────────────────

const TEXT_BLOCKS: TextBlock[] = [
  { sectionIndex: 0, blockIndexInSection: 0, text: '南山經之首曰䧿山其首曰招揺之山', display: '', source: '' },
  { sectionIndex: 0, blockIndexInSection: 1, text: '多桂多金玉有草焉其狀如韭', display: '', source: '' },
  { sectionIndex: 0, blockIndexInSection: 2, text: '又東三百里曰堂庭之山', display: '', source: '' },
  { sectionIndex: 0, blockIndexInSection: 3, text: '又東三百里曰猨翼之山', display: '', source: '' },
]

const MARKERS: MarkerTable = new Map([
  [1, { id: 1, sectionIndex: 0, blockIndex: 0, offset: 0, length: 6, text: '南山經之首曰䧿山' }],
  [2, { id: 2, sectionIndex: 0, blockIndex: 1, offset: 0, length: 2, text: '多桂' }],
])

function makeResolver(): TargetResolver {
  return new TargetResolver(MARKERS, TEXT_BLOCKS)
}

// ─── TargetResolver ────────────────────────────────────────────

describe('TargetResolver', () => {
  describe('marker targets', () => {
    it('resolves an existing marker', () => {
      const r = makeResolver()
      const resolved = r.resolve({ type: 'marker', markerId: 1 })
      expect(resolved.verseIndex).toBe(0)
      expect(resolved.charStart).toBe(0)
      expect(resolved.charEnd).toBe(6)
      expect(resolved.scope).toBe('verse')
    })

    it('throws on missing marker', () => {
      const r = makeResolver()
      expect(() => r.resolve({ type: 'marker', markerId: 999 })).toThrow(TargetResolutionError)
      try {
        r.resolve({ type: 'marker', markerId: 999 })
      } catch (e) {
        expect((e as TargetResolutionError).reason).toBe('missing-marker')
      }
    })
  })

  describe('verse targets', () => {
    it('resolves a verse target', () => {
      const r = makeResolver()
      const resolved = r.resolve({ type: 'verse', line: 1, char: 0, end: 2 })
      expect(resolved.verseIndex).toBe(1)
      expect(resolved.charStart).toBe(0)
      expect(resolved.charEnd).toBe(2)
    })

    it('resolves a verse target without end (defaults to char+1)', () => {
      const r = makeResolver()
      const resolved = r.resolve({ type: 'verse', line: 0, char: 3 })
      expect(resolved.charStart).toBe(3)
      expect(resolved.charEnd).toBe(4)
    })

    it('throws on invalid verse index', () => {
      const r = makeResolver()
      expect(() => r.resolve({ type: 'verse', line: 99, char: 0 })).toThrow(TargetResolutionError)
    })
  })

  describe('verse-all targets', () => {
    it('resolves to the entire verse range', () => {
      const r = makeResolver()
      const resolved = r.resolve({ type: 'verse-all', line: 1 })
      expect(resolved.verseIndex).toBe(1)
      expect(resolved.charStart).toBe(0)
      expect(resolved.charEnd).toBe(TEXT_BLOCKS[1].text.length)
    })

    it('throws on invalid verse index', () => {
      const r = makeResolver()
      expect(() => r.resolve({ type: 'verse-all', line: 99 })).toThrow(TargetResolutionError)
    })
  })

  describe('text-quote targets', () => {
    it('resolves a unique text quote', () => {
      const r = makeResolver()
      const resolved = r.resolve({ type: 'text', quote: '招揺之山' })
      expect(resolved.verseIndex).toBe(0)
      expect(resolved.charStart).toBe(11)
      expect(resolved.charEnd).toBe(15)
    })

    it('throws on unresolved text', () => {
      const r = makeResolver()
      try {
        r.resolve({ type: 'text', quote: '不存在' })
        expect.fail('should have thrown')
      } catch (e) {
        expect((e as TargetResolutionError).reason).toBe('unresolved-text')
      }
    })

    it('throws on ambiguous text without hint', () => {
      const r = makeResolver()
      try {
        r.resolve({ type: 'text', quote: '又東三百里' })
        expect.fail('should have thrown')
      } catch (e) {
        expect((e as TargetResolutionError).reason).toBe('ambiguous-text')
      }
    })

    it('resolves ambiguous text with verse hint', () => {
      const r = makeResolver()
      const resolved = r.resolve({ type: 'text', quote: '又東三百里', verseHint: 3 })
      expect(resolved.verseIndex).toBe(3)
    })
  })

  describe('special targets', () => {
    it('resolves title target', () => {
      const r = makeResolver()
      const resolved = r.resolve({ type: 'title' })
      expect(resolved.scope).toBe('title')
      expect(resolved.verseIndex).toBe(-1)
    })

    it('resolves full target', () => {
      const r = makeResolver()
      const resolved = r.resolve({ type: 'full' })
      expect(resolved.scope).toBe('title')
      expect(resolved.charEnd).toBe(0)
    })
  })

  describe('tryResolve', () => {
    it('returns undefined instead of throwing', () => {
      const r = makeResolver()
      expect(r.tryResolve({ type: 'marker', markerId: 999 })).toBeUndefined()
      expect(r.tryResolve({ type: 'text', quote: '不存在' })).toBeUndefined()
    })

    it('returns resolved target on success', () => {
      const r = makeResolver()
      const resolved = r.tryResolve({ type: 'marker', markerId: 1 })
      expect(resolved).toBeDefined()
      expect(resolved!.verseIndex).toBe(0)
    })
  })
})
