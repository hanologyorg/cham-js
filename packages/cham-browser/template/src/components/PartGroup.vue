<script setup lang="ts">
import type { Annotation, Part } from '../types'
import PartBlock from './PartBlock.vue'

defineProps<{
  label: string
  parts: Part[]
  vertical?: boolean
}>()

const emit = defineEmits<{
  annotationHover: [event: MouseEvent, annotations: Annotation[]]
  annotationLeave: []
  annotationTap: [event: MouseEvent, annotations: Annotation[]]
}>()
</script>

<template>
  <div class="part-group" :class="{ 'part-group--vertical': vertical }">
    <div class="part-group-label">{{ label }}</div>
    <PartBlock
      v-for="part in parts"
      :key="part.num"
      :num="part.num"
      :verses="part.verses"
      :annotations="part.annotations"
      :annotation-text="part.annotationText"
      :vertical="vertical"
      :source="part.source"
      @annotation-hover="(e, a) => emit('annotationHover', e, a)"
      @annotation-leave="emit('annotationLeave')"
      @annotation-tap="(e, a) => emit('annotationTap', e, a)"
    />
  </div>
</template>

<style scoped>
.part-group {
  margin-bottom: 40px;
}

.part-group:last-child {
  margin-bottom: 0;
}

.part-group-label {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 6px;
  color: var(--ink);
  padding-bottom: 12px;
  margin-bottom: 8px;
  border-bottom: 3px solid var(--vermillion);
  display: inline-block;
}

.part-group--vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.part-group--vertical .part-group-label {
  font-size: 28px;
  letter-spacing: 10px;
  border-bottom: none;
  border-left: 3px solid var(--vermillion);
  padding-bottom: 0;
  padding-left: 16px;
  margin-bottom: 0;
  margin-left: 12px;
  display: block;
}
</style>
