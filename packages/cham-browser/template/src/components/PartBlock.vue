<script setup lang="ts">
import type { Annotation, VerseLine, PieceSource } from '../types'
import { buildVerseAnnotations, renderAnnotatedText, resolveHoveredAnnotations, countVerseSpans } from '../composables/useAnnotationRenderer'

const props = defineProps<{
  num: number
  verses: VerseLine[]
  annotations: Annotation[]
  vertical?: boolean
  source?: PieceSource
  annotationText?: string
}>()

const emit = defineEmits<{
  annotationHover: [event: MouseEvent, annotations: Annotation[]]
  annotationLeave: []
  annotationTap: [event: MouseEvent, annotations: Annotation[]]
}>()

function verseHtml(index: number): string {
  const useRuby = props.vertical
  let offset = 0
  for (let i = 0; i < index; i++) offset += countVerseSpans(props.annotations, i)
  const spans = buildVerseAnnotations(props.annotations, index)
  return renderAnnotatedText(props.verses[index].text, spans, useRuby, offset)
}

function onHover(event: MouseEvent) {
  const matched = resolveHoveredAnnotations(event, props.annotations)
  if (matched) emit('annotationHover', event, matched)
}

function onLeave() { emit('annotationLeave') }

function onTap(event: MouseEvent) {
  const matched = resolveHoveredAnnotations(event, props.annotations)
  if (matched) emit('annotationTap', event, matched)
}

const sourceLabel = (() => {
  const r = props.source?.range as Record<string, string> | undefined
  return r?.chapter || ''
})()
</script>

<template>
  <div class="part-block" :class="{ 'part-block--vertical': vertical }">
    <div v-if="sourceLabel" class="part-source">
      {{ sourceLabel }}
    </div>
    <div class="part-text" @mouseover="onHover" @mouseleave="onLeave" @click="onTap">
      <span
        v-for="(_, i) in verses"
        :key="i"
        :class="vertical ? 'part-line-v' : 'part-line-h'"
        v-html="verseHtml(i)"
      />
    </div>
    <div v-if="annotationText" class="part-annotations">
      <div v-for="line in annotationText.split('\n')" :key="line" class="part-ann-line">{{ line }}</div>
    </div>
  </div>
</template>

<style scoped>
.part-block {
  padding: 20px 0;
  border-bottom: 1px solid var(--border-light);
}

.part-block:last-child {
  border-bottom: none;
}

.part-block--vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.part-source {
  font-family: var(--sans);
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  background: var(--surface);
  display: inline-block;
  padding: 3px 10px;
  border-radius: 3px;
  margin-bottom: 12px;
  border: 1px solid var(--border-light);
}

.part-text {
  line-height: 1;
}

.part-annotations {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-light);
}

.part-ann-line {
  font-family: var(--sans);
  font-size: 14px;
  line-height: 2;
  color: var(--ink-mid);
  letter-spacing: 0.5px;
}

.part-line-h {
  font-size: var(--main-font-size, 22px);
  line-height: 2.4;
  letter-spacing: 3px;
  color: var(--ink);
  display: block;
}

.part-line-v {
  font-size: var(--main-font-size, 22px);
  line-height: 2.4;
  letter-spacing: 6px;
  color: var(--ink);
  display: block;
}

:deep(.ann-target) {
  border-bottom: 2px solid var(--vermillion);
  cursor: help;
  transition: background 0.15s;
}
:deep(.ann-target.ann-overlap) {
  border-bottom-width: 3px;
  border-bottom-style: double;
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

:deep(.ann-target.pronunciation) {
  border-bottom-color: var(--jade);
}

:deep(.ann-target.pronunciation:hover) {
  background: rgba(58, 107, 94, 0.08);
}

.part-block--vertical :deep(.ann-target) {
  border-bottom: none;
  border-left: 2px solid var(--vermillion);
  padding-left: 2px;
}
.part-block--vertical :deep(.ann-target.ann-overlap) {
  border-left-width: 3px;
  border-left-style: double;
  padding-left: 3px;
}

.part-block--vertical :deep(.ann-target.pronunciation) {
  border-left-color: var(--jade);
}

.part-block--vertical :deep(.ann-num) {
  font-size: 0.45em;
  text-combine-upright: all;
  text-align: end;
  letter-spacing: 0;
  vertical-align: baseline;
}

.part-block--vertical .part-source {
  margin-bottom: 0;
  margin-left: 8px;
}

.part-block--vertical .part-annotations {
  margin-top: 0;
  margin-left: 12px;
  padding-top: 0;
  padding-left: 12px;
  border-top: none;
  border-left: 1px dashed var(--border-light);
}
</style>
