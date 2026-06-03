<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { annotationToPronSegment } from '../utils/annotationParser'
import { kindLabel } from '../utils/annotationLabels'
import { toChineseNumber } from '../utils/chineseNumber'
import { useI18n } from '../composables/useI18n'
import { useWindowSize } from '../composables/useWindowSize'
import PronunciationGroup from './PronunciationGroup.vue'
import type { Annotation } from '../types'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  annotations: Annotation[]
  headword?: string
  layerLabels?: Record<string, string>
  style?: Record<string, string>
  vertical?: boolean
}>()

const emit = defineEmits<{
  close: []
  tooltipEnter: []
  tooltipLeave: []
}>()

const { width: ww } = useWindowSize()
const isMobile = computed(() => ww.value < 768)

const stickyVisible = ref(false)
const sheetRef = ref<HTMLElement | null>(null)
const dragStartX = ref(0)
const dragDeltaX = ref(0)
const isDragging = ref(false)

watch(() => props.visible, (v) => {
  if (v) stickyVisible.value = true
})

function dismiss() {
  stickyVisible.value = false
  emit('close')
}

function onSheetTouchStart(e: TouchEvent) {
  if (!props.vertical) return
  dragStartX.value = e.touches[0].clientX
  dragDeltaX.value = 0
  isDragging.value = true
}

function onSheetTouchMove(e: TouchEvent) {
  if (!isDragging.value || !props.vertical) return
  const dx = e.touches[0].clientX - dragStartX.value
  if (dx < 0) {
    dragDeltaX.value = dx
    if (sheetRef.value) {
      sheetRef.value.style.transform = `translateX(${dx}px)`
      sheetRef.value.style.transition = 'none'
    }
  }
}

function onSheetTouchEnd() {
  if (!isDragging.value || !props.vertical) return
  isDragging.value = false
  if (sheetRef.value) {
    sheetRef.value.style.transition = ''
    sheetRef.value.style.transform = ''
  }
  if (dragDeltaX.value < -80) {
    dismiss()
  }
  dragDeltaX.value = 0
}

function getSegment(ann: Annotation) {
  return annotationToPronSegment(ann)
}

function displayText(ann: Annotation): string {
  if (!ann.text) return ''
  if (!props.headword) return ann.text
  if (ann.text.startsWith(props.headword)) {
    const rest = ann.text.slice(props.headword.length)
    const m = rest.match(/^[，。、：；！？\s]+/)
    return m ? rest.slice(m[0].length) : rest
  }
  return ann.text
}

function layerLabel(ann: Annotation): string {
  if (!props.layerLabels || !ann.id) return ''
  for (const [prefix, label] of Object.entries(props.layerLabels)) {
    if (ann.id.startsWith(prefix)) return label
  }
  return ''
}

const dominantKind = computed(() => {
  if (!props.annotations.length) return ''
  const counts: Record<string, number> = {}
  for (const a of props.annotations) {
    counts[a.kind] = (counts[a.kind] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
})

function onDocClick(e: MouseEvent) {
  if (!stickyVisible.value) return
  const el = (e.target as HTMLElement)
  if (el.closest('.ann-card, .ann-sheet')) return
  if (el.closest('.ann-target')) return
  dismiss()
}

function onDocTouchMove(e: TouchEvent) {
  if (!stickyVisible.value || !isMobile.value) return
  const el = (e.target as HTMLElement)
  if (el.closest('.ann-sheet')) return
  dismiss()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && stickyVisible.value) {
    e.preventDefault()
    dismiss()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('touchmove', onDocTouchMove, { passive: true })
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('touchmove', onDocTouchMove)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <!-- Desktop/Tablet floating card -->
    <Transition name="ann-pop">
      <div
        v-if="!isMobile && stickyVisible && annotations.length"
        class="ann-card"
        :class="{ vertical }"
        :style="style"
        @mouseenter="emit('tooltipEnter')"
        @mouseleave="emit('tooltipLeave')"
      >
        <div class="ann-card-inner">
          <div class="ann-card-main">
            <div v-if="headword" class="ann-card-head" :class="dominantKind">
              <div class="ann-headword">{{ headword }}</div>
              <div class="ann-badge-count" v-if="annotations.length > 1">{{ t('annotation.noteCount', { count: toChineseNumber(annotations.length) }) }}</div>
            </div>
            <div class="ann-card-scroll">
              <div v-for="ann in annotations" :key="ann.id" class="ann-entry">
                <div class="ann-entry-header">
                  <span class="ann-kind ann-kind-badge" :class="ann.kind">{{ kindLabel(ann) }}</span>
                </div>
                <div class="ann-entry-body">
                  <span v-if="layerLabel(ann)" class="ann-layer">{{ layerLabel(ann) }}</span>
                  <div v-if="getSegment(ann)" class="ann-pron-h"><PronunciationGroup :segment="getSegment(ann)!" /></div>
                  <span v-if="ann.kind !== 'pronunciation' && displayText(ann)" class="ann-text">{{ displayText(ann) }}</span>
                </div>
              </div>
            </div>
          </div>
          <button class="ann-card-close" @click="dismiss" :aria-label="t('action.close')">
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Mobile bottom sheet -->
    <Transition name="ann-sheet">
      <div
        v-if="isMobile && stickyVisible && annotations.length"
        ref="sheetRef"
        class="ann-sheet"
        :class="{ vertical }"
      >
        <button v-if="!vertical" class="ann-sheet-handle" @click="dismiss" :aria-label="t('action.close')">
          <span class="ann-handle-bar" />
        </button>
        <div class="ann-sheet-body" :class="{ vertical }">
          <div v-if="headword" class="ann-sheet-head" :class="dominantKind">
            <div class="ann-headword">{{ headword }}</div>
            <div class="ann-badge-count" v-if="annotations.length > 1">{{ t('annotation.noteCount', { count: toChineseNumber(annotations.length) }) }}</div>
          </div>
          <div class="ann-sheet-scroll">
            <div v-for="ann in annotations" :key="ann.id" class="ann-entry">
              <div class="ann-entry-header">
                <span class="ann-kind ann-kind-badge" :class="ann.kind">{{ kindLabel(ann) }}</span>
              </div>
              <div class="ann-entry-body">
                <span v-if="layerLabel(ann)" class="ann-layer">{{ layerLabel(ann) }}</span>
                <div v-if="getSegment(ann)" class="ann-pron-h"><PronunciationGroup :segment="getSegment(ann)!" /></div>
                <span v-if="ann.kind !== 'pronunciation' && displayText(ann)" class="ann-text">{{ displayText(ann) }}</span>
              </div>
            </div>
          </div>
          <div v-if="headword" class="ann-sheet-v-head" :class="dominantKind">
            <span class="ann-sheet-v-word">{{ headword }}</span>
            <span v-if="annotations.length > 1" class="ann-badge-count-v">{{ t('annotation.noteCount', { count: toChineseNumber(annotations.length) }) }}</span>
          </div>
        </div>
        <div v-if="vertical" class="ann-sheet-drag-bar"
          @click="dismiss"
          @touchstart="onSheetTouchStart"
          @touchmove.prevent="onSheetTouchMove"
          @touchend="onSheetTouchEnd"
        >
          <span class="ann-drag-grip" />
          <span class="ann-drag-hint">{{ t('action.close') }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ─── Headword header ─── */
.ann-card-head,
.ann-sheet-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  background: var(--surface);
}

.ann-headword {
  font-family: var(--serif);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 4px;
  color: var(--ink);
}

.ann-badge-count {
  padding: 1px 7px;
  font-size: 10px;
  font-family: var(--sans);
  font-weight: 700;
  letter-spacing: 1px;
  line-height: 1.5;
  color: var(--vermillion);
}

/* ─── Annotation entry ─── */
.ann-entry {
  border-bottom: 1px solid var(--border-light);
  padding: 10px 0;
  font-size: 16px;
  color: var(--ink-mid);
  letter-spacing: 1.5px;
  line-height: 2;
}
.ann-entry:last-child { border-bottom: none; padding-bottom: 0; }
.ann-entry:first-child { padding-top: 0; }

.ann-entry-header {
  display: inline-flex;
  gap: 6px;
  margin-bottom: 3px;
}

.ann-entry-body {
  padding-left: 2px;
}

.ann-kind {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-family: var(--sans);
  font-weight: 700;
  letter-spacing: 1px;
  line-height: 1.5;
}

.ann-layer {
  font-size: 10px;
  font-family: var(--sans);
  color: var(--ink-faint);
  padding: 5px 2px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  letter-spacing: 0.5px;
}

.ann-text {
  white-space: pre-line;
  line-height: 2;
  padding-top: 5px;
}

/* ─── Floating card ─── */
.ann-card {
  position: fixed;
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 48px rgba(var(--shadow-rgb), 0.2), 0 2px 8px rgba(var(--shadow-rgb), 0.06);
  z-index: 1000;
  overflow: hidden;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  writing-mode: horizontal-tb;
}
.ann-card-inner {
  display: flex;
  flex-direction: column;
}
.ann-card-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.ann-card-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
  opacity: 0;
  z-index: 1;
}
.ann-card:hover .ann-card-close,
.ann-card-close:focus-visible {
  opacity: 0.5;
}
.ann-card-close:hover {
  opacity: 1 !important;
  background: var(--ink);
  color: var(--paper);
}

.ann-card-scroll {
  padding: 10px 14px;
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
}

/* Card transition */
.ann-pop-enter-active {
  transition: opacity 0.15s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-pop-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.ann-pop-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(4px);
}
.ann-pop-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* ─── Mobile bottom sheet ─── */
.ann-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 60vh;
  background: var(--surface-warm);
  border-top: 1px solid var(--border);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -4px 32px rgba(var(--shadow-rgb), 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  writing-mode: horizontal-tb;
}

.ann-sheet-handle {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}

.ann-handle-bar {
  display: block;
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
}

.ann-sheet-scroll {
  padding: 4px 16px max(24px, env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
}

/* Sheet transition */
.ann-sheet-enter-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-sheet-leave-active {
  transition: transform 0.2s ease;
}
.ann-sheet-enter-from,
.ann-sheet-leave-to {
  transform: translateY(100%);
}

/* ─── Active annotation on page ─── */
:global(.ann-target.ann-active) {
  background: color-mix(in srgb, var(--vermillion) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--vermillion) 15%, transparent);
  border-radius: 2px;
}
:global(.ann-target.ann-active.pronunciation) {
  background: color-mix(in srgb, var(--jade) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--jade) 15%, transparent);
}
:global(.ann-target.ann-active.person) {
  background: color-mix(in srgb, var(--ann-person) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ann-person) 15%, transparent);
}
:global(.ann-target.ann-active.place) {
  background: color-mix(in srgb, var(--ann-place) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ann-place) 15%, transparent);
}
:global(.ann-target.ann-active.event) {
  background: color-mix(in srgb, var(--ann-event) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ann-event) 15%, transparent);
}
:global(.ann-target.ann-active.date) {
  background: color-mix(in srgb, var(--ann-date) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ann-date) 15%, transparent);
}
:global(.ann-target.ann-active.allusion) {
  background: color-mix(in srgb, var(--ann-allusion) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ann-allusion) 15%, transparent);
}
:global(.ann-target.ann-active.etymology) {
  background: color-mix(in srgb, var(--ann-etymology) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ann-etymology) 15%, transparent);
}
:global(.ann-target.ann-active.commentary) {
  background: color-mix(in srgb, var(--ann-commentary) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ann-commentary) 15%, transparent);
}
:global(.ann-target.ann-active.translation) {
  background: color-mix(in srgb, var(--ann-translation) 12%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ann-translation) 15%, transparent);
}

@media (min-width: 768px) {
  .ann-sheet { display: none; }
}

/* ─── Mobile sheet vertical mode ─── */
.ann-sheet.vertical {
  left: 0;
  right: auto;
  bottom: auto;
  top: 0;
  width: 85vw;
  max-height: none;
  height: 100dvh;
  border-top: none;
  border-radius: 0;
  border-right: 1px solid var(--border);
  box-shadow: 4px 0 32px rgba(var(--shadow-rgb), 0.15);
  flex-direction: row;
}

.ann-sheet.vertical .ann-sheet-handle {
  display: none;
}

.ann-sheet-drag-bar {
  display: none;
}

.ann-sheet.vertical .ann-sheet-drag-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 100dvh;
  flex-shrink: 0;
  border-left: 1px solid var(--border-light);
  background: var(--surface);
  cursor: pointer;
  gap: 8px;
  writing-mode: horizontal-tb;
}

.ann-drag-grip {
  width: 4px;
  height: 40px;
  border-radius: 2px;
  background: var(--border);
}

.ann-drag-hint {
  writing-mode: vertical-rl;
  font-family: var(--sans);
  font-size: 10px;
  color: var(--ink-faint);
  letter-spacing: 3px;
}

.ann-sheet.vertical.ann-sheet-enter-from,
.ann-sheet.vertical.ann-sheet-leave-to {
  transform: translateX(-100%);
}

/* ─── Vertical mode ─── */
.ann-card.vertical .ann-card-inner {
  flex-direction: row-reverse;
}
.ann-card.vertical .ann-card-main {
  flex-direction: row-reverse;
}

.ann-card.vertical .ann-card-head {
  writing-mode: vertical-rl;
  text-orientation: upright;
  padding: 6px 8px;
  border-bottom: none;
  border-left: 1px solid var(--border-light);
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}
.ann-card.vertical .ann-card-head.commentary {
  border-right: none;
  border-left: 1px solid var(--border-light);
}
.ann-card.vertical .ann-badge-count {
  writing-mode: vertical-rl;
  margin-bottom: 5px;
}

.ann-card.vertical .ann-card-scroll {
  display: flex;
  flex-direction: row-reverse;
  padding: 8px 0;
  overflow-y: hidden;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  align-items: stretch;
}

.ann-card.vertical .ann-entry {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex-shrink: 0;
  padding: 0 6px;
  margin: 0;
  border-bottom: none;
  border-right: 1px solid var(--border-light);
}

.ann-card.vertical .ann-entry:first-child {
  padding: 0 6px;
  border-right: none;
}

.ann-card.vertical .ann-card-close {
  writing-mode: horizontal-tb;
  position: relative;
  top: auto;
  left: auto;
  align-self: flex-start;
  opacity: 0.5;
  margin: 4px;
  flex-shrink: 0;
}

.ann-card.vertical .ann-entry-header {
  gap: 4px;
  margin-bottom: 4px;
}

.ann-card.vertical .ann-entry-body {
  padding: 0;
}

.ann-card.vertical .ann-pron-h {
  writing-mode: vertical-lr;
}

.ann-card.vertical .ann-text {
  white-space: pre-line;
  line-height: 2.2;
  letter-spacing: 2px;
}

.ann-card.vertical .ann-entry:last-child {
  border-right: none;
}

.ann-sheet-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.ann-sheet-body.vertical {
  flex-direction: row;
  min-height: 100%;
  height: 100dvh;
}

.ann-sheet-body.vertical > .ann-sheet-head {
  display: none;
}

.ann-sheet-body:not(.vertical) > .ann-sheet-v-head {
  display: none;
}

.ann-sheet-v-head {
  writing-mode: vertical-rl;
  text-orientation: upright;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 12px 10px;
  border-left: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ann-sheet-v-word {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 6px;
  color: var(--ink);
}

.ann-badge-count-v {
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-faint);
  background: var(--surface-warm);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 2px 8px;
  letter-spacing: 0;
  writing-mode: horizontal-tb;
}

.ann-sheet-body.vertical .ann-sheet-scroll {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 12px 24px;
}

.ann-sheet-body.vertical .ann-pron-h {
  writing-mode: horizontal-tb;
}

.ann-sheet-body.vertical .ann-text {
  white-space: pre-line;
  line-height: 2.2;
  letter-spacing: 2px;
}

.ann-sheet-body.vertical .ann-entry {
  border-bottom: none;
  border-right: 1px solid var(--border-light);
  padding: 0 10px;
  display: flex;
  flex-direction: row;
}

.ann-sheet-body.vertical .ann-entry:last-child {
  border-right: none;
}
</style>
