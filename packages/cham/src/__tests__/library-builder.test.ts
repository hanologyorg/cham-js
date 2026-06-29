import { describe, it, expect } from 'vitest'
import { LibraryBuilder } from '../pipeline/library-builder.js'
import { parseBookConfig } from '../book-config-loader.js'
import type { BookSources, PieceSources } from '../types.js'

// ─── LibraryBuilder ────────────────────────────────────────────
// Tests exercise the multi-book orchestrator with in-memory BookSources.
// No fs — the interface is the test surface.

const CONFIG_A = parseBookConfig({ id: 'book-a', title: 'Book A', genre: 'poetry' }, 'a')
const CONFIG_B = parseBookConfig({ id: 'book-b', title: 'Book B', genre: 'poetry' }, 'b')

function piece(num: number, title: string): PieceSources {
  return {
    chamSource: [
      '---',
      `id: ${num}`,
      `title: ${title}`,
      '---',
      '',
      '{1}Text{/1}',
      '',
      '## 注釋',
      '',
      '{1} meaning [gloss]',
    ].join('\n'),
  }
}

const BOOK_A: BookSources = { config: CONFIG_A, pieces: [piece(1, '靜夜思'), piece(2, '春曉')] }
const BOOK_B: BookSources = { config: CONFIG_B, pieces: [piece(1, '觀滄海')] }

describe('LibraryBuilder', () => {
  describe('buildFromBooks', () => {
    it('builds a library from a single book', () => {
      const data = new LibraryBuilder().buildFromBooks([BOOK_A])
      expect(data.books).toHaveLength(1)
      expect(data.books[0].meta.id).toBe('book-a')
      expect(data.books[0].pieces).toHaveLength(2)
      expect(data.allPieces).toHaveLength(2)
    })

    it('aggregates pieces across multiple books', () => {
      const data = new LibraryBuilder().buildFromBooks([BOOK_A, BOOK_B])
      expect(data.books).toHaveLength(2)
      expect(data.allPieces).toHaveLength(3)
      expect(data.allPieces.map(p => p.bookId)).toEqual(['book-a', 'book-a', 'book-b'])
    })

    it('composes a LibraryIndex with the correct scale', () => {
      const data = new LibraryBuilder().buildFromBooks([BOOK_A, BOOK_B])
      expect(data.library.scale).toBe('library')
      expect(data.library.books.map(b => b.id)).toEqual(['book-a', 'book-b'])
    })

    it('detects single-book scale for one book with multiple pieces', () => {
      const data = new LibraryBuilder().buildFromBooks([BOOK_A])
      expect(data.library.scale).toBe('single-book')
    })

    it('detects single-piece scale for one book with one piece', () => {
      const data = new LibraryBuilder().buildFromBooks([
        { config: CONFIG_A, pieces: [piece(1, 'One')] },
      ])
      expect(data.library.scale).toBe('single-piece')
    })

    it('returns empty library data for no books', () => {
      const data = new LibraryBuilder().buildFromBooks([])
      expect(data.books).toEqual([])
      expect(data.allPieces).toEqual([])
      expect(data.library.scale).toBe('single-piece')
    })

    it('is pure — calling twice produces equal but distinct objects', () => {
      const builder = new LibraryBuilder()
      const a = builder.buildFromBooks([BOOK_A])
      const b = builder.buildFromBooks([BOOK_A])
      expect(a).not.toBe(b)
      expect(a.books[0]).not.toBe(b.books[0])
      expect(a.allPieces[0].title).toBe(b.allPieces[0].title)
    })

    it('threads authors through to piece construction', () => {
      const data = new LibraryBuilder(
        { X001: { name: '李白', dynasty: '唐' } },
      ).buildFromBooks([
        {
          config: parseBookConfig({
            id: 'b', title: 'B',
            contributors: [{ ref: 'X001', role: 'author' }],
          }, 'b'),
          pieces: [piece(1, '靜夜思')],
        },
      ])
      expect(data.allPieces[0].author).toBe('李白')
      expect(data.allPieces[0].dynasty).toBe('唐')
    })
  })
})
