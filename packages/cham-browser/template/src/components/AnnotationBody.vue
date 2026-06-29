<script setup lang="ts">
// ─── AnnotationBody ────────────────────────────────────────────
// Shared rendering of an annotation's content (pronunciation group +
// text). The kind badge and any layout wrapper are owned by the
// parent (AnnotationTooltip, AnnotationPane). The body itself is the
// piece that has varied between callers: headword stripping, layer
// labels, and the pronunciation-or-text decision.
//
// Single-responsibility: given one annotation and a pre-resolved
// layer label, render its body. No state, no events.

import { computed } from 'vue'
import { annotationToPronSegment } from '../utils/annotationParser'
import PronunciationGroup from './PronunciationGroup.vue'
import type { Annotation } from '../types'

const props = defineProps<{
  annotation: Annotation
  /** Headword used to strip redundant prefix from text. */
  headword?: string
  /** Pre-resolved layer label (e.g. "郭璞注"). */
  layerLabel?: string
}>()

const segment = computed(() => annotationToPronSegment(props.annotation))

/**
 * Display text: strips a redundant headword prefix and leading
 * punctuation. e.g. for headword "言" and text "言：郭曰云云",
 * returns "郭曰云云".
 */
const text = computed(() => {
  if (!props.annotation.text) return ''
  if (!props.headword) return props.annotation.text
  if (props.annotation.text.startsWith(props.headword)) {
    const rest = props.annotation.text.slice(props.headword.length)
    const m = rest.match(/^[，。、：；！？\s]+/)
    return m ? rest.slice(m[0].length) : rest
  }
  return props.annotation.text
})
</script>

<template>
  <span v-if="layerLabel" class="ann-layer">{{ layerLabel }}</span>
  <div v-if="segment" class="ann-pron-h"><PronunciationGroup :segment="segment" /></div>
  <span v-if="annotation.kind !== 'pronunciation' && text" class="ann-text">{{ text }}</span>
</template>
