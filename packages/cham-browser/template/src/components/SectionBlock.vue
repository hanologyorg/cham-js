<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { parseAnnotationBlock } from '../utils/annotationParser'
import { useI18n } from '../composables/useI18n'
import AnnotationParsedEntry from './AnnotationParsedEntry.vue'

const { locale } = useI18n()

const props = defineProps<{
  num: string
  label: string
  special: boolean
  text: string
  isAnnotations: boolean
  vertical?: boolean
  alwaysShow?: boolean
  toggleable?: boolean
  toggledOn?: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const visible = ref(false)

onMounted(() => {
  if (props.vertical || !rootRef.value) {
    visible.value = true
    return
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        visible.value = true
        observer.disconnect()
      }
    },
    { rootMargin: '0px 0px -40px 0px', threshold: 0 }
  )
  observer.observe(rootRef.value)
  onUnmounted(() => observer.disconnect())
})

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const CIRCULAR_NUMS: Record<string, string> = {
  '01': '①', '02': '②', '03': '③', '04': '④', '05': '⑤',
  '06': '⑥', '07': '⑦', '08': '⑧', '09': '⑨', '10': '⑩',
}

const displayNum = computed(() => {
  if (props.vertical && !props.special && CIRCULAR_NUMS[props.num]) {
    return CIRCULAR_NUMS[props.num]
  }
  return props.num
})

const displayLabel = computed(() => {
  if (!props.special) return props.label
  if (locale.value === 'en') return props.label
  return '【' + props.label + '】'
})

const entries = computed(() =>
  props.isAnnotations ? parseAnnotationBlock(props.text) : []
)

const paragraphsHtml = computed(() => {
  if (props.isAnnotations) return ''
  const lines = props.text.split('\n').filter(l => l.trim())
  return lines.length ? lines.map(p => `<p>${esc(p.trim())}</p>`).join('') : ''
})
</script>

<template>
  <div v-if="text || alwaysShow" ref="rootRef" class="sb-root" :class="{ 'sb-vertical': vertical, 'sb-visible': visible }">
    <div class="sb-header" :class="{ 'sb-toggleable': toggleable, 'sb-on': toggledOn }">
      <span v-if="displayNum" class="sb-num" :class="{ special }">{{ displayNum }}</span>
      <component :is="toggleable ? 'button' : 'h3'" v-if="displayLabel"
        class="sb-title"
        :class="{ 'sb-toggle': toggleable, 'sb-active': toggledOn }"
        @click="toggleable && emit('toggle')"
      >{{ displayLabel }}</component>
      <slot name="header-actions" />
    </div>
    <div v-if="isAnnotations && text" class="sb-text sb-ann-list">
      <AnnotationParsedEntry
        v-for="entry in entries"
        :key="entry.num"
        :entry="entry"
        :vertical="vertical"
      />
    </div>
    <div v-else class="sb-text" v-html="paragraphsHtml" />
  </div>
</template>

<style scoped>
.sb-root {
  margin-bottom: 40px;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s ease, transform 0.6s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}
.sb-root.sb-visible {
  opacity: 1;
  transform: translateY(0);
}
.sb-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 20px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.sb-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--vermillion); color: var(--paper);
  font-family: var(--sans); font-size: 13px; font-weight: 700;
  flex-shrink: 0;
}
.sb-num.special { background: var(--jade); }
.sb-title { font-size: 18px; font-weight: 700; letter-spacing: 3px; color: var(--ink); margin: 0; }
.sb-toggle {
  border: none; background: none; cursor: pointer; font-family: inherit;
  padding: 4px 12px; border-radius: 4px; transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  color: var(--ink-faint); border: 1px solid var(--border-light);
}
.sb-toggle:hover { color: var(--vermillion); border-color: var(--vermillion); }
.sb-toggle.sb-active { background: var(--vermillion); color: var(--paper); border-color: var(--vermillion); }
.sb-text {
  font-size: var(--body-font-size, 16px); line-height: 2.2; color: var(--ink-mid);
  text-align: justify;
}
.sb-text :deep(p) { margin-bottom: 16px; text-indent: 2em; }
.sb-text :deep(p:last-child) { margin-bottom: 0; }

/* ─── Annotation list ─── */
.sb-ann-list { text-align: start; }
.sb-ann-list :deep(.ape) {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
}
.sb-ann-list :deep(.ape:last-child) {
  border-bottom: none;
  padding-bottom: 0;
}

/* ─── 直排模式 ─── */
.sb-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  height: 100dvh;
  flex-shrink: 0;
  padding: var(--v-indent, 24px) var(--v-pad, 20px);
  border-right: 1px solid var(--border);
  overflow-x: auto;
  overflow-y: hidden;
  opacity: 1;
  transform: none;
  transition: none;
  scrollbar-width: thin;
  scrollbar-color: var(--gold) transparent;
}
.sb-vertical::-webkit-scrollbar { height: 3px; }
.sb-vertical::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }
.sb-vertical .sb-header {
  flex-direction: row;
  align-items: flex-start;
  margin-bottom: 0;
  margin-left: 20px;
  padding-bottom: 0;
  border-bottom: none;
  padding-left: 16px;
  border-left: 2px solid var(--vermillion);
  gap: 4px;
}
.sb-vertical .sb-num {
  width: auto; height: auto;
  border-radius: 0;
  background: none;
  color: var(--vermillion);
  font-size: 16px;
}
.sb-vertical .sb-title {
  font-size: 20px;
  letter-spacing: 6px;
}
.sb-vertical .sb-toggle {
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 3px;
}
.sb-toggleable.sb-vertical .sb-toggle {
  font-family: var(--sans);
}
.sb-vertical .sb-text {
  margin-left: 16px;
  text-align: start;
  font-size: var(--body-font-size, 16px);
  line-height: 2.2;
  letter-spacing: 1px;
}
.sb-vertical .sb-text :deep(p) {
  margin-bottom: 0;
  margin-left: 12px;
  text-indent: 0;
  line-height: 2.4;
}
.sb-vertical .sb-ann-list :deep(.ape) {
  margin-bottom: 0;
  margin-left: 16px;
  padding: 0;
  border-bottom: none;
}

@media (max-width: 768px) {
  .sb-ann-list :deep(.ape) {
    padding: 10px 0;
  }
  .sb-ann-list :deep(.ape-def) {
    padding-left: 0;
  }
}
</style>
