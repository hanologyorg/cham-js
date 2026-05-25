<script setup lang="ts">
import { computed } from 'vue'
import type { AnnotationLayer } from '../types'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  layers: AnnotationLayer[]
  hasAnnotations: boolean
  activeIds: string[]
  annotationsVisible: boolean
}>()

const emit = defineEmits<{
  'update:activeIds': [ids: string[]]
  'update:annotationsVisible': [visible: boolean]
}>()

// Only named layers (skip 'default' — base annotations are always shown)
const toggleableLayers = computed(() =>
  props.layers.filter(l => l.id !== 'default')
)

const hasLayers = () => toggleableLayers.value.length > 0

function toggleAnnotations() {
  if (props.annotationsVisible) {
    emit('update:annotationsVisible', false)
    if (hasLayers()) emit('update:activeIds', [])
  } else {
    emit('update:annotationsVisible', true)
    if (hasLayers()) emit('update:activeIds', toggleableLayers.value.map(l => l.id))
  }
}

function toggleLayer(id: string) {
  const current = props.activeIds
  if (current.includes(id)) {
    const next = current.filter(x => x !== id)
    emit('update:activeIds', next)
    if (next.length === 0) emit('update:annotationsVisible', false)
  } else {
    const next = [...current, id]
    emit('update:activeIds', next)
    emit('update:annotationsVisible', true)
  }
}
</script>

<template>
  <div v-if="hasAnnotations" class="ann-bar">
    <button
      class="ann-toggle"
      :class="{ on: annotationsVisible }"
      @click="toggleAnnotations"
      :title="annotationsVisible ? t('annotation.hideAnnotations') : t('annotation.showAnnotations')"
    >{{ t('annotation.notes') }}</button>
    <button
      v-for="layer in toggleableLayers"
      :key="layer.id"
      v-show="annotationsVisible"
      class="ann-layer-btn"
      :class="{ active: activeIds.includes(layer.id) }"
      @click="toggleLayer(layer.id)"
      :title="layer.label"
    >{{ layer.shortLabel }}</button>
  </div>
</template>

<style scoped>
.ann-bar {
  writing-mode: horizontal-tb;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.ann-toggle {
  padding: 6px 12px;
  border: 1.5px solid var(--vermillion);
  border-radius: 6px;
  background: none;
  color: var(--vermillion);
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.2s;
  writing-mode: horizontal-tb;
  white-space: nowrap;
}

.ann-toggle:hover {
  box-shadow: 0 2px 8px rgba(var(--shadow-rgb), 0.15);
}

.ann-toggle:active {
  transform: scale(0.94);
}

.ann-toggle.on {
  background: var(--vermillion);
  color: var(--paper);
}

.ann-layer-btn {
  width: 36px;
  padding: 5px 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  color: var(--ink-faint);
  font-family: var(--sans);
  font-size: 11px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  text-align: center;
}

.ann-layer-btn:hover {
  border-color: var(--gold);
  color: var(--ink);
}

.ann-layer-btn.active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.ann-layer-btn:active {
  transform: scale(0.95);
}

@media (max-width: 768px) {
  .ann-toggle {
    padding: 8px 14px;
    font-size: 17px;
  }
  .ann-layer-btn {
    width: 40px;
    font-size: 12px;
  }
}
</style>
