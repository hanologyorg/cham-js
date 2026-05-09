import { computed, ref, type Ref } from 'vue'
import { useReadingMode } from './useReadingMode'
import { useHorizontalScroll } from './useHorizontalScroll'

export interface PageLayoutConfig {
  mode: 'vertical' | 'horizontal'
  navSide: 'top' | 'right'
  contentDirection: 'ltr' | 'rtl'
  isVertical: boolean
}

export function usePageLayout() {
  const { layout } = useReadingMode()
  const scrollRef = ref<HTMLElement | null>(null)
  const scroll = useHorizontalScroll(scrollRef)

  const config = computed<PageLayoutConfig>(() => ({
    mode: layout.value,
    navSide: layout.value === 'vertical' ? 'right' : 'top',
    contentDirection: layout.value === 'vertical' ? 'rtl' : 'ltr',
    isVertical: layout.value === 'vertical',
  }))

  return { config, scrollRef, ...scroll }
}
