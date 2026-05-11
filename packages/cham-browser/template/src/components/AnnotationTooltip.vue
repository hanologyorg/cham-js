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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="ann-pane-scroll">
          <div v-for="ann in annotations" :key="ann.id" class="ann-entry" :class="ann.kind">
            <div class="ann-head">
              <span class="ann-kind" :class="ann.kind">{{ kindLabel(ann) }}</span>
              <span v-if="layerLabel(ann)" class="ann-layer">{{ layerLabel(ann) }}</span>
            </div>
            <PronunciationGroup v-if="getSegment(ann)" :segment="getSegment(ann)!" />
            <div v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-text">{{ ann.text }}</div>
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
        <div v-for="ann in annotations" :key="ann.id" class="ann-entry" :class="ann.kind">
          <div class="ann-head">
            <span class="ann-kind" :class="ann.kind">{{ kindLabel(ann) }}</span>
            <span v-if="layerLabel(ann)" class="ann-layer">{{ layerLabel(ann) }}</span>
          </div>
          <PronunciationGroup v-if="getSegment(ann)" :segment="getSegment(ann)!" />
          <div v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-text">{{ ann.text }}</div>
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
        <div class="ann-sheet-scroll">
          <div v-for="ann in annotations" :key="ann.id" class="ann-entry" :class="ann.kind">
            <div class="ann-head">
              <span class="ann-kind" :class="ann.kind">{{ kindLabel(ann) }}</span>
              <span v-if="layerLabel(ann)" class="ann-layer">{{ layerLabel(ann) }}</span>
            </div>
            <PronunciationGroup v-if="getSegment(ann)" :segment="getSegment(ann)!" />
            <div v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-text">{{ ann.text }}</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ─── Compact annotation entry ─── */
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

.ann-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  vertical-align: baseline;
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
  vertical-align: middle;
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
  line-height: 1.4;
}

.ann-text {
  white-space: pre-line;
  line-height: 1.8;
}

/* ─── Desktop Left Pane (horizontal mode) ─── */
.ann-left-pane {
  position: fixed;
  top: 72px;
  left: 20px;
  width: 280px;
  max-height: calc(100vh - 100px);
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(var(--shadow-rgb), 0.12);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.ann-pane-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 1;
  opacity: 0.6;
}
.ann-pane-close:hover {
  opacity: 1;
  background: var(--ink);
  color: var(--paper);
}

.ann-pane-scroll {
  padding: 12px 14px;
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
}

/* ─── Desktop Right Pane (vertical mode) ─── */
.ann-right-pane {
  position: fixed;
  top: 72px;
  right: 20px;
  height: calc(100vh - 100px);
  width: auto;
  max-width: 280px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(var(--shadow-rgb), 0.12);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}
.ann-right-pane .ann-pane-close {
  position: static;
  margin: 8px 8px 0;
  opacity: 0.5;
  flex-shrink: 0;
}
.ann-right-pane .ann-pane-scroll {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 12px 14px;
  flex: 1;
}
.ann-right-pane .ann-entry {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  border-bottom: none;
  border-left: 1px solid var(--border-light);
  padding: 0 0 0 12px;
  margin-left: 8px;
}
.ann-right-pane .ann-entry:first-child { padding-top: 0; }
.ann-right-pane .ann-entry:last-child { border-left: none; }
.ann-right-pane .ann-head {
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 0;
  margin-left: 4px;
}
.ann-right-pane .ann-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  line-height: 2;
}

/* ─── Tablet Popup ─── */
.ann-popup {
  position: fixed;
  padding: 12px 14px;
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(var(--shadow-rgb), 0.16);
  max-width: 300px;
  max-height: 50vh;
  overflow-y: auto;
  z-index: 1000;
}

/* ─── Mobile Bottom Sheet ─── */
.ann-bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 50vh;
  background: var(--surface-warm);
  border-top: 1px solid var(--border);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -4px 32px rgba(var(--shadow-rgb), 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
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

/* ─── Transitions ─── */

.ann-slide-right-enter-active {
  transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-slide-right-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ann-slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.ann-slide-right-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.ann-slide-left-enter-active {
  transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-slide-left-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ann-slide-left-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.ann-slide-left-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

.ann-fade-enter-active {
  transition: opacity 0.15s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ann-fade-enter-from {
  opacity: 0;
  transform: scale(0.94) translateY(4px);
}
.ann-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

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
