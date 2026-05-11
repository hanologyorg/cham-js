<script setup lang="ts">
import type { AnnotationLayer } from '../types'

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

const hasLayers = () => props.layers.length > 1

function toggleAnnotations() {
  if (props.annotationsVisible) {
    emit('update:annotationsVisible', false)
    if (hasLayers()) emit('update:activeIds', [])
  } else {
    emit('update:annotationsVisible', true)
    if (hasLayers()) emit('update:activeIds', props.layers.map(l => l.id))
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
      :title="annotationsVisible ? '隱藏注釋' : '顯示注釋'"
    >注</button>
    <div v-if="hasLayers() && annotationsVisible" class="ann-layers">
      <button
        v-for="layer in layers"
        :key="layer.id"
        class="ann-layer-btn"
        :class="{ active: activeIds.includes(layer.id) }"
        @click="toggleLayer(layer.id)"
        :title="layer.label"
      >{{ layer.shortLabel }}</button>
    </div>
  </div>
</template>

<style scoped>
.ann-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  width: fit-content;
}

.ann-toggle {
  width: 36px;
  height: 36px;
  border: 1.5px solid var(--vermillion);
  border-radius: 6px;
  background: none;
  color: var(--vermillion);
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ann-toggle:hover {
  box-shadow: 0 2px 8px rgba(194, 58, 43, 0.15);
}

.ann-toggle:active {
  transform: scale(0.94);
}

.ann-toggle.on {
  background: var(--vermillion);
  color: #fff;
}

.ann-layers {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.ann-layer-btn {
  padding: 5px 10px;
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
    width: 40px;
    height: 40px;
    font-size: 17px;
  }
  .ann-layer-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
}
</style>
