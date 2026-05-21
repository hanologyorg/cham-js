<script setup lang="ts">
import type { PronSegment } from '../types'

defineProps<{
  segment: PronSegment
}>()
</script>

<template>
  <span class="pron-group">
    <span class="pron-badge" :class="segment.lang === 'yue' ? 'pron-yue' : 'pron-cmn'">
      {{ segment.label }}
    </span>
    <span class="pron-text">{{ segment.parts.join(' ') }}</span>
  </span>
</template>

<style scoped>
.pron-group {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.pron-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-family: var(--sans);
  font-weight: 700;
  letter-spacing: 0.5px;
  line-height: 1;
  flex-shrink: 0;
}
.pron-yue {
  background: var(--jade);
  color: var(--paper);
}
.pron-cmn {
  background: var(--ink);
  color: var(--paper);
}
.pron-text {
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-light);
  letter-spacing: 0.5px;
}
</style>
