import { ref, shallowRef, computed } from 'vue'
import type { Author, Dynasty } from '../types'

const authors = shallowRef<Author[]>([])
const dynasties = ref<Record<string, Dynasty>>({})
const sharedLoaded = ref(false)

async function loadShared(): Promise<void> {
  if (sharedLoaded.value) return

  if (import.meta.env.SSR) {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const base = process.env.CHAM_DATA_DIR || resolve('public/data')
    authors.value = JSON.parse(readFileSync(`${base}/authors.json`, 'utf-8'))
    dynasties.value = JSON.parse(readFileSync(`${base}/dynasties.json`, 'utf-8'))
  } else {
    const [aRes, dRes] = await Promise.all([
      fetch('/data/authors.json'),
      fetch('/data/dynasties.json'),
    ])
    authors.value = await aRes.json()
    dynasties.value = await dRes.json()
  }

  sharedLoaded.value = true
}

const authorByName = computed(() => {
  const map = new Map<string, Author>()
  for (const a of authors.value) map.set(a.name, a)
  return map
})

export function useData() {
  function getAuthor(name: string): Author | undefined {
    return authorByName.value.get(name)
  }

  return { authors, dynasties, loaded: sharedLoaded, loadShared, getAuthor }
}
