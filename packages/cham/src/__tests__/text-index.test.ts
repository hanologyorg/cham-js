import { describe, it, expect } from 'vitest'
import {
  TextIndex,
  TextQuoteNotFoundError,
  TextQuoteAmbiguousError,
} from '../resolver/text-index.js'
import type { TextBlock } from '../types.js'

// ─── Fixtures ──────────────────────────────────────────────────

function makeBlocks(...texts: string[]): TextBlock[] {
  return texts.map((text, i) => ({
    sectionIndex: 0,
    blockIndexInSection: i,
    text,
    display: text,
    source: text,
  }))
}

// 南(0)山(1)經(2)之(3)首(4)曰(5)䧿(6)山(7)其(8)首(9)曰(10)招(11)揺(12)之(13)山(14) = 15 chars
const BLOCKS = makeBlocks(
  '南山經之首曰䧿山其首曰招揺之山',
  '多桂多金玉有草焉其狀如韭',
  '又東三百里曰堂庭之山',
  '又東三百里曰猨翼之山',
)

// ─── TextIndex ─────────────────────────────────────────────────

describe('TextIndex', () => {
  describe('findAll', () => {
    it('finds a unique quote', () => {
      const index = new TextIndex(BLOCKS)
      const results = index.findAll('招揺之山')
      expect(results).toHaveLength(1)
      expect(results[0].verseIndex).toBe(0)
      expect(results[0].charStart).toBe(11)
      expect(results[0].charEnd).toBe(15)
    })

    it('finds multiple occurrences of a repeated phrase', () => {
      const index = new TextIndex(BLOCKS)
      const results = index.findAll('又東三百里')
      expect(results).toHaveLength(2)
      expect(results[0].verseIndex).toBe(2)
      expect(results[1].verseIndex).toBe(3)
    })

    it('returns empty for nonexistent text', () => {
      const index = new TextIndex(BLOCKS)
      expect(index.findAll('不存在的文字')).toHaveLength(0)
    })

    it('returns empty for empty quote', () => {
      const index = new TextIndex(BLOCKS)
      expect(index.findAll('')).toHaveLength(0)
    })

    it('finds overlapping matches', () => {
      const index = new TextIndex(makeBlocks('aaa'))
      const results = index.findAll('aa')
      // "aaa" contains "aa" at positions 0 and 1
      expect(results).toHaveLength(2)
    })
  })

  describe('resolveUnique', () => {
    it('resolves a unique quote to a position', () => {
      const index = new TextIndex(BLOCKS)
      const entry = index.resolveUnique('招揺之山')
      expect(entry.verseIndex).toBe(0)
      expect(entry.charStart).toBe(11)
    })

    it('throws TextQuoteNotFoundError for missing text', () => {
      const index = new TextIndex(BLOCKS)
      expect(() => index.resolveUnique('不存在')).toThrow(TextQuoteNotFoundError)
    })

    it('throws TextQuoteAmbiguousError for repeated text', () => {
      const index = new TextIndex(BLOCKS)
      expect(() => index.resolveUnique('又東三百里')).toThrow(TextQuoteAmbiguousError)
    })

    it('resolves ambiguous text with a verse hint', () => {
      const index = new TextIndex(BLOCKS)
      const entry = index.resolveUnique('又東三百里', 3)
      expect(entry.verseIndex).toBe(3)
      expect(entry.charStart).toBe(0)
    })

    it('throws if verse hint has no match', () => {
      const index = new TextIndex(BLOCKS)
      expect(() => index.resolveUnique('又東三百里', 0)).toThrow(TextQuoteNotFoundError)
    })
  })

  describe('accessors', () => {
    it('reports verse count', () => {
      const index = new TextIndex(BLOCKS)
      expect(index.verseCount).toBe(4)
    })

    it('reports verse length', () => {
      const index = new TextIndex(BLOCKS)
      expect(index.verseLength(0)).toBe(15)
      expect(index.verseLength(99)).toBe(0)
    })
  })
})
