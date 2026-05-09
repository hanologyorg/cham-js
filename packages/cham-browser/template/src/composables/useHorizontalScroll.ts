import { type Ref, onMounted, onBeforeUnmount, readonly, ref } from 'vue'

export function useHorizontalScroll(container: Ref<HTMLElement | null>) {
  const isScrolling = ref(false)
  let scrollTimer: ReturnType<typeof setTimeout> | null = null

  function isTrackpad(e: WheelEvent): boolean {
    // Trackpad produces smooth, small deltas; mouse wheel produces large, quantized deltas
    return e.deltaMode === 0 && (Math.abs(e.deltaY) < 12 && e.deltaY !== 0)
      || Math.abs(e.deltaX) > 0
  }

  function onWheel(e: WheelEvent) {
    const el = container.value
    if (!el) return

    if (isTrackpad(e)) return

    e.preventDefault()
    // Mouse wheel: swap scroll direction so scroll-up → right, scroll-down → left
    el.scrollLeft -= e.deltaY
  }

  function scrollToStart() {
    const el = container.value
    if (!el) return
    el.scrollLeft = 0
  }

  function scrollToEnd() {
    const el = container.value
    if (!el) return
    el.scrollLeft = el.scrollWidth - el.clientWidth
  }

  function onScroll() {
    isScrolling.value = true
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      isScrolling.value = false
    }, 150)
  }

  onMounted(() => {
    const el = container.value
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', onScroll, { passive: true })
  })

  onBeforeUnmount(() => {
    const el = container.value
    if (!el) return
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('scroll', onScroll)
    if (scrollTimer) clearTimeout(scrollTimer)
  })

  return { isScrolling: readonly(isScrolling), scrollToStart, scrollToEnd }
}
