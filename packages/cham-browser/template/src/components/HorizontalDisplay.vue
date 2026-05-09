<script setup lang="ts">
import type { Annotation, VerseLine } from '../types'
import { buildVerseAnnotations, renderAnnotatedText, resolveHoveredAnnotations, countVerseSpans } from '../composables/useAnnotationRenderer'

const props = defineProps<{
  title: string
  author: string
  verses: VerseLine[]
  annotations: Annotation[]
}>()

const emit = defineEmits<{
  annotationHover: [event: MouseEvent, annotations: Annotation[]]
  annotationLeave: []
  annotationTap: [event: MouseEvent, annotations: Annotation[]]
}>()

function verseHtml(index: number): string {
  let offset = 0
  for (let i = 0; i < index; i++) offset += countVerseSpans(props.annotations, i)
  const spans = buildVerseAnnotations(props.annotations, index)
  return renderAnnotatedText(props.verses[index].text, spans, false, offset)
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
  <div class="h-display" @mouseover="onHover" @mouseleave="onLeave" @click="onTap">
    <div class="h-display-title">{{ title }}</div>
    <div class="h-display-author">{{ author }}</div>
    <div
      v-for="(_, i) in verses"
      :key="i"
      class="h-display-line"
      v-html="verseHtml(i)"
    />
  </div>
</template>

<style scoped>
.h-display {
  display: inline-block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 40px 56px;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
  text-align: center;
}
.h-display-title {
  font-size: 32px; font-weight: 900;
  color: var(--ink); letter-spacing: 6px;
  margin-bottom: 6px;
}
.h-display-author {
  font-size: 16px; color: var(--ink-light);
  margin-bottom: 24px; letter-spacing: 3px;
}
.h-display-line {
  font-size: var(--main-font-size, 24px); line-height: 2.6;
  letter-spacing: 4px; color: var(--ink);
}

:deep(.ann-target) {
  border-bottom: 2px solid var(--vermillion);
  cursor: help;
  transition: background 0.15s;
}
:deep(.ann-target:hover) {
  background: rgba(194, 58, 43, 0.08);
}
:deep(.ann-num) {
  font-size: 10px;
  color: var(--vermillion);
  font-family: var(--sans);
  font-weight: 600;
  vertical-align: super;
  margin-right: 1px;
  letter-spacing: 0;
}
:deep(.ann-target.pronunciation:hover) {
  background: rgba(58, 107, 94, 0.08);
}
:deep(.ann-target.pronunciation) {
  border-bottom-color: var(--jade);
}
</style>
