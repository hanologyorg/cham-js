import { ref, computed, type Ref } from 'vue'
import { useData } from './useData'
import type { Piece, Author } from '../types'

export function useAuthorPane(piece: Ref<Piece | undefined>) {
  const { getAuthor, getAuthorIndex, loadAuthorDetail, loadShared } = useData()

  const authorPaneOpen = ref(false)
  const selectedAuthorId = ref('')

  const selectedAuthorName = computed(() => {
    if (!selectedAuthorId.value) return piece.value?.author || ''
    const c = piece.value?.contributors?.find(x => x.id === selectedAuthorId.value)
    return c?.name || piece.value?.author || ''
  })

  const selectedAuthorBio = computed(() => {
    const name = selectedAuthorName.value
    const a = getAuthor(name)
    return a?.bio || piece.value?.sections?.author_bio || ''
  })

  const selectedAuthorEra = computed(() => {
    const name = selectedAuthorName.value
    const a = getAuthor(name)
    return a?.era || getAuthorIndex(name)?.era || piece.value?.era || ''
  })

  const selectedAuthorWorkCount = computed(() => {
    const name = selectedAuthorName.value
    const a = getAuthor(name)
    return a?.workCount || getAuthorIndex(name)?.workCount || 0
  })

  const selectedAuthorData = computed<Author | undefined>(() => {
    const name = selectedAuthorName.value
    return getAuthor(name)
  })

  const authorLifespan = computed(() => {
    const a = selectedAuthorData.value
    if (!a?.born && !a?.died) return ''
    if (a.born && a.died) return `${a.born}–${a.died}`
    return a.born ? `${a.born}–` : `?–${a.died}`
  })

  function openAuthorPane(id?: string) {
    selectedAuthorId.value = id || piece.value?.authorId || ''
    authorPaneOpen.value = true
    loadAuthorDetail(selectedAuthorId.value)
  }

  function closeAuthorPane() {
    authorPaneOpen.value = false
    selectedAuthorId.value = ''
  }

  return {
    authorPaneOpen,
    selectedAuthorName,
    selectedAuthorBio,
    selectedAuthorEra,
    selectedAuthorWorkCount,
    selectedAuthorData,
    authorLifespan,
    openAuthorPane,
    closeAuthorPane,
    loadShared,
  }
}
