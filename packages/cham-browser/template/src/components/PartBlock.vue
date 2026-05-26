<script setup lang="ts">
import { computed } from 'vue'
import type { Annotation, VerseLine, PieceSource } from '../types'
import { buildVerseAnnotations, renderAnnotatedText, resolveHoveredAnnotations } from '../composables/useAnnotationRenderer'
import { parseAnnotationBlock } from '../utils/annotationParser'
import PronunciationGroup from './PronunciationGroup.vue'

const props = defineProps<{
  num: number
  verses: VerseLine[]
  annotations: Annotation[]
  vertical?: boolean
  source?: PieceSource
  annotationText?: string
  annotationsVisible?: boolean
}>()

const emit = defineEmits<{
  annotationHover: [event: MouseEvent, annotations: Annotation[]]
  annotationLeave: []
  annotationTap: [event: MouseEvent, annotations: Annotation[]]
}>()

const allVerseSpans = computed(() =>
  props.verses.map((_, i) => buildVerseAnnotations(props.annotations, i))
)

const verseOffsets = computed(() => {
  const offsets: number[] = []
  let acc = 0
  for (const spans of allVerseSpans.value) {
    offsets.push(acc)
    acc += spans.length
  }
  return offsets
})

function verseHtml(index: number): string {
  const useRuby = props.vertical
  const spans = allVerseSpans.value[index]
  return renderAnnotatedText(props.verses[index].text, spans, useRuby, verseOffsets.value[index])
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

const annotationEntries = computed(() =>
  props.annotationText ? parseAnnotationBlock(props.annotationText) : []
)
</script>

<template>
  <div class="part-block" :class="{ 'part-block--vertical': vertical }">
    <div v-if="sourceLabel" class="part-header">
      <span class="part-header-num">{{ num }}</span>
      <h3>{{ sourceLabel }}</h3>
    </div>
    <div class="part-text" @mouseover="onHover" @mouseleave="onLeave" @click="onTap">
      <span
        v-for="(_, i) in verses"
        :key="i"
        :class="vertical ? 'part-line-v' : 'part-line-h'"
        v-html="verseHtml(i)"
      />
    </div>
    <div v-if="annotationsVisible !== false && annotationText && annotationEntries.length > 0" class="part-annotations">
      <div v-for="entry in annotationEntries" :key="entry.num" class="part-ann-entry">
        <div class="part-ann-head">
          <span class="part-ann-num">{{ entry.numDisplay }}</span>
          <span class="part-ann-term">{{ entry.term }}</span>
          <PronunciationGroup
            v-for="seg in entry.pronSegments"
            :key="seg.lang"
            :segment="seg"
            class="part-ann-pron"
          />
        </div>
        <div v-if="entry.definition" class="part-ann-def">{{ entry.definition }}</div>
      </div>
    </div>
    <div v-else-if="annotationsVisible !== false && annotationText" class="part-annotations">
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
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px dashed var(--border-light);
}

.part-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 20px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.part-header-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--vermillion); color: var(--paper);
  font-family: var(--sans); font-size: 13px; font-weight: 700;
  flex-shrink: 0;
}

.part-header h3 {
  font-size: 18px; font-weight: 700; letter-spacing: 3px; color: var(--ink);
}

.part-text {
  line-height: 1;
}

.part-annotations {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-light);
  text-align: left;
}

.part-ann-entry {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
}
.part-ann-entry:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.part-ann-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin-bottom: 4px;
}

.part-ann-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: var(--vermillion);
  color: var(--paper);
  font-family: var(--sans);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.part-ann-term {
  font-weight: 700;
  font-size: 1.05em;
  color: var(--ink);
  padding: 2px 8px;
  background: var(--surface-warm);
  border-radius: 3px;
}

.part-ann-pron {
  margin-left: 2px;
}

.part-ann-def {
  color: var(--ink-mid);
  line-height: 2;
  white-space: pre-line;
  padding-left: 32px;
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
  border-bottom-width: 2px;
  border-bottom-style: solid;
}
:deep(.ann-target.ann-overlap) {
  border-bottom-width: 3px;
  border-bottom-style: double;
}
:deep(.ann-num) {
  font-size: 10px;
  vertical-align: super;
  margin-right: 1px;
}

.part-block--vertical :deep(.ann-target) {
  border-bottom: none;
  border-right: none;
  padding-right: 0px;
  background-image: linear-gradient(to bottom, var(--vermillion), var(--vermillion));
  background-size: 2px 100%;
  background-position: right center;
  background-repeat: no-repeat;
}
.part-block--vertical :deep(.ann-target.ann-overlap) {
  padding-right: 0px;
  background-size: 3px 100%;
}
.part-block--vertical :deep(.ann-num) {
  font-size: 0.45em;
  text-align: left;
  vertical-align: baseline;
  ruby-position: under;
}
.part-block--vertical :deep(.ann-num-long) {
  font-size: 0.38em;
}

.part-block--vertical .part-header {
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 0;
  margin-left: 20px;
  padding-bottom: 0;
  border-bottom: none;
  padding-left: 16px;
  border-left: 2px solid var(--vermillion);
}

.part-block--vertical .part-header-num {
  width: auto; height: auto;
  border-radius: 0;
  background: none;
  color: var(--vermillion);
  font-size: 16px;
}

.part-block--vertical .part-header h3 {
  font-size: 20px;
  letter-spacing: 6px;
}

.part-block--vertical .part-annotations {
  margin-top: 0;
  margin-left: 12px;
  padding-top: 0;
  padding-left: 12px;
  border-top: none;
  border-left: 1px dashed var(--border-light);
}

.part-block--vertical .part-ann-entry {
  margin-bottom: 0;
  margin-left: 16px;
  padding: 0;
  border-bottom: none;
}

.part-block--vertical .part-ann-head {
  align-items: flex-start;
  gap: 4px;
}

.part-block--vertical .part-ann-num {
  width: auto;
  height: auto;
  border-radius: 0;
  background: none;
  color: var(--vermillion);
  font-size: inherit;
}

.part-block--vertical .part-ann-term {
  background: none;
  padding: 0;
  font-size: inherit;
}

.part-block--vertical .part-ann-def {
  padding-left: 0;
  margin-left: 12px;
}
</style>
