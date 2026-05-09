import type { Annotation } from '../types'
import { useAnnotationTooltip } from './useAnnotationRenderer'

function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export function useAnnotationInteraction() {
  const tooltip = useAnnotationTooltip()
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  }

  function scheduleHide(delay = 300) {
    cancelHide()
    hideTimer = setTimeout(() => { tooltip.hide(); hideTimer = null }, delay)
  }

  function onHover(event: MouseEvent, annotations: Annotation[]) {
    if (isMobile()) return
    cancelHide()
    tooltip.show(event, annotations)
  }

  function onLeave() {
    if (!isMobile()) scheduleHide()
  }

  function onTap(event: MouseEvent, annotations: Annotation[]) {
    cancelHide()
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
    tooltip.hide()
  }

  return {
    visible: tooltip.visible,
    items: tooltip.items,
    style: tooltip.style,
    onHover,
    onLeave,
    onTap,
    onTooltipEnter,
    onTooltipLeave,
    dismiss,
  }
}
