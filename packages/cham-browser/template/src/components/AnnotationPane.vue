<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { annotationToPronSegment } from '../utils/annotationParser'
import { kindLabel } from '../utils/annotationLabels'
import { toChineseNumber } from '../utils/chineseNumber'
import { useI18n } from '../composables/useI18n'
import PronunciationGroup from './PronunciationGroup.vue'
import type { Annotation } from '../types'

const props = defineProps<{
  visible: boolean
  annotations: Annotation[]
  headwords: Record<string, string>
  layerLabels?: Record<string, string>
  activeId: string
  vertical?: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [ann: Annotation]
}>()

const bodyRef = ref<HTMLElement | null>(null)

const { t } = useI18n()
const ww = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
function onResize() { ww.value = window.innerWidth }

// ─── Resize ───
const paneWidth = ref(320)
const MIN_W = 180
const MAX_W = 500
const RESIZE_KEY = 'ann-pane-width'

function initWidth() {
  try {
    const saved = localStorage.getItem(RESIZE_KEY)
    if (saved) {
      const w = parseInt(saved, 10)
      if (w >= MIN_W && w <= MAX_W) paneWidth.value = w
      return
    }
  } catch {}
  paneWidth.value = props.vertical ? (ww.value < 768 ? Math.round(ww.value * 0.65) : 240) : 320
}

let resizing = false
let resizeStartX = 0
let resizeStartW = 0
let hasMoved = false
let moveFn: ((e: MouseEvent | TouchEvent) => void) | null = null
let endFn: (() => void) | null = null

function onHandleStart(e: MouseEvent | TouchEvent) {
  resizing = true
  hasMoved = false
  resizeStartX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  resizeStartW = paneWidth.value

  moveFn = (ev: MouseEvent | TouchEvent) => {
    if (!resizing) return
    const x = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX
    const dx = x - resizeStartX
    if (Math.abs(dx) > 2) hasMoved = true
    paneWidth.value = Math.max(MIN_W, Math.min(MAX_W, resizeStartW + dx))
  }

  endFn = () => {
    resizing = false
    if (!hasMoved) {
      emit('close')
    } else {
      try { localStorage.setItem(RESIZE_KEY, String(paneWidth.value)) } catch {}
    }
    if (moveFn) {
      document.removeEventListener('mousemove', moveFn)
      document.removeEventListener('touchmove', moveFn)
    }
    if (endFn) {
      document.removeEventListener('mouseup', endFn)
      document.removeEventListener('touchend', endFn)
    }
    moveFn = null
    endFn = null
  }

  document.addEventListener('mousemove', moveFn)
  document.addEventListener('mouseup', endFn)
  document.addEventListener('touchmove', moveFn, { passive: false })
  document.addEventListener('touchend', endFn)
  e.preventDefault()
}

function getSegment(ann: Annotation) {
  return annotationToPronSegment(ann)
}

function headword(ann: Annotation): string {
  return props.headwords[ann.id] || ''
}

function layerLabel(ann: Annotation): string {
  if (!props.layerLabels || !ann.id) return ''
  for (const [prefix, label] of Object.entries(props.layerLabels)) {
    if (ann.id.startsWith(prefix)) return label
  }
  return ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    e.preventDefault()
    emit('close')
  }
}

watch(() => props.activeId, async (id) => {
  if (!id || !props.visible) return
  await nextTick()
  const el = bodyRef.value?.querySelector(`[data-ann-id="${id}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

onMounted(() => {
  initWidth()
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  if (moveFn) {
    document.removeEventListener('mousemove', moveFn)
    document.removeEventListener('touchmove', moveFn)
  }
  if (endFn) {
    document.removeEventListener('mouseup', endFn)
    document.removeEventListener('touchend', endFn)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="ann-dim">
      <div
        v-if="visible && annotations.length && vertical && isMobile"
        class="ann-pane-dim"
        @click="emit('close')"
      />
    </Transition>
    <Transition name="ann-pane">
      <div
        v-if="visible && annotations.length"
        class="ann-pane"
        :class="{ vertical }"
        :style="{ width: paneWidth + 'px' }"
      >
        <div class="ann-pane-header">
          <span class="ann-pane-title">{{ t('annotation.all') }}</span>
          <span class="ann-pane-count">{{ annotations.length }}</span>
          <button class="ann-pane-close" @click="emit('close')" :aria-label="t('action.close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div ref="bodyRef" class="ann-pane-body">
          <div
            v-for="(ann, idx) in annotations"
            :key="ann.id"
            :data-ann-id="ann.id"
            class="ann-pane-entry"
            :class="{ active: activeId === ann.id, [ann.kind]: true }"
            role="button"
            tabindex="0"
            @click="emit('select', ann)"
            @keydown.enter="emit('select', ann)"
          >
            <!-- Vertical: headword column on the right side -->
            <div v-if="vertical && headword(ann)" class="ann-pane-v-word">
              <span class="ann-pane-word-v">{{ headword(ann) }}</span>
              <span class="ann-pane-idx-v">{{ toChineseNumber(idx + 1) }}</span>
            </div>
            <div class="ann-pane-entry-main">
              <div class="ann-pane-entry-head">
                <span v-if="!vertical" class="ann-pane-idx">{{ toChineseNumber(idx + 1) }}</span>
                <span v-if="!vertical && headword(ann)" class="ann-pane-word">{{ headword(ann) }}</span>
                <span class="ann-pane-kind" :class="ann.kind">{{ kindLabel(ann) }}</span>
                <span v-if="layerLabel(ann)" class="ann-pane-layer">{{ layerLabel(ann) }}</span>
              </div>
              <div class="ann-pane-entry-body">
                <PronunciationGroup v-if="getSegment(ann)" :segment="getSegment(ann)!" />
                <div v-if="ann.text && ann.kind !== 'pronunciation'" class="ann-pane-text">{{ ann.text }}</div>
              </div>
            </div>
          </div>
        </div>
        <!-- Resize / close handle on right edge -->
        <div class="ann-pane-handle" @mousedown="onHandleStart" @touchstart.prevent="onHandleStart">
          <span class="ann-handle-grip" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ann-pane {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  background: var(--surface-warm);
  border-right: 1px solid var(--border);
  z-index: 300;
  display: flex;
  flex-direction: column;
  writing-mode: horizontal-tb;
  box-shadow: 4px 0 24px rgba(var(--shadow-rgb), 0.06);
}

.ann-pane-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  background: var(--surface);
  flex-shrink: 0;
}

.ann-pane-title {
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 4px;
  color: var(--ink);
}

.ann-pane-count {
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-faint);
  background: var(--surface-warm);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 2px 8px;
}

.ann-pane-close {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.ann-pane-close:hover {
  background: var(--ink);
  color: var(--paper);
}

.ann-pane-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 0;
}

.ann-pane-entry {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-light);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.ann-pane-entry:hover {
  background: var(--surface);
}

.ann-pane-entry.active {
  border-left-color: var(--vermillion);
  background: var(--surface);
}

.ann-pane-entry:focus-visible {
  outline: 2px solid var(--vermillion);
  outline-offset: -2px;
}

.ann-pane-entry.active.pronunciation {
  border-left-color: var(--jade);
}

.ann-pane-entry-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.ann-pane-idx {
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 700;
  color: var(--vermillion);
  flex-shrink: 0;
}

.ann-pane-entry.active.pronunciation .ann-pane-idx {
  color: var(--jade);
}

.ann-pane-word {
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 2px;
  color: var(--ink);
}

.ann-pane-kind {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-family: var(--sans);
  font-weight: 700;
  letter-spacing: 1px;
  line-height: 1.5;
}

.ann-pane-kind.pronunciation { background: var(--jade); color: #fff; }
.ann-pane-kind.semantic { background: var(--vermillion); color: #fff; }
.ann-pane-kind.etymology { background: var(--ann-etymology); color: #fff; }
.ann-pane-kind.note,
.ann-pane-kind.definition { background: var(--ink); color: var(--paper); }
.ann-pane-kind.commentary { background: var(--ann-commentary); color: #fff; }
.ann-pane-kind.translation { background: var(--ann-translation); color: #fff; }
.ann-pane-kind.person { background: var(--ann-person); color: #fff; }
.ann-pane-kind.place { background: var(--ann-place); color: #fff; }
.ann-pane-kind.event { background: var(--ann-event); color: #fff; }
.ann-pane-kind.date { background: var(--ann-date); color: #fff; }
.ann-pane-kind.allusion { background: var(--ann-allusion); color: #fff; }

.ann-pane-layer {
  font-size: 10px;
  font-family: var(--sans);
  color: var(--ink-faint);
  padding: 1px 5px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
}

.ann-pane-entry-body {
  padding-left: 2px;
}

.ann-pane-text {
  font-size: 14px;
  color: var(--ink-mid);
  line-height: 1.8;
  letter-spacing: 0.5px;
  white-space: pre-line;
}

/* ─── Resize / close handle ─── */
.ann-pane-handle {
  position: absolute;
  top: 0;
  right: -6px;
  width: 14px;
  height: 100%;
  cursor: col-resize;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ann-pane.vertical .ann-pane-handle {
  right: auto;
  left: -6px;
  cursor: col-resize;
}

.ann-handle-grip {
  display: block;
  width: 3px;
  height: 32px;
  border-radius: 2px;
  background: var(--border);
  transition: all 0.2s;
}

.ann-pane-handle:hover .ann-handle-grip {
  background: var(--vermillion);
  height: 48px;
}

/* ─── Backdrop dim (mobile vertical) ─── */
.ann-pane-dim {
  position: fixed;
  inset: 0;
  background: rgba(var(--shadow-rgb), 0.24);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 299;
}

.ann-dim-enter-active { transition: opacity 0.3s ease; }
.ann-dim-leave-active { transition: opacity 0.15s ease; }
.ann-dim-enter-from,
.ann-dim-leave-to { opacity: 0; }

/* ─── Transition ─── */
.ann-pane-enter-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ann-pane-leave-active {
  transition: transform 0.2s ease;
}
.ann-pane-enter-from,
.ann-pane-leave-to {
  transform: translateX(-100%);
}

@media (max-width: 768px) {
  .ann-pane:not(.vertical) {
    width: 100% !important;
    height: auto;
    max-height: 55vh;
    top: auto;
    bottom: 0;
    border-right: none;
    border-top: 1px solid var(--border);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -4px 24px rgba(var(--shadow-rgb), 0.08);
  }
  .ann-pane:not(.vertical) .ann-pane-handle {
    display: none;
  }
  .ann-pane:not(.vertical).ann-pane-enter-from,
  .ann-pane:not(.vertical).ann-pane-leave-to {
    transform: translateY(100%);
  }
}

/* ─── Vertical mode ─── */

.ann-pane.vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  border-right: none;
  border-left: 1px solid var(--border);
  box-shadow: -4px 0 24px rgba(var(--shadow-rgb), 0.06);
}

.ann-pane.vertical .ann-pane-header {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  border-bottom: none;
  border-left: 1px solid var(--border-light);
  padding: 16px 12px;
  flex-direction: row;
  align-items: center;
}

.ann-pane.vertical .ann-pane-body {
  overflow-y: hidden;
  overflow-x: auto;
  overscroll-behavior: contain;
  touch-action: pan-x;
  -webkit-overflow-scrolling: touch;
}

.ann-pane.vertical .ann-pane-entry {
  padding: 24px 12px;
  border-bottom: none;
  border-right: 1px solid var(--border-light);
  border-left: none;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0;
}

.ann-pane.vertical .ann-pane-entry:last-child {
  border-right: none;
}

.ann-pane.vertical .ann-pane-entry.active {
  border-left-color: transparent;
  border-right-color: var(--vermillion);
}

.ann-pane.vertical .ann-pane-entry.active.pronunciation {
  border-left-color: transparent;
  border-right-color: var(--jade);
}

.ann-pane.vertical .ann-pane-v-word {
  writing-mode: vertical-rl;
  text-orientation: upright;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border-left: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ann-pane.vertical .ann-pane-entry-main {
  padding: 0 8px;
}

.ann-pane.vertical .ann-pane-entry-head {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.ann-pane.vertical .ann-pane-entry-body {
  padding-left: 0;
}

.ann-pane.vertical .ann-pane-text {
  line-height: 2;
  letter-spacing: 1px;
}

.ann-pane.vertical .ann-pane-close {
  margin-left: 0;
  margin-top: 0;
  margin-bottom: 12px;
  order: -1;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}

.ann-pane.vertical .ann-pane-count,
.ann-pane.vertical .ann-pane-kind,
.ann-pane.vertical .ann-pane-layer {
  writing-mode: horizontal-tb;
}

.ann-pane.vertical .ann-pane-pron {
  writing-mode: horizontal-tb;
}

@media (max-width: 768px) {
  .ann-pane.vertical {
    width: auto !important;
    max-width: 65vw !important;
    min-width: 180px;
    height: 100vh !important;
    max-height: none !important;
    top: 0 !important;
    bottom: auto !important;
    border-left: 1px solid var(--border) !important;
    border-right: none !important;
    border-top: none !important;
    border-radius: 0 !important;
    box-shadow: -4px 0 24px rgba(var(--shadow-rgb), 0.06) !important;
    z-index: 300;
  }
  .ann-pane.vertical .ann-pane-handle {
    display: flex !important;
  }
  .ann-pane.vertical .ann-pane-close {
    width: 36px;
    height: 36px;
  }
  .ann-pane.vertical.ann-pane-enter-from,
  .ann-pane.vertical.ann-pane-leave-to {
    transform: translateX(-100%) !important;
  }
}
</style>
