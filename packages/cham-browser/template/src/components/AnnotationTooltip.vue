<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { annotationToPronSegment } from '../utils/annotationParser'
import PronunciationGroup from './PronunciationGroup.vue'
import type { Annotation } from '../types'

type DisplayMode = 'pane' | 'popup' | 'sheet'

const props = defineProps<{
  visible: boolean
  annotations: Annotation[]
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

function onResize() { ww.value = window.innerWidth }

const mode = computed<DisplayMode>(() => {
  const w = ww.value
  if (w < 768) return 'sheet'
  if (w >= 1024) return 'pane'
  return 'popup'
})

const stickyVisible = ref(false)

watch(() => props.visible, (v) => {
  if (v) stickyVisible.value = true
  else if (mode.value === 'popup') stickyVisible.value = false
})

watch(mode, () => {
  if (mode.value === 'popup' && !props.visible) stickyVisible.value = false
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
    commentary: '評註',
    translation: '譯文',
    person: '人名',
    place: '地名',
    event: '事件',
    date: '紀年',
    allusion: '典故',
  }
  return map[ann.kind] || ann.kind
}

const hasOverlap = computed(() =>
  props.annotations.some(a => {
    const seg = annotationToPronSegment(a)
    return !seg && props.annotations.filter(b =>
      b.range.scope === a.range.scope &&
      b.range.verseIndex === a.range.verseIndex &&
      (b.range.start ?? 0) !== (a.range.start ?? 0) ||
      (b.range.end ?? 0) !== (a.range.end ?? 0)
    ).length > 0
  })
)

function onDocClick(e: MouseEvent) {
  if (!stickyVisible.value) return
  const el = (e.target as HTMLElement)
  if (el.closest('.ann-left-pane, .ann-right-pane, .ann-bottom-sheet, .ann-popup')) return
  if (el.closest('.ann-target')) return
  dismiss()
}

function onDocTouchMove(e: TouchEvent) {
  if (!stickyVisible.value || ww.value >= 768) return
  const el = (e.target as HTMLElement)
  if (el.closest('.ann-bottom-sheet')) return
  dismiss()
}

onMounted(() => {
  window.addEventListener('resize', onResize, { passive: true })
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('touchmove', onDocTouchMove, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('touchmove', onDocTouchMove)
})
</script>

<template>
  <Teleport to="body">
    <!-- Desktop pane: LEFT for horizontal, RIGHT for vertical -->
    <Transition :name="vertical ? 'ann-slide-left' : 'ann-slide-right'">
      <div
        v-if="mode === 'pane' && stickyVisible && annotations.length"
        :class="vertical ? 'ann-right-pane' : 'ann-left-pane'"
        @mouseenter="emit('tooltipEnter')"
        @mouseleave="emit('tooltipLeave')"
      >
        <button class="ann-pane-close" @click="dismiss" aria-label="關閉">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="ann-pane-inner">
          <div v-for="ann in annotations" :key="ann.id" class="ann-detail" :class="ann.kind">
            <div class="ann-detail-head">
              <span class="ann-kind-tag" :class="ann.kind">{{ kindLabel(ann) }}</span>
              <span v-if="layerLabel(ann)" class="ann-layer-tag">{{ layerLabel(ann) }}</span>
            </div>
            <div class="ann-detail-body">
              <PronunciationGroup v-if="getSegment(ann)" :segment="getSegment(ann)!" class="ann-pron-block" />
              <div v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-text-block">{{ ann.text }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Tablet popup -->
    <Transition name="ann-fade">
      <div
        v-if="mode === 'popup' && visible && annotations.length"
        class="ann-popup"
        :class="{ 'ann-popup--vertical': vertical }"
        :style="style"
        @mouseenter="emit('tooltipEnter')"
        @mouseleave="emit('tooltipLeave')"
      >
        <div v-for="ann in annotations" :key="ann.id" class="ann-detail" :class="ann.kind">
          <div class="ann-detail-head">
            <span class="ann-kind-tag" :class="ann.kind">{{ kindLabel(ann) }}</span>
            <span v-if="layerLabel(ann)" class="ann-layer-tag">{{ layerLabel(ann) }}</span>
          </div>
          <PronunciationGroup v-if="getSegment(ann)" :segment="getSegment(ann)!" />
          <span v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-text-block">{{ ann.text }}</span>
        </div>
      </div>
    </Transition>

    <!-- Mobile bottom sheet -->
    <Transition name="ann-sheet">
      <div
        v-if="mode === 'sheet' && stickyVisible && annotations.length"
        class="ann-bottom-sheet"
      >
        <button class="ann-sheet-handle" @click="dismiss">
          <span class="ann-handle-bar" />
        </button>
        <div class="ann-sheet-inner">
          <div v-for="ann in annotations" :key="ann.id" class="ann-detail" :class="ann.kind">
            <div class="ann-detail-head">
              <span class="ann-kind-tag" :class="ann.kind">{{ kindLabel(ann) }}</span>
              <span v-if="layerLabel(ann)" class="ann-layer-tag">{{ layerLabel(ann) }}</span>
            </div>
            <div class="ann-detail-body">
              <PronunciationGroup v-if="getSegment(ann)" :segment="getSegment(ann)!" class="ann-pron-block" />
              <div v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-text-block">{{ ann.text }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ─── Shared Entry Styles ─── */
.ann-detail {
  margin-bottom: 16px;
  letter-spacing: 1px;
  font-size: 15px;
  color: var(--ink-mid);
}
.ann-detail:last-child { margin-bottom: 0; }

.ann-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ann-kind-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-family: var(--sans);
  font-weight: 700;
  letter-spacing: 1px;
}
.ann-kind-tag.pronunciation { background: var(--jade); color: #fff; }
.ann-kind-tag.semantic { background: var(--vermillion); color: #fff; }
.ann-kind-tag.etymology { background: #6b5b95; color: #fff; }
.ann-kind-tag.note,
.ann-kind-tag.definition { background: var(--ink); color: var(--paper); }
.ann-kind-tag.commentary { background: #c0392b; color: #fff; }
.ann-kind-tag.translation { background: #2c6e49; color: #fff; }
.ann-kind-tag.person { background: var(--ann-person); color: #fff; }
.ann-kind-tag.place { background: var(--ann-place); color: #fff; }
.ann-kind-tag.event { background: var(--ann-event); color: #fff; }
.ann-kind-tag.date { background: var(--ann-date); color: #fff; }
.ann-kind-tag.allusion { background: var(--ann-allusion); color: #fff; }

.ann-layer-tag {
  font-size: 11px;
  font-family: var(--sans);
  color: var(--ink-faint);
  padding: 2px 6px;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  letter-spacing: 1px;
}

.ann-detail-body {
  padding-left: 4px;
}

.ann-pron-block {
  margin-bottom: 6px;
}

.ann-text-block {
  line-height: 1.9;
  white-space: pre-line;
}

/* ─── Desktop Left Pane (horizontal mode) ─── */
.ann-left-pane {
  position: fixed;
  top: 72px;
  left: 20px;
  width: 300px;
  max-height: calc(100vh - 100px);
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(var(--shadow-rgb), 0.12);
  z-index: 1000;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ─── Desktop Right Pane (vertical mode) ─── */
.ann-right-pane {
  position: fixed;
  top: 72px;
  right: 20px;
  width: 300px;
  max-height: calc(100vh - 100px);
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(var(--shadow-rgb), 0.12);
  z-index: 1000;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ann-pane-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 1;
}
.ann-pane-close:hover {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.ann-pane-inner {
  padding: 16px;
  padding-top: 14px;
}

/* ─── Tablet Popup ─── */
.ann-popup {
  position: fixed;
  padding: 14px 18px;
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 16px 48px rgba(var(--shadow-rgb), 0.16);
  max-width: 320px;
  max-height: 60vh;
  overflow-y: auto;
  z-index: 1000;
}

/* ─── Mobile Bottom Sheet ─── */
.ann-bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 55vh;
  background: var(--surface-warm);
  border-top: 1px solid var(--border);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 32px rgba(var(--shadow-rgb), 0.15);
  z-index: 1000;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ann-sheet-handle {
  display: flex;
  justify-content: center;
  padding: 12px 0 6px;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
}

.ann-handle-bar {
  display: block;
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
}

.ann-sheet-inner {
  padding: 0 20px 28px;
}

/* ─── Transitions ─── */

/* Left pane slide from left (horizontal mode) */
.ann-slide-right-enter-active {
  transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-slide-right-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ann-slide-right-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}
.ann-slide-right-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

/* Right pane slide from right (vertical mode) */
.ann-slide-left-enter-active {
  transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-slide-left-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ann-slide-left-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.ann-slide-left-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

/* Popup fade */
.ann-fade-enter-active {
  transition: opacity 0.15s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ann-fade-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(4px);
}
.ann-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* Bottom sheet slide up */
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

@media (max-width: 1023px) {
  .ann-left-pane, .ann-right-pane { display: none; }
}

@media (min-width: 1024px) {
  .ann-bottom-sheet { display: none; }
}
</style>
