<script setup lang="ts">
import type { PronSegment } from '../types'

defineProps<{
  segment: PronSegment
}>()
</script>

<template>
  <span class="pron-group">
    <span class="ann-pron" :class="segment.lang === 'yue' ? 'ann-yue' : 'ann-cmn'">
      {{ segment.label }}
    </span>
    <span
      v-for="(part, i) in segment.parts"
      :key="i"
      class="ann-phonetic"
    >{{ part }}</span>
  </span>
</template>

<style scoped>
.pron-group {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
  white-space: nowrap;
}
.ann-pron {
  display: inline-block;
  font-size: 0.75em;
  font-family: var(--sans);
  font-weight: 600;
  padding: 1px 3px;
  border-radius: 2px;
  vertical-align: middle;
  line-height: 1;
}
.ann-yue { background: var(--jade); color: #fff; }
.ann-cmn { background: var(--ink); color: var(--paper); }
.ann-phonetic {
  font-family: var(--sans);
  color: var(--ink-light);
}
</style>
