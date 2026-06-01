import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import type { BookMeta, Piece, Author } from '../types'

// ─── Helpers ──────────────────────────────────────────────────

function cleanHardWraps(text: string): string {
  return text
    .split('\n\n')
    .map(seg => seg.replace(/\n/g, ''))
    .join('\n\n')
}

function cleanPiece(piece: Piece): Piece {
  const sections: Record<string, string> = {}
  for (const [key, val] of Object.entries(piece.sections)) {
    sections[key] = cleanHardWraps(val)
  }
  return { ...piece, sections }
}

// ─── Book Cache (module-level singleton) ──────────────────────

const bookCache = new Map<string, { meta: BookMeta; pieces: Piece[] }>()

async function fetchBook(bookId: string): Promise<{ meta: BookMeta; pieces: Piece[] }> {
  if (bookCache.has(bookId)) return bookCache.get(bookId)!

  let data: { meta: BookMeta; pieces: Piece[] }

  if (import.meta.env.SSR) {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const base = process.env.CHAM_DATA_DIR || join('public', 'data')
    data = JSON.parse(readFileSync(join(base, 'books', `${bookId}.json`), 'utf-8'))
  } else {
    const res = await fetch(`/data/books/${bookId}.json`)
    data = await res.json()
  }

  if (import.meta.env.SSR && bookId === 'laozi-boshu') {
    const p81 = data.pieces.find(p => p.num === 81)
    const hsg9 = p81?.annotationLayers?.find(l => l.id === 'heshanggong')?.annotations[8]
    if (hsg9) console.log('[DEBUG-FETCH] laozi-boshu p81 hsg9 range FRESH from JSON:', JSON.stringify(hsg9.range))
  }

  data.pieces = data.pieces.map(cleanPiece)
  bookCache.set(bookId, data)
  return data
}

// ─── Composable ───────────────────────────────────────────────

export function useBook(): {
  bookId: Ref<string>
  pieces: ShallowRef<Piece[]>
  meta: Ref<BookMeta | null>
  loaded: ComputedRef<boolean>
  load: (id: string) => Promise<void>
  getPiece: (num: number) => Piece | undefined
  getPiecesByAuthor: (name: string) => Piece[]
  getAdjacentNums: (num: number) => { prev: number | null; next: number | null }
} {
  const bookId = ref('')
  const pieces = shallowRef<Piece[]>([])
  const meta = ref<BookMeta | null>(null)
  const loaded = computed(() => meta.value !== null)

  // Index maps (rebuilt on load)
  let byNum = new Map<number, Piece>()
  let loadVersion = 0

  async function load(id: string): Promise<void> {
    const myVersion = ++loadVersion
    bookId.value = id
    const data = await fetchBook(id)
    if (loadVersion !== myVersion) return

    pieces.value = data.pieces
    meta.value = data.meta

    byNum = new Map()
    for (const p of data.pieces) byNum.set(p.num, p)
    if (import.meta.env.SSR && id === 'laozi-boshu') {
      const p81 = byNum.get(81)
      const hsg9 = p81?.annotationLayers?.find(l => l.id === 'heshanggong')?.annotations[8]
      if (hsg9) console.log('[DEBUG-LOAD] laozi-boshu p81 hsg9 range AFTER load:', JSON.stringify(hsg9.range))
    }
  }

  function getPiece(num: number): Piece | undefined {
    return byNum.get(num)
  }

  function getPiecesByAuthor(name: string): Piece[] {
    return pieces.value.filter(p => p.author === name)
  }

  const sortedNums = computed(() => pieces.value.map(p => p.num).sort((a, b) => a - b))

  function getAdjacentNums(num: number): { prev: number | null; next: number | null } {
    const nums = sortedNums.value
    const idx = nums.indexOf(num)
    return {
      prev: idx > 0 ? nums[idx - 1] : null,
      next: idx < nums.length - 1 ? nums[idx + 1] : null,
    }
  }

  return { bookId, pieces, meta, loaded, load, getPiece, getPiecesByAuthor, getAdjacentNums }
}
