<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { annotationToPronSegment } from '../utils/annotationParser'
import PronunciationGroup from './PronunciationGroup.vue'
import type { Annotation } from '../types'

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

const ww = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isMobile = computed(() => ww.value < 768)

function onResize() { ww.value = window.innerWidth }

const stickyVisible = ref(false)

watch(() => props.visible, (v) => {
  if (v) stickyVisible.value = true
})

function dismiss() {
  stickyVisible.value = false
  emit('close')
}

function getSegment(ann: Annotation) {
  return annotationToPronSegment(ann)
}

function layerLabel(ann: Annotation): string {
  if (!props.layerLabels || !ann.id) return ''
  for (const [prefix, label] of Object.entries(props.layerLabels)) {
    if (ann.id.startsWith(prefix)) return label
  }
  return ''
}

function kindLabel(ann: Annotation): string {
  const map: Record<string, string> = {
    pronunciation: '讀音',
    semantic: '釋義',
    etymology: '詞源',
    note: '備注',
    definition: '釋義',
    commentary: '注',
    translation: '譯文',
    person: '人名',
    place: '地名',
    event: '事件',
    date: '紀年',
    allusion: '典故',
  }
  return map[ann.kind] || ann.kind
}

function dominantKind(): string {
  if (!props.annotations.length) return ''
  const counts: Record<string, number> = {}
  for (const a of props.annotations) {
    counts[a.kind] = (counts[a.kind] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

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
  window.addEventListener('resize', onResize, { passive: true })
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('touchmove', onDocTouchMove, { passive: true })
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
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
        <div v-if="headword" class="ann-card-head" :class="dominantKind()">
          <span class="ann-headword">{{ headword }}</span>
          <span class="ann-badge-count" v-if="annotations.length > 1">{{ annotations.length }}</span>
        </div>
        <button class="ann-card-close" @click="dismiss" aria-label="關閉">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="ann-card-scroll">
          <div v-for="ann in annotations" :key="ann.id" class="ann-entry">
            <div class="ann-entry-header">
              <span class="ann-kind" :class="ann.kind">{{ kindLabel(ann) }}</span>
              <span v-if="layerLabel(ann)" class="ann-layer">{{ layerLabel(ann) }}</span>
            </div>
            <div class="ann-entry-body">
              <div v-if="getSegment(ann)" class="ann-pron-h"><PronunciationGroup :segment="getSegment(ann)!" /></div>
              <div v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-text">{{ ann.text }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Mobile bottom sheet -->
    <Transition name="ann-sheet">
      <div
        v-if="isMobile && stickyVisible && annotations.length"
        class="ann-sheet"
        :class="{ vertical }"
      >
        <button class="ann-sheet-handle" @click="dismiss">
          <span class="ann-handle-bar" />
        </button>
        <div class="ann-sheet-body" :class="{ vertical }">
          <div v-if="headword" class="ann-sheet-head" :class="dominantKind()">
            <span class="ann-headword">{{ headword }}</span>
            <span class="ann-badge-count" v-if="annotations.length > 1">{{ annotations.length }}</span>
          </div>
          <div class="ann-sheet-scroll">
            <div v-for="ann in annotations" :key="ann.id" class="ann-entry">
              <div class="ann-entry-header">
                <span class="ann-kind" :class="ann.kind">{{ kindLabel(ann) }}</span>
                <span v-if="layerLabel(ann)" class="ann-layer">{{ layerLabel(ann) }}</span>
              </div>
              <div class="ann-entry-body">
                <div v-if="getSegment(ann)" class="ann-pron-h"><PronunciationGroup :segment="getSegment(ann)!" /></div>
                <div v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-text">{{ ann.text }}</div>
              </div>
            </div>
          </div>
          <div v-if="headword" class="ann-sheet-v-head" :class="dominantKind()">
            <span class="ann-sheet-v-word">{{ headword }}</span>
            <span v-if="annotations.length > 1" class="ann-badge-count-v">{{ annotations.length }}</span>
          </div>
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
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  background: var(--surface);
}

.ann-headword {
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 4px;
  color: var(--ink);
}

.ann-badge-count {
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-faint);
  background: var(--surface-warm);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 2px 8px;
  letter-spacing: 0;
}

/* ─── Annotation entry ─── */
.ann-entry {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
  font-size: 14px;
  color: var(--ink-mid);
  letter-spacing: 0.5px;
  line-height: 1.8;
}
.ann-entry:last-child { border-bottom: none; padding-bottom: 0; }
.ann-entry:first-child { padding-top: 0; }

.ann-entry-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.ann-entry-body {
  padding-left: 2px;
}

.ann-kind {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 3px;
  font-size: 10px;
  font-family: var(--sans);
  font-weight: 700;
  letter-spacing: 1px;
  line-height: 1.5;
}
.ann-kind.pronunciation { background: var(--jade); color: #fff; }
.ann-kind.semantic { background: var(--vermillion); color: #fff; }
.ann-kind.etymology { background: #6b5b95; color: #fff; }
.ann-kind.note,
.ann-kind.definition { background: var(--ink); color: var(--paper); }
.ann-kind.commentary { background: #c0392b; color: #fff; }
.ann-kind.translation { background: #2c6e49; color: #fff; }
.ann-kind.person { background: var(--ann-person); color: #fff; }
.ann-kind.place { background: var(--ann-place); color: #fff; }
.ann-kind.event { background: var(--ann-event); color: #fff; }
.ann-kind.date { background: var(--ann-date); color: #fff; }
.ann-kind.allusion { background: var(--ann-allusion); color: #fff; }

.ann-layer {
  font-size: 10px;
  font-family: var(--sans);
  color: var(--ink-faint);
  padding: 1px 5px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  letter-spacing: 0.5px;
}

.ann-text {
  white-space: pre-line;
  line-height: 1.8;
}

/* ─── Floating card ─── */
.ann-card {
  position: fixed;
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 48px rgba(var(--shadow-rgb), 0.2), 0 2px 8px rgba(var(--shadow-rgb), 0.06);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  writing-mode: horizontal-tb;
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
  transition: all 0.15s;
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
  padding: 4px 16px 24px;
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
  background: rgba(194, 58, 43, 0.12) !important;
  box-shadow: 0 0 0 2px rgba(194, 58, 43, 0.15);
  border-radius: 2px;
}
:global(.ann-target.ann-active.pronunciation) {
  background: rgba(58, 107, 94, 0.12) !important;
  box-shadow: 0 0 0 2px rgba(58, 107, 94, 0.15);
}
:global(.ann-target.ann-active.person) {
  background: rgba(58, 90, 140, 0.12) !important;
  box-shadow: 0 0 0 2px rgba(58, 90, 140, 0.15);
}

@media (min-width: 768px) {
  .ann-sheet { display: none; }
}

/* ─── Vertical mode ─── */
.ann-card.vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-direction: column;
  overflow-y: hidden;
  overflow-x: hidden;
}

.ann-card.vertical .ann-card-head {
  writing-mode: horizontal-tb;
  padding: 10px 6px;
  border-bottom: none;
  border-left: 1px solid var(--border-light);
}

.ann-card.vertical .ann-card-scroll {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.ann-card.vertical .ann-entry {
  flex-shrink: 0;
  border-bottom: none;
  padding: 0 10px;
  border-right: 1px solid var(--border-light);
  max-height: inherit;
  overflow-y: hidden;
}

.ann-card.vertical .ann-entry:first-child {
  border-right: none;
}

.ann-card.vertical .ann-card-close {
  writing-mode: horizontal-tb;
  top: 4px;
  right: 4px;
}

.ann-card.vertical .ann-pron-h {
  writing-mode: horizontal-tb;
}

.ann-card.vertical .ann-entry-body {
  padding-left: 0;
}

.ann-card.vertical .ann-text {
  white-space: pre-line;
  line-height: 2;
}

.ann-sheet-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.ann-sheet-body.vertical {
  flex-direction: row-reverse;
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
  flex: 1;
  min-width: 0;
}

.ann-sheet-body.vertical .ann-pron-h {
  writing-mode: horizontal-tb;
}

.ann-sheet-body.vertical .ann-text {
  white-space: pre-line;
  line-height: 2;
}
</style>
