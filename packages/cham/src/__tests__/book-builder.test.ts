import { describe, it, expect } from 'vitest'
import { BookBuilder } from '../pipeline/book-builder.js'
import { parseBookConfig } from '../book-config-loader.js'
import type { PieceSources } from '../types.js'

// ─── BookBuilder ───────────────────────────────────────────────
// Tests exercise the deep orchestrator with in-memory PieceSources.
// No fs, no fixtures on disk — the interface is the test surface.

const BASE_CONFIG = parseBookConfig(
  {
    id: 'test-book',
    title: 'Test Book',
    genre: 'poetry',
    contributors: [{ ref: 'A001', role: 'author' }],
  },
  'test-book',
)

const ONE_PIECE: PieceSources = {
  chamSource: [
    '---',
    'id: 1',
    'title: 靜夜思',
    '---',
    '',
    '{1}床前明月光{/1}',
    '',
    '## 注釋',
    '',
    '{1} meaning [月光照在床前]',
  ].join('\n'),
  proseFiles: new Map(),
  layerFiles: new Map(),
}

describe('BookBuilder', () => {
  describe('buildFromSources', () => {
    it('builds a BookData from a single piece', () => {
      const book = new BookBuilder(BASE_CONFIG).buildFromSources([ONE_PIECE])
      expect(book.meta.id).toBe('test-book')
      expect(book.meta.title).toBe('Test Book')
      expect(book.meta.count).toBe(1)
      expect(book.pieces).toHaveLength(1)
      expect(book.pieces[0].title).toBe('靜夜思')
    })

    it('builds from multiple pieces', () => {
      const piece2: PieceSources = {
        ...ONE_PIECE,
        chamSource: ONE_PIECE.chamSource.replace('id: 1', 'id: 2').replace('靜夜思', '春曉'),
      }
      const book = new BookBuilder(BASE_CONFIG).buildFromSources([ONE_PIECE, piece2])
      expect(book.meta.count).toBe(2)
      expect(book.pieces.map(p => p.title)).toEqual(['靜夜思', '春曉'])
    })

    it('drops pieces that fail to parse as primary', () => {
      const secondary: PieceSources = {
        chamSource: [
          '---',
          'base: text.cham.md',
          'contributor: C020',
          'role: annotator',
          '---',
          '',
          '## 注釋',
          '',
          '@[床前] commentary [注]',
        ].join('\n'),
      }
      const book = new BookBuilder(BASE_CONFIG).buildFromSources([ONE_PIECE, secondary])
      expect(book.pieces).toHaveLength(1) // secondary dropped
    })

    it('returns empty pieces (but valid meta) for no sources', () => {
      const book = new BookBuilder(BASE_CONFIG).buildFromSources([])
      expect(book.meta.count).toBe(0)
      expect(book.pieces).toEqual([])
    })

    it('applies author record when supplied', () => {
      const book = new BookBuilder(
        BASE_CONFIG,
        { A001: { name: '李白', dynasty: '唐' } },
      ).buildFromSources([ONE_PIECE])
      expect(book.pieces[0].author).toBe('李白')
      expect(book.pieces[0].dynasty).toBe('唐')
    })

    it('is pure — calling twice produces equal but distinct objects', () => {
      const builder = new BookBuilder(BASE_CONFIG)
      const a = builder.buildFromSources([ONE_PIECE])
      const b = builder.buildFromSources([ONE_PIECE])
      expect(a).not.toBe(b)
      expect(a.pieces[0]).not.toBe(b.pieces[0])
      expect(a.pieces[0].title).toBe(b.pieces[0].title)
    })
  })
})

// ─── parseBookConfig (yaml-typer at the book.yaml boundary) ────

describe('parseBookConfig', () => {
  it('reads a minimal config', () => {
    const cfg = parseBookConfig({ id: 'b', title: 'Book' }, 'fallback')
    expect(cfg.id).toBe('b')
    expect(cfg.title).toBe('Book')
    expect(cfg.genre).toBeUndefined()
  })

  it('falls back to directory basename when id is missing', () => {
    const cfg = parseBookConfig({ title: 'Book' }, 'fallback-id')
    expect(cfg.id).toBe('fallback-id')
  })

  it('defaults title to empty string when missing', () => {
    const cfg = parseBookConfig({ id: 'b' }, 'fallback')
    expect(cfg.title).toBe('')
  })

  it('coerces string-array fields via pickStringArray', () => {
    const cfg = parseBookConfig(
      { id: 'b', title: 'B', hero: ['a', 'b'] },
      'fb',
    )
    expect(cfg.hero).toEqual(['a', 'b'])
  })

  it('returns undefined for hero when not an array', () => {
    const cfg = parseBookConfig(
      { id: 'b', title: 'B', hero: 'single-string' },
      'fb',
    )
    expect(cfg.hero).toBeUndefined()
  })

  it('returns undefined for nested date when not a record', () => {
    const cfg = parseBookConfig(
      { id: 'b', title: 'B', date: 'not-a-record' },
      'fb',
    )
    expect(cfg.date).toBeUndefined()
  })

  it('reads nested date record', () => {
    const cfg = parseBookConfig(
      { id: 'b', title: 'B', date: { dynasty: '唐' } },
      'fb',
    )
    expect(cfg.date).toEqual({ dynasty: '唐' })
  })
})
