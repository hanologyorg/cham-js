<script setup lang="ts">
import { toRef } from 'vue'
import type { Annotation, VerseLine } from '../types'
import { useAnnotatedVerses } from '../composables/useAnnotatedVerses'

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

const { verseHtml, resolveAnnotations } = useAnnotatedVerses(toRef(props, 'verses'), toRef(props, 'annotations'), true)

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
  <div class="v-scroll" @mouseover="onHover" @mouseleave="onLeave" @click="onTap">
    <span class="v-scroll-title">{{ title }}</span>
    <span class="v-scroll-author v-scroll-clickable" @click="emit('openAuthor', author)">{{ author }}</span>
    <div class="v-scroll-body v-scroll-verses">
      <span
        v-for="(_, i) in verses"
        :key="i"
        :id="`verse-${i + 1}`"
        :data-section-key="`verse-${i + 1}`"
        class="v-scroll-line v-verse-anim"
        :style="{ animationDelay: Math.min(0.2 + i * 0.06, 1.0) + 's' }"
        v-html="verseHtml(i)"
      />
    </div>
  </div>
</template>

<style scoped>
.v-scroll {
  --ann-shadow-y: -2px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  height: calc(100dvh - var(--nav-width, 56px));
  padding: 32px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
  position: relative;
  animation: poemRevealV 0.5s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

.v-scroll-title {
  font-size: 36px; font-weight: 900; color: var(--ink);
  letter-spacing: 10px; margin-left: 24px;
  padding-left: 20px; border-left: 3px solid var(--vermillion);
  line-height: 1.6;
}
.v-scroll-author {
  font-size: 22px; font-weight: 400; color: var(--ink-light);
  margin-left: 16px; padding-left: 16px; letter-spacing: 6px;
}
.v-scroll-clickable { cursor: pointer; transition: color 0.15s; }
.v-scroll-clickable:hover { color: var(--vermillion); }
.v-scroll-body { margin-left: 24px; }
.v-scroll-verses { counter-reset: verse; }
.v-scroll-line {
  font-size: var(--main-font-size, 24px); line-height: 2.4; letter-spacing: 6px;
  color: var(--ink); display: block; white-space: pre-wrap;
  counter-increment: verse;
}
.v-scroll-line::before {
  content: counter(verse, cjk-ideographic) "、";
  color: var(--ink-light);
  font-size: 0.7em;
  letter-spacing: 2px;
}
.v-verse-anim {
  animation: verseFadeV 0.4s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}
@keyframes poemRevealV {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes verseFadeV {
  from { opacity: 0; }
  to { opacity: 1; }
}

:deep(.ann-target) {
  border-bottom: none;
  border-right: none;
  padding-right: 0px;
  background-image: linear-gradient(to bottom, var(--vermillion), var(--vermillion));
  background-size: 2px 100%;
  background-position: right center;
  background-repeat: no-repeat;
}
:deep(.ann-target.ann-overlap) {
  padding-right: 0px;
  background-size: 3px 100%;
}
:deep(.ann-num) {
  font-size: 0.45em;
  text-align: left;
  ruby-position: under;
}
:deep(.ann-num-long) {
  font-size: 0.38em;
}
</style>
