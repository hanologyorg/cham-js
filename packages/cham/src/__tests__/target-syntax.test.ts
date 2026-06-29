import { describe, it, expect } from 'vitest'
import { parseTarget } from '../parser/target-parser.js'
import { serializeTarget } from '../serializer/target-serializer.js'
import {
  targetCategory,
  requiresResolution,
  targetSortKey,
  describeTarget,
} from '../model/target.js'

// ─── Target Parser ─────────────────────────────────────────────

describe('parseTarget', () => {
  describe('inline marker syntax', () => {
    it('parses {N}', () => {
      const result = parseTarget('{1} meaning [x]')
      expect(result).not.toBeNull()
      expect(result!.target).toEqual({ type: 'marker', markerId: 1 })
      expect(result!.consumed).toBe(3)
    })

    it('parses multi-digit marker IDs', () => {
      const result = parseTarget('{123} meaning [x]')
      expect(result!.target).toEqual({ type: 'marker', markerId: 123 })
    })
  })

  describe('special targets', () => {
    it('parses @title', () => {
      const result = parseTarget('@title meaning [x]')
      expect(result!.target).toEqual({ type: 'title' })
      expect(result!.consumed).toBe(6)
    })

    it('parses @full', () => {
      const result = parseTarget('@full meaning [x]')
      expect(result!.target).toEqual({ type: 'full' })
      expect(result!.consumed).toBe(5)
    })
  })

  describe('position targets', () => {
    it('parses @verse:N:C', () => {
      const result = parseTarget('@verse:0:3 meaning [x]')
      expect(result!.target).toEqual({ type: 'verse', line: 0, char: 3 })
    })

    it('parses @verse:N:C-E', () => {
      const result = parseTarget('@verse:3:0-5 meaning [x]')
      expect(result!.target).toEqual({ type: 'verse', line: 3, char: 0, end: 5 })
    })

    it('parses @position as alias for @verse', () => {
      const result = parseTarget('@position:1:2 commentary [x]')
      expect(result!.target.type).toBe('verse')
    })
  })

  describe('verse-all target', () => {
    it('parses @v:N', () => {
      const result = parseTarget('@v:5 meaning [x]')
      expect(result!.target).toEqual({ type: 'verse-all', line: 5 })
    })
  })

  describe('text-quote targets', () => {
    it('parses @[quote]', () => {
      const result = parseTarget('@[多桂] commentary [桂葉似枇杷]')
      expect(result!.target).toEqual({ type: 'text', quote: '多桂' })
    })

    it('parses @N[quote] with verse hint', () => {
      const result = parseTarget('@3[又東三百里] commentary [x]')
      expect(result!.target).toEqual({ type: 'text', quote: '又東三百里', verseHint: 3 })
    })

    it('handles multi-character Chinese quotes', () => {
      const result = parseTarget('@[南山經之首曰䧿山] commentary [x]')
      expect(result!.target).toEqual({ type: 'text', quote: '南山經之首曰䧿山' })
    })
  })

  describe('invalid input', () => {
    it('returns null for non-target input', () => {
      expect(parseTarget('meaning [x]')).toBeNull()
      expect(parseTarget('')).toBeNull()
      expect(parseTarget('random text')).toBeNull()
    })

    it('returns null for malformed marker', () => {
      expect(parseTarget('{abc} meaning [x]')).toBeNull()
    })

    it('returns null for marker not followed by whitespace', () => {
      expect(parseTarget('{1}meaning [x]')).toBeNull()
    })

    it('returns null for @title not followed by whitespace or EOL', () => {
      expect(parseTarget('@titlefoo [x]')).toBeNull()
      expect(parseTarget('@title:extra')).toBeNull()
    })

    it('returns null for @full not followed by whitespace or EOL', () => {
      expect(parseTarget('@fulltext [x]')).toBeNull()
    })

    it('returns null for unknown @ prefix', () => {
      expect(parseTarget('@unknown target')).toBeNull()
    })

    it('returns null for malformed position target', () => {
      expect(parseTarget('@verse:abc:0 meaning [x]')).toBeNull()
      expect(parseTarget('@verse:1:x meaning [x]')).toBeNull()
      expect(parseTarget('@verse:1:2:3 meaning [x]')).toBeNull()
      expect(parseTarget('@verse:1:2-3-4 meaning [x]')).toBeNull()
    })

    it('returns null for malformed verse-all target', () => {
      expect(parseTarget('@v:abc meaning [x]')).toBeNull()
      expect(parseTarget('@v:1abc meaning [x]')).toBeNull()
    })

    it('returns null for empty text quote', () => {
      expect(parseTarget('@[] meaning [x]')).toBeNull()
    })
  })
})

// ─── Target Serializer ─────────────────────────────────────────

describe('serializeTarget', () => {
  it('serializes marker', () => {
    expect(serializeTarget({ type: 'marker', markerId: 1 })).toBe('{1}')
  })

  it('serializes verse without end', () => {
    expect(serializeTarget({ type: 'verse', line: 0, char: 3 })).toBe('@verse:0:3')
  })

  it('serializes verse with end', () => {
    expect(serializeTarget({ type: 'verse', line: 3, char: 0, end: 5 })).toBe('@verse:3:0-5')
  })

  it('serializes verse-all', () => {
    expect(serializeTarget({ type: 'verse-all', line: 5 })).toBe('@v:5')
  })

  it('serializes text without hint', () => {
    expect(serializeTarget({ type: 'text', quote: '多桂' })).toBe('@[多桂]')
  })

  it('serializes text with hint', () => {
    expect(serializeTarget({ type: 'text', quote: '多桂', verseHint: 3 })).toBe('@3[多桂]')
  })

  it('serializes title and full', () => {
    expect(serializeTarget({ type: 'title' })).toBe('@title')
    expect(serializeTarget({ type: 'full' })).toBe('@full')
  })
})

// ─── Round-Trip: parse → serialize ─────────────────────────────

describe('target round-trip', () => {
  const cases = [
    { type: 'marker' as const, markerId: 42 },
    { type: 'verse' as const, line: 0, char: 3 },
    { type: 'verse' as const, line: 3, char: 0, end: 5 },
    { type: 'verse-all' as const, line: 7 },
    { type: 'text' as const, quote: '多桂' },
    { type: 'text' as const, quote: '又東三百里', verseHint: 3 },
    { type: 'title' as const },
    { type: 'full' as const },
  ]

  for (const target of cases) {
    it(`round-trips ${target.type}`, () => {
      const serialized = serializeTarget(target)
      const parsed = parseTarget(serialized + ' meaning [x]')
      expect(parsed).not.toBeNull()
      expect(parsed!.target).toEqual(target)
    })
  }
})

// ─── @position: alias asymmetry ────────────────────────────────
// The parser accepts `@position:` as a synonym for `@verse:` (legacy
// compatibility), but the serializer always emits the canonical `@verse:`
// form. This pin documents the asymmetry so a future edit doesn't
// silently change round-trip behavior.

describe('@position: alias asymmetry', () => {
  it('parser accepts @position: as alias for @verse:', () => {
    const result = parseTarget('@position:1:2 meaning [x]')
    expect(result).not.toBeNull()
    expect(result!.target).toEqual({ type: 'verse', line: 1, char: 2 })
  })

  it('serializer always emits @verse: (not @position:)', () => {
    const serialized = serializeTarget({ type: 'verse', line: 1, char: 2 })
    expect(serialized).toBe('@verse:1:2')
    expect(serialized).not.toContain('position')
  })

  it('round-trip from @position: to @verse: (form is normalized)', () => {
    const parsed = parseTarget('@position:3:4 meaning [x]')!
    const reserialized = serializeTarget(parsed.target)
    expect(reserialized).toBe('@verse:3:4')
  })
})

// ─── Target Model Operations ───────────────────────────────────

describe('targetCategory', () => {
  it('categorizes marker targets', () => {
    expect(targetCategory({ type: 'marker', markerId: 1 })).toBe('marker')
  })

  it('categorizes position targets', () => {
    expect(targetCategory({ type: 'verse', line: 0, char: 0 })).toBe('position')
    expect(targetCategory({ type: 'verse-all', line: 0 })).toBe('position')
  })

  it('categorizes text targets', () => {
    expect(targetCategory({ type: 'text', quote: 'x' })).toBe('text')
  })

  it('categorizes special targets', () => {
    expect(targetCategory({ type: 'title' })).toBe('special')
    expect(targetCategory({ type: 'full' })).toBe('special')
  })
})

describe('requiresResolution', () => {
  it('returns true for marker, verse, verse-all, text', () => {
    expect(requiresResolution({ type: 'marker', markerId: 1 })).toBe(true)
    expect(requiresResolution({ type: 'verse', line: 0, char: 0 })).toBe(true)
    expect(requiresResolution({ type: 'verse-all', line: 0 })).toBe(true)
    expect(requiresResolution({ type: 'text', quote: 'x' })).toBe(true)
  })

  it('returns false for title and full', () => {
    expect(requiresResolution({ type: 'title' })).toBe(false)
    expect(requiresResolution({ type: 'full' })).toBe(false)
  })
})

describe('targetSortKey', () => {
  it('sorts title first', () => {
    const titleKey = targetSortKey({ type: 'title' })
    const markerKey = targetSortKey({ type: 'marker', markerId: 1 })
    expect(titleKey[0]).toBeLessThan(markerKey[0])
  })

  it('sorts full last', () => {
    const fullKey = targetSortKey({ type: 'full' })
    const markerKey = targetSortKey({ type: 'marker', markerId: 999 })
    expect(fullKey[0]).toBeGreaterThan(markerKey[0])
  })

  it('sorts markers by ID', () => {
    expect(targetSortKey({ type: 'marker', markerId: 1 })[0]).toBe(1)
    expect(targetSortKey({ type: 'marker', markerId: 5 })[0]).toBe(5)
  })
})

describe('describeTarget', () => {
  it('describes each target type', () => {
    expect(describeTarget({ type: 'marker', markerId: 1 })).toBe('{1}')
    expect(describeTarget({ type: 'text', quote: '多桂' })).toBe('@[多桂]')
    expect(describeTarget({ type: 'title' })).toBe('@title')
  })
})
