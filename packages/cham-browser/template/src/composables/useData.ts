import { ref, shallowRef, computed } from 'vue'
import type { Author, Dynasty } from '../types'

interface AuthorIndexEntry {
  id: string
  name: string
  era: string
  eraCode?: string
  workCount: number
}

interface PieceIndexEntry {
  id: string
  t: string
  a: string
  ar: string
  e: string
  ec: string
  b: string
  g: string
  n: number
  v1: string
}

const authorIndex = shallowRef<AuthorIndexEntry[]>([])
const authorCache = new Map<string, Author>()
const dynasties = ref<Record<string, Dynasty>>({})
const pieceIndex = shallowRef<PieceIndexEntry[]>([])
const sharedLoaded = ref(false)
let sharedPromise: Promise<void> | null = null

async function loadShared(): Promise<void> {
  if (sharedLoaded.value) return
  if (sharedPromise) return sharedPromise
  sharedPromise = (async () => {
    try {
      if (import.meta.env.SSR) {
        const { readFileSync } = await import('fs')
        const { resolve, join } = await import('path')
        const base = process.env.CHAM_DATA_DIR || resolve('public/data')
        authorIndex.value = JSON.parse(readFileSync(join(base, 'authors', 'index.json'), 'utf-8'))
        for (const entry of authorIndex.value) {
          const f = join(base, 'authors', `${entry.id}.json`)
          try {
            authorCache.set(entry.id, JSON.parse(readFileSync(f, 'utf-8')))
          } catch { /* skip missing */ }
        }
        dynasties.value = JSON.parse(readFileSync(join(base, 'dynasties.json'), 'utf-8'))
        pieceIndex.value = JSON.parse(readFileSync(join(base, 'index.json'), 'utf-8'))
      } else {
        const [aRes, dRes, pRes] = await Promise.all([
          fetch('/data/authors/index.json'),
          fetch('/data/dynasties.json'),
          fetch('/data/index.json'),
        ])
        authorIndex.value = await aRes.json()
        dynasties.value = await dRes.json()
        pieceIndex.value = await pRes.json()
      }
      sharedLoaded.value = true
    } finally {
      sharedPromise = null
    }
  })()
  return sharedPromise
}

async function loadAuthorDetail(id: string): Promise<Author | undefined> {
  if (authorCache.has(id)) return authorCache.get(id)

  if (import.meta.env.SSR) return undefined

  try {
    const res = await fetch(`/data/authors/${id}.json`)
    if (!res.ok) return undefined
    const data: Author = await res.json()
    authorCache.set(id, data)
    return data
  } catch {
    return undefined
  }
}

const authorByName = computed(() => {
  const map = new Map<string, AuthorIndexEntry>()
  for (const a of authorIndex.value) {
    if (!map.has(a.name)) map.set(a.name, a)
  }
  return map
})

const pieceIndexById = computed(() => {
  const map = new Map<string, PieceIndexEntry>()
  for (const p of pieceIndex.value) {
    if (!map.has(p.id)) map.set(p.id, p)
  }
  return map
})

export function useData() {
  function getAuthorIndex(name: string): AuthorIndexEntry | undefined {
    return authorByName.value.get(name)
  }

  function getAuthor(name: string): Author | undefined {
    const entry = authorByName.value.get(name)
    if (!entry) return undefined
    return authorCache.get(entry.id)
  }

  function getPieceIndex(id: string): PieceIndexEntry | undefined {
    return pieceIndexById.value.get(id)
  }

  function getAuthorWorks(authorId: string): PieceIndexEntry[] {
    const author = authorCache.get(authorId)
    if (!author?.works?.length) return []
    return author.works
      .map(id => pieceIndexById.value.get(id))
      .filter((p): p is PieceIndexEntry => p != null)
  }

  return {
    authors: authorIndex,
    dynasties,
    loaded: sharedLoaded,
    loadShared,
    getAuthor,
    getAuthorIndex,
    loadAuthorDetail,
    getPieceIndex,
    getAuthorWorks,
  }
}
