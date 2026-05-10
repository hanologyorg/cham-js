<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { parseAnnotationBlock } from '../utils/annotationParser'
import PronunciationGroup from './PronunciationGroup.vue'

const props = defineProps<{
  num: string
  label: string
  special: boolean
  text: string
  isAnnotations: boolean
  vertical?: boolean
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
  <div v-if="text" ref="rootRef" class="sb-root" :class="{ 'sb-vertical': vertical, 'sb-visible': visible }">
    <div class="sb-header">
      <span v-if="displayNum" class="sb-num" :class="{ special }">{{ displayNum }}</span>
      <h3>{{ special ? '【' + label + '】' : label }}</h3>
    </div>
    <div v-if="isAnnotations" class="sb-text sb-ann-list">
      <div v-for="entry in entries" :key="entry.num" class="sb-ann-entry">
        <span class="sb-ann-num">{{ entry.numDisplay }}</span>
        <span class="sb-ann-term">{{ entry.term }}</span>
        <PronunciationGroup
          v-for="seg in entry.pronSegments"
          :key="seg.lang"
          :segment="seg"
        />
        <span v-if="entry.definition" class="sb-ann-def">{{ entry.definition }}</span>
      </div>
    </div>
    <div v-else class="sb-text" v-html="paragraphsHtml" />
  </div>
</template>

<style scoped>
.sb-root {
  margin-bottom: 40px;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s ease, transform 0.5s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
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
  background: var(--vermillion); color: #fff;
  font-family: var(--sans); font-size: 13px; font-weight: 700;
  flex-shrink: 0;
}
.sb-num.special { background: var(--jade); }
.sb-header h3 { font-size: 18px; font-weight: 700; letter-spacing: 3px; color: var(--ink); }
.sb-text {
  font-size: var(--body-font-size, 16px); line-height: 2.2; color: var(--ink-mid);
  text-align: justify;
}
.sb-text :deep(p) { margin-bottom: 16px; text-indent: 2em; }
.sb-text :deep(p:last-child) { margin-bottom: 0; }

.sb-ann-list { text-align: start; }
.sb-ann-entry { margin-bottom: 14px; }
.sb-ann-num { color: var(--vermillion); font-weight: 600; font-family: var(--sans); }
.sb-ann-term { font-weight: 600; color: var(--ink); }
.sb-ann-def { white-space: pre-line; }

/* ─── 直排模式 ─── */
.sb-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  height: 100vh;
  flex-shrink: 0;
  padding: 32px 20px;
  border-right: 1px solid var(--border);
  overflow-x: auto;
  overflow-y: hidden;
  opacity: 1;
  transform: none;
  transition: none;
}
.sb-vertical .sb-header {
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 0;
  margin-left: 16px;
  padding-bottom: 0;
  border-bottom: none;
  padding-left: 16px;
  border-left: 1px solid var(--border);
}
.sb-vertical .sb-num {
  width: auto; height: auto;
  border-radius: 0;
  background: none;
  color: var(--vermillion);
  font-size: 18px;
}
.sb-vertical .sb-text {
  margin-left: 16px;
  text-align: start;
}
.sb-vertical .sb-text :deep(p) {
  margin-bottom: 0;
  margin-left: 12px;
  text-indent: 0;
}
.sb-vertical .sb-ann-entry {
  margin-bottom: 0;
  margin-left: 16px;
}
</style>
