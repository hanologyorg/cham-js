import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { LibraryIndex, LibraryScale, BookMeta } from '../types'

const library: Ref<LibraryIndex | null> = ref(null)
const loaded = ref(false)

async function loadLibrary(): Promise<void> {
  if (loaded.value) return

  if (import.meta.env.SSR) {
    const { readFileSync } = await import('fs')
    const { resolve, join } = await import('path')
    const base = process.env.CHAM_DATA_DIR || resolve('public/data')
    library.value = JSON.parse(readFileSync(join(base, 'library.json'), 'utf-8'))
  } else {
    const res = await fetch('/data/library.json')
    library.value = await res.json()
  }

  loaded.value = true
}

export function useLibrary(): {
  library: Ref<LibraryIndex | null>
  loaded: Ref<boolean>
  scale: ComputedRef<LibraryScale>
  books: ComputedRef<BookMeta[]>
  singleBook: ComputedRef<BookMeta | null>
  isSinglePiece: ComputedRef<boolean>
  loadLibrary: () => Promise<void>
} {
  const scale = computed<LibraryScale>(() => library.value?.scale ?? 'library')
  const books = computed<BookMeta[]>(() => library.value?.books ?? [])
  const singleBook = computed(() => books.value.length === 1 ? books.value[0] : null)
  const isSinglePiece = computed(() =>
    scale.value === 'single-piece'
  )

  return { library, loaded, scale, books, singleBook, isSinglePiece, loadLibrary }
}
