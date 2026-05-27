<script setup lang="ts">
import type { AnnotationEntry } from '../types'
import PronunciationGroup from './PronunciationGroup.vue'

defineProps<{
  entry: AnnotationEntry
  vertical?: boolean
}>()
</script>

<template>
  <div class="ape" :class="{ 'ape--vertical': vertical }">
    <div class="ape-head">
      <span class="ape-num">{{ entry.numDisplay }}</span>
      <span class="ape-term">{{ entry.term }}</span>
      <PronunciationGroup
        v-for="seg in entry.pronSegments"
        :key="seg.lang"
        :segment="seg"
        class="ape-pron"
      />
    </div>
    <div v-if="entry.definition" class="ape-def">{{ entry.definition }}</div>
  </div>
</template>

<style scoped>
.ape-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin-bottom: 4px;
}
.ape-num {
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
.ape-term {
  font-weight: 700;
  font-size: 1.05em;
  color: var(--ink);
  padding: 2px 8px;
  background: var(--surface-warm);
  border-radius: 3px;
}
.ape-pron {
  margin-left: 2px;
}
.ape-def {
  color: var(--ink-mid);
  line-height: 2;
  white-space: pre-line;
  padding-left: 32px;
}

/* ─── Vertical mode ─── */
.ape--vertical {
  margin-bottom: 0;
  margin-left: 16px;
  padding: 0;
  border-bottom: none;
}
.ape--vertical .ape-head {
  align-items: flex-start;
  gap: 4px;
}
.ape--vertical .ape-num {
  width: auto;
  height: auto;
  border-radius: 0;
  background: none;
  color: var(--vermillion);
  font-size: inherit;
}
.ape--vertical .ape-term {
  background: none;
  padding: 0;
  font-size: inherit;
}
.ape--vertical .ape-def {
  padding-left: 0;
  margin-left: 12px;
}

@media (max-width: 768px) {
  .ape-def {
    padding-left: 0;
  }
}
</style>
