import type { Annotation } from '../types'
import { useAnnotationTooltip } from './useAnnotationRenderer'

function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export function useAnnotationInteraction() {
  const tooltip = useAnnotationTooltip()
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let activeEl: HTMLElement | null = null

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  }

  function setActive(el: HTMLElement | null) {
    if (activeEl) activeEl.classList.remove('ann-active')
    activeEl = el
    if (activeEl) activeEl.classList.add('ann-active')
  }

  function scheduleHide(delay = 300) {
    cancelHide()
    hideTimer = setTimeout(() => { tooltip.hide(); setActive(null); hideTimer = null }, delay)
  }

  function onHover(event: MouseEvent, annotations: Annotation[]) {
    if (isMobile()) return
    cancelHide()
    const el = (event.target as HTMLElement).closest('.ann-target') as HTMLElement | null
    setActive(el)
    tooltip.show(event, annotations)
  }

  function onLeave() {
    if (!isMobile()) scheduleHide()
  }

  function onTap(event: MouseEvent, annotations: Annotation[]) {
    cancelHide()
    const el = (event.target as HTMLElement).closest('.ann-target') as HTMLElement | null
    setActive(el)
    tooltip.toggle(event, annotations)
  }

  function onTooltipEnter() {
    cancelHide()
  }

  function onTooltipLeave() {
    if (!isMobile()) scheduleHide()
  }

  function dismiss() {
    cancelHide()
    setActive(null)
    tooltip.hide()
  }

  return {
    visible: tooltip.visible,
    items: tooltip.items,
    headword: tooltip.headword,
    style: tooltip.style,
    onHover,
    onLeave,
    onTap,
    onTooltipEnter,
    onTooltipLeave,
    dismiss,
  }
}
