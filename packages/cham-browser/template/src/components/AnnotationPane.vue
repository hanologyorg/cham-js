<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { annotationToPronSegment } from '../utils/annotationParser'
import { toChineseNumber } from '../utils/chineseNumber'
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

function getSegment(ann: Annotation) {
  return annotationToPronSegment(ann)
}

function headword(ann: Annotation): string {
  return props.headwords[ann.id] || ''
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

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="ann-pane">
      <div v-if="visible && annotations.length" class="ann-pane" :class="{ vertical }">
        <div class="ann-pane-header">
          <span class="ann-pane-title">注釋</span>
          <span class="ann-pane-count">{{ annotations.length }}</span>
          <button class="ann-pane-close" @click="emit('close')" aria-label="關閉">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div ref="bodyRef" class="ann-pane-body">
          <div
            v-for="(ann, idx) in annotations"
            :key="ann.id"
            :data-ann-id="ann.id"
            class="ann-pane-entry"
            :class="{ active: activeId === ann.id, [ann.kind]: true }"
            @click="emit('select', ann)"
          >
            <div class="ann-pane-entry-head">
              <span class="ann-pane-idx">{{ toChineseNumber(idx + 1) }}</span>
              <span v-if="headword(ann)" class="ann-pane-word">{{ headword(ann) }}</span>
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
    </Transition>
  </Teleport>
</template>

<style scoped>
.ann-pane {
  position: fixed;
  left: 0;
  top: 0;
  width: 320px;
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
.ann-pane-kind.etymology { background: #6b5b95; color: #fff; }
.ann-pane-kind.note,
.ann-pane-kind.definition { background: var(--ink); color: var(--paper); }
.ann-pane-kind.commentary { background: #c0392b; color: #fff; }
.ann-pane-kind.translation { background: #2c6e49; color: #fff; }
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

/* Transition */
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
  .ann-pane {
    width: 100%;
    height: auto;
    max-height: 55vh;
    top: auto;
    bottom: 0;
    left: 0;
    border-right: none;
    border-top: 1px solid var(--border);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -4px 24px rgba(var(--shadow-rgb), 0.08);
  }
  .ann-pane-enter-from,
  .ann-pane-leave-to {
    transform: translateY(100%);
  }
}

/* ─── Vertical mode ─── */
.ann-pane.vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  width: 220px;
}

.ann-pane.vertical .ann-pane-body {
  display: flex;
  flex-direction: row;
  overflow-y: auto;
  overflow-x: hidden;
}

.ann-pane.vertical .ann-pane-entry {
  padding: 10px 6px;
  border-bottom: none;
  border-right: 3px solid transparent;
}

.ann-pane.vertical .ann-pane-entry + .ann-pane-entry {
  border-top: 1px solid var(--border-light);
}

.ann-pane.vertical .ann-pane-entry.active {
  border-right-color: var(--vermillion);
}

.ann-pane.vertical .ann-pane-entry.active.pronunciation {
  border-right-color: var(--jade);
}

.ann-pane.vertical .ann-pane-entry-head {
  flex-direction: row;
  gap: 4px;
}

.ann-pane.vertical .ann-pane-text {
  line-height: 2;
  letter-spacing: 1px;
}

.ann-pane.vertical .ann-pane-header {
  flex-direction: row;
}

.ann-pane.vertical .ann-pane-close {
  writing-mode: horizontal-tb;
}
</style>
