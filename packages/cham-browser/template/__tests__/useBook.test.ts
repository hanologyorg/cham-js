import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BookMeta, Piece } from '../src/types'

function makePiece(overrides: Partial<Piece> & { num: number }): Piece {
  return {
    bookId: 'test',
    title: 'Test Piece',
    author: 'Tester',
    authorId: 'tester',
    era: 'Tang',
    genre: 'poetry',
    verses: [{ text: '床前明月光' }],
    sections: {},
    annotations: [],
    ...overrides,
  }
}

function makeMeta(overrides: Partial<BookMeta> = {}): BookMeta {
  return {
    id: 'test',
    title: 'Test Book',
    genre: 'poetry',
    count: 2,
    ...overrides,
  }
}

describe('useBook', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('getPiece returns piece by num after load', async () => {
    const pieces = [
      makePiece({ num: 1, title: 'First' }),
      makePiece({ num: 2, title: 'Second' }),
    ]
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ json: () => Promise.resolve({ meta: makeMeta(), pieces }) })
    )
    vi.stubGlobal('import.meta', { env: { SSR: false } })

    const { useBook } = await import('../src/composables/useBook')
    const { load, getPiece, loaded } = useBook()
    expect(loaded.value).toBe(false)
    await load('test')
    expect(loaded.value).toBe(true)
    expect(getPiece(1)?.title).toBe('First')
    expect(getPiece(2)?.title).toBe('Second')
    expect(getPiece(3)).toBeUndefined()
  })

  it('getAdjacentNums returns prev and next', async () => {
    const pieces = [
      makePiece({ num: 1 }),
      makePiece({ num: 3 }),
      makePiece({ num: 7 }),
    ]
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ json: () => Promise.resolve({ meta: makeMeta(), pieces }) })
    )
    vi.stubGlobal('import.meta', { env: { SSR: false } })

    const { useBook } = await import('../src/composables/useBook')
    const { load, getAdjacentNums } = useBook()
    await load('test')

    expect(getAdjacentNums(1)).toEqual({ prev: null, next: 3 })
    expect(getAdjacentNums(3)).toEqual({ prev: 1, next: 7 })
    expect(getAdjacentNums(7)).toEqual({ prev: 3, next: null })
  })

  it('getPiecesByAuthor filters by author name', async () => {
    const pieces = [
      makePiece({ num: 1, author: '李白' }),
      makePiece({ num: 2, author: '杜甫' }),
      makePiece({ num: 3, author: '李白' }),
    ]
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ json: () => Promise.resolve({ meta: makeMeta(), pieces }) })
    )
    vi.stubGlobal('import.meta', { env: { SSR: false } })

    const { useBook } = await import('../src/composables/useBook')
    const { load, getPiecesByAuthor } = useBook()
    await load('test')

    const byLi = getPiecesByAuthor('李白')
    expect(byLi).toHaveLength(2)
    expect(byLi.every(p => p.author === '李白')).toBe(true)
  })

  it('cleans hard wraps in piece sections', async () => {
    const pieces = [
      makePiece({
        num: 1,
        sections: { body: '第一行\n第二行\n\n第三段\n第四段' },
      }),
    ]
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ json: () => Promise.resolve({ meta: makeMeta(), pieces }) })
    )
    vi.stubGlobal('import.meta', { env: { SSR: false } })

    const { useBook } = await import('../src/composables/useBook')
    const { load, getPiece } = useBook()
    await load('test')

    const p = getPiece(1)!
    // Single newlines within paragraphs should be removed, double newlines preserved
    expect(p.sections.body).toBe('第一行第二行\n\n第三段第四段')
  })
})
