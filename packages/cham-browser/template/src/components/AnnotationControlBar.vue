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
      class="ann-master"
      :class="{ active: annotationsVisible }"
      @click="toggleAnnotations"
    >
      <span class="ann-master-icon">{{ annotationsVisible ? '✓' : '注' }}</span>
      <span class="ann-master-text">{{ annotationsVisible ? '注釋' : '顯示注釋' }}</span>
      <span v-if="hasLayers() && annotationsVisible" class="ann-count">{{ activeIds.length }}/{{ layers.length }}</span>
    </button>
    <template v-if="hasLayers() && annotationsVisible">
      <div class="ann-chips">
        <button
          v-for="layer in layers"
          :key="layer.id"
          :class="['ann-chip', { active: activeIds.includes(layer.id) }]"
          :title="layer.label"
          @click="toggleLayer(layer.id)"
        >
          <span class="ann-chip-check">{{ activeIds.includes(layer.id) ? '✓' : '' }}</span>
          {{ layer.shortLabel }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ann-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ann-master {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border: 1.5px solid var(--vermillion);
  border-radius: 20px;
  background: none;
  color: var(--vermillion);
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;
  min-height: 44px;
  align-self: flex-start;
}

.ann-master.active {
  background: var(--vermillion);
  color: #fff;
}

.ann-master:active {
  transform: scale(0.97);
}

.ann-master:hover {
  box-shadow: 0 2px 12px rgba(194, 58, 43, 0.15);
}

.ann-master-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
}

.ann-master.active .ann-master-icon {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.15);
}

.ann-master-text {
  white-space: nowrap;
}

.ann-count {
  font-size: 11px;
  opacity: 0.7;
  margin-left: 2px;
}

.ann-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-left: 4px;
}

.ann-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  color: var(--ink-mid);
  font-family: var(--sans);
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 36px;
}

.ann-chip:hover {
  border-color: var(--gold);
  color: var(--ink);
}

.ann-chip.active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.ann-chip:active {
  transform: scale(0.96);
}

.ann-chip-check {
  font-size: 11px;
  width: 12px;
  text-align: center;
}

@media (max-width: 768px) {
  .ann-master {
    padding: 10px 24px;
    font-size: 14px;
  }
  .ann-chips {
    gap: 6px;
  }
  .ann-chip {
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>
