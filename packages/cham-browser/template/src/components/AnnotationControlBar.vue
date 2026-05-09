<script setup lang="ts">
import type { AnnotationLayer } from '../types'

const props = defineProps<{
  layers: AnnotationLayer[]
  hasAnnotations: boolean
  activeIds: string[]
}>()

const emit = defineEmits<{
  'update:activeIds': [ids: string[]]
  'update:annotationsVisible': [visible: boolean]
}>()

const allIds = () => props.layers.map(l => l.id)
const noneIds = () => [] as string[]

function toggleAnnotations() {
  if (props.activeIds.length > 0) {
    emit('update:activeIds', noneIds())
    emit('update:annotationsVisible', false)
  } else {
    emit('update:activeIds', allIds())
    emit('update:annotationsVisible', true)
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
  <div v-if="hasAnnotations" class="ann-control-bar">
    <button
      class="ann-toggle"
      :class="{ active: activeIds.length > 0 }"
      @click="toggleAnnotations"
    >注</button>
    <template v-if="layers.length > 1">
      <span class="ann-bar-sep" />
      <button
        v-for="layer in layers"
        :key="layer.id"
        :class="['ann-layer-btn', { active: activeIds.includes(layer.id) }]"
        :title="layer.label"
        @click="toggleLayer(layer.id)"
      >
        {{ layer.shortLabel }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.ann-control-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ann-toggle {
  width: 28px;
  height: 28px;
  border: 1px solid var(--vermillion);
  border-radius: 4px;
  background: none;
  color: var(--vermillion);
  font-family: var(--serif);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0;
}

.ann-toggle.active {
  background: var(--vermillion);
  color: #fff;
}

.ann-toggle:hover {
  border-color: var(--vermillion-light);
}

.ann-bar-sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 2px;
}

.ann-layer-btn {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  background: var(--surface);
  color: var(--ink-mid);
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--sans);
  letter-spacing: 1px;
}

.ann-layer-btn:hover {
  border-color: var(--gold);
}

.ann-layer-btn.active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
</style>
