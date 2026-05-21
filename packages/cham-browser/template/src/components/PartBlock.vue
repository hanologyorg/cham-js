<script setup lang="ts">
import { computed } from 'vue'
import type { Annotation, VerseLine, PieceSource } from '../types'
import { buildVerseAnnotations, renderAnnotatedText, resolveHoveredAnnotations } from '../composables/useAnnotationRenderer'

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
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px dashed var(--border-light);
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
  border-left-width: 2px;
  border-left-style: solid;
  padding-left: 2px;
}
.part-block--vertical :deep(.ann-target.ann-overlap) {
  border-left-width: 3px;
  border-left-style: double;
  padding-left: 3px;
}
.part-block--vertical :deep(.ann-num) {
  font-size: 0.45em;
  text-align: end;
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
