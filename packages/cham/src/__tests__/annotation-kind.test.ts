import { describe, it, expect } from 'vitest'
import { AnnotationKindRegistry } from '../model/annotation-kind.js'

// ─── AnnotationKindRegistry ────────────────────────────────────

describe('AnnotationKindRegistry', () => {
  describe('DEFAULT registry', () => {
    it('has all built-in kinds', () => {
      const r = AnnotationKindRegistry.DEFAULT
      expect(r.has('fanqie')).toBe(true)
      expect(r.has('zhiyin')).toBe(true)
      expect(r.has('meaning')).toBe(true)
      expect(r.has('commentary')).toBe(true)
      expect(r.has('person')).toBe(true)
      expect(r.has('collation')).toBe(true)
      expect(r.has('see-also')).toBe(true)
      expect(r.has('speaker')).toBe(true)
      expect(r.has('variant')).toBe(true)
      expect(r.has('skqs-variant')).toBe(true)
    })

    it('reports false for unknown kinds', () => {
      expect(AnnotationKindRegistry.DEFAULT.has('nonexistent')).toBe(false)
    })

    it('allKinds returns all registered kinds', () => {
      const kinds = AnnotationKindRegistry.DEFAULT.allKinds()
      expect(kinds.length).toBeGreaterThanOrEqual(18)
      expect(kinds).toContain('fanqie')
      expect(kinds).toContain('meaning')
    })
  })

  describe('mapToOutput', () => {
    it('maps pron to pronunciation', () => {
      expect(AnnotationKindRegistry.DEFAULT.mapToOutput('pron')).toBe('pronunciation')
    })

    it('maps meaning to semantic', () => {
      expect(AnnotationKindRegistry.DEFAULT.mapToOutput('meaning')).toBe('semantic')
    })

    it('passes through other kinds unchanged', () => {
      expect(AnnotationKindRegistry.DEFAULT.mapToOutput('commentary')).toBe('commentary')
      expect(AnnotationKindRegistry.DEFAULT.mapToOutput('fanqie')).toBe('fanqie')
      expect(AnnotationKindRegistry.DEFAULT.mapToOutput('person')).toBe('person')
    })

    it('passes through unknown kinds unchanged', () => {
      expect(AnnotationKindRegistry.DEFAULT.mapToOutput('custom')).toBe('custom')
    })
  })

  describe('sortByDisplayOrder', () => {
    it('sorts kinds by their display order', () => {
      const r = AnnotationKindRegistry.DEFAULT
      const sorted = r.sortByDisplayOrder(
        ['commentary', 'fanqie', 'meaning', 'person'],
        k => k,
      )
      // fanqie=2, meaning=5, person=6, commentary=8
      expect(sorted).toEqual(['fanqie', 'meaning', 'person', 'commentary'])
    })

    it('is a stable sort for same-order items', () => {
      const r = AnnotationKindRegistry.DEFAULT
      const sorted = r.sortByDisplayOrder(
        ['meaning', 'commentary', 'meaning', 'commentary'],
        k => k,
      )
      // meaning (5) before commentary (8); stable preserves input order within same group
      expect(sorted).toEqual(['meaning', 'meaning', 'commentary', 'commentary'])
    })
  })

  describe('params', () => {
    it('reports required params for fanqie', () => {
      expect(AnnotationKindRegistry.DEFAULT.requiredParams('fanqie')).toEqual(['upper', 'lower'])
    })

    it('reports no required params for meaning', () => {
      expect(AnnotationKindRegistry.DEFAULT.requiredParams('meaning')).toEqual([])
    })

    it('reports optional params for person', () => {
      expect(AnnotationKindRegistry.DEFAULT.optionalParams('person')).toEqual(['ref'])
    })

    it('returns empty for unknown kind', () => {
      expect(AnnotationKindRegistry.DEFAULT.requiredParams('nonexistent')).toEqual([])
      expect(AnnotationKindRegistry.DEFAULT.optionalParams('nonexistent')).toEqual([])
    })
  })

  describe('custom registry', () => {
    it('allows constructing a registry with additional kinds', () => {
      const r = new AnnotationKindRegistry([
        {
          kind: 'custom-kind' as any,
          outputKind: 'custom-kind',
          displayOrder: 50,
          params: { required: ['x'], optional: [] },
        },
      ])
      expect(r.has('custom-kind')).toBe(true)
      expect(r.requiredParams('custom-kind')).toEqual(['x'])
      // Built-in kinds still present
      expect(r.has('fanqie')).toBe(true)
    })
  })

  describe('get spec', () => {
    it('returns full spec for a known kind', () => {
      const spec = AnnotationKindRegistry.DEFAULT.get('fanqie')
      expect(spec).toBeDefined()
      expect(spec!.outputKind).toBe('fanqie')
      expect(spec!.params.required).toEqual(['upper', 'lower'])
    })

    it('returns undefined for unknown kind', () => {
      expect(AnnotationKindRegistry.DEFAULT.get('nonexistent')).toBeUndefined()
    })
  })
})
