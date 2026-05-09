<script setup lang="ts">
import type { Annotation, VerseLine } from '../types'
import { buildVerseAnnotations, renderAnnotatedText, resolveHoveredAnnotations, countVerseSpans } from '../composables/useAnnotationRenderer'

const props = defineProps<{
  title: string
  author: string
  verses: VerseLine[]
  authorInitial: string
  annotations: Annotation[]
}>()

const emit = defineEmits<{
  annotationHover: [event: MouseEvent, annotations: Annotation[]]
  annotationLeave: []
  annotationTap: [event: MouseEvent, annotations: Annotation[]]
  openAuthor: [name: string]
}>()

function verseHtml(index: number): string {
  let offset = 0
  for (let i = 0; i < index; i++) offset += countVerseSpans(props.annotations, i)
  const spans = buildVerseAnnotations(props.annotations, index)
  return renderAnnotatedText(props.verses[index].text, spans, true, offset)
}

function onHover(event: MouseEvent) {
  const matched = resolveHoveredAnnotations(event, props.annotations)
  if (matched) emit('annotationHover', event, matched)
}

function onLeave() {
  emit('annotationLeave')
}

function onTap(event: MouseEvent) {
  const matched = resolveHoveredAnnotations(event, props.annotations)
  if (matched) emit('annotationTap', event, matched)
}
</script>

<template>
  <div class="v-scroll" @mouseover="onHover" @mouseleave="onLeave" @click="onTap">
    <span class="v-scroll-title">{{ title }}</span>
    <span class="v-scroll-author v-scroll-clickable" @click="emit('openAuthor', author)">{{ author }}</span>
    <div class="v-scroll-body">
      <span
        v-for="(_, i) in verses"
        :key="i"
        class="v-scroll-line"
        v-html="verseHtml(i)"
      />
    </div>
  </div>
</template>

<style scoped>
.v-scroll {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  height: calc(100vh - 120px);
  overflow-x: auto; overflow-y: hidden;
  padding: 32px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: var(--gold) var(--paper);
}
.v-scroll::-webkit-scrollbar { height: 4px; }
.v-scroll::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.v-scroll-title {
  font-size: 36px; font-weight: 900; color: var(--ink);
  letter-spacing: 12px; margin-left: 24px;
  padding-left: 24px; border-left: 3px solid var(--vermillion);
  line-height: 1.6;
}
.v-scroll-author {
  font-size: 22px; font-weight: 400; color: var(--ink-light);
  margin-left: 16px; padding-left: 16px; letter-spacing: 6px;
}
.v-scroll-clickable { cursor: pointer; transition: color 0.15s; }
.v-scroll-clickable:hover { color: var(--vermillion); }
.v-scroll-body { margin-left: 28px; }
.v-scroll-line {
  font-size: var(--main-font-size, 24px); line-height: 2.4; letter-spacing: 8px;
  color: var(--ink); display: block;
}

:deep(.ann-target) {
  border-left: 2px solid var(--vermillion);
  padding-left: 2px;
  cursor: help;
  transition: background 0.15s;
}
:deep(.ann-num) {
  font-size: 0.45em;
  font-family: var(--sans);
  font-weight: 600;
  color: var(--vermillion);
  text-combine-upright: all;
  text-align: end;
  letter-spacing: 0;
}
:deep(.ann-target:hover) {
  background: rgba(194, 58, 43, 0.08);
}
:deep(.ann-target.pronunciation:hover) {
  background: rgba(58, 107, 94, 0.08);
}
:deep(.ann-target.pronunciation) {
  border-left-color: var(--jade);
}
:deep(.ann-target.pronunciation.semantic) {
  border-left-color: var(--gold);
}
</style>
