<script setup lang="ts">
import { toRef } from 'vue'
import type { Annotation, VerseLine } from '../types'
import { useAnnotatedVerses } from '../composables/useAnnotatedVerses'

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

const { verseHtml, resolveAnnotations } = useAnnotatedVerses(toRef(props, 'verses'), toRef(props, 'annotations'), false)

function onHover(event: MouseEvent) {
  const matched = resolveAnnotations(event)
  if (matched) emit('annotationHover', event, matched)
}

function onLeave() {
  emit('annotationLeave')
}

function onTap(event: MouseEvent) {
  const matched = resolveAnnotations(event)
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
      class="h-display-line h-verse-anim"
      :style="{ animationDelay: Math.min(0.15 + i * 0.08, 1.2) + 's' }"
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
  animation: poemReveal 0.5s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
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
  letter-spacing: 4px; color: var(--ink); white-space: pre-wrap;
}
.h-verse-anim {
  animation: verseFade 0.45s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}
@keyframes poemReveal {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes verseFade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
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
:deep(.ann-num-long) {
  letter-spacing: -1px;
}

@media (max-width: 768px) {
  .h-display {
    padding: 24px 20px;
    border-radius: 6px;
    width: 100%;
    box-sizing: border-box;
  }
  .h-display-title {
    font-size: 24px;
    letter-spacing: 4px;
  }
  .h-display-author {
    font-size: 14px;
    margin-bottom: 16px;
  }
  .h-display-line {
    font-size: var(--main-font-size, 20px);
    line-height: 2.4;
    letter-spacing: 2px;
  }
}
</style>
