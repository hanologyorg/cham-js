import { watch, type Ref, onBeforeUnmount } from 'vue'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function useFocusTrap(container: Ref<HTMLElement | null>, active: Ref<boolean>) {
  let saved: HTMLElement | null = null

  function getFocusable(): HTMLElement[] {
    if (!container.value) return []
    return [...container.value.querySelectorAll(FOCUSABLE)] as HTMLElement[]
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !container.value) return
    const els = getFocusable()
    if (!els.length) return

    const first = els[0]
    const last = els[els.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first || !container.value.contains(document.activeElement)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last || !container.value.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  watch(active, (on) => {
    if (import.meta.env.SSR) return
    if (on) {
      saved = document.activeElement as HTMLElement
      document.addEventListener('keydown', onKeydown, true)
      requestAnimationFrame(() => {
        const els = getFocusable()
        if (els.length) els[0].focus()
      })
    } else {
      document.removeEventListener('keydown', onKeydown, true)
      if (saved && typeof saved.focus === 'function') {
        saved.focus()
        saved = null
      }
    }
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown, true)
  })
}
