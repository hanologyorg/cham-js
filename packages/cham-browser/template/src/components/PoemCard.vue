<script setup lang="ts">
import { computed } from 'vue'
import type { Poem } from '../types'

const props = defineProps<{
  poem: Poem
  vertical?: boolean
}>()
defineEmits<{ click: [] }>()

const preview = computed(() => {
  const max = 2
  return props.poem.verses.slice(0, max).map(v => v.text).join('\n')
})
</script>

<template>
  <div class="pc-root" :class="{ 'pc-vertical': vertical }" @click="$emit('click')">
    <div class="pc-accent"></div>
    <div class="pc-body">
      <div class="pc-num">{{ String(poem.num).padStart(3, '0') }}</div>
      <h3 class="pc-title">{{ poem.title }}</h3>
      <div class="pc-author">{{ poem.author }}</div>
      <p class="pc-preview" style="white-space: pre-line">{{ preview }}</p>
    </div>
  </div>
</template>

<style scoped>
.pc-root {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.pc-accent {
  position: absolute;
  top: 0; left: 0;
  width: 3px; height: 0;
  background: var(--vermillion);
  transition: height 0.3s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}
.pc-root:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(var(--shadow-rgb), 0.08);
  border-color: var(--gold);
}
.pc-root:hover .pc-accent { height: 100%; }
.pc-body { padding: 24px; }
.pc-num {
  font-size: 11px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 2px;
  margin-bottom: 10px;
}
.pc-title {
  font-size: 20px; font-weight: 700;
  letter-spacing: 2px; margin-bottom: 6px;
  color: var(--ink);
}
.pc-author {
  font-size: 13px; color: var(--ink-light);
  font-family: var(--sans); letter-spacing: 1px;
}
.pc-preview {
  font-size: 13px; color: var(--ink-faint);
  margin-top: 14px; line-height: 1.7;
  overflow: hidden;
}

/* ─── 直排卡片：固定寬度，最小高度 ─── */
.pc-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  direction: ltr;
  width: 180px;
  min-height: 240px;
  flex-shrink: 0;
  align-self: start;
  justify-self: start;
}
.pc-vertical .pc-body {
  padding: 16px 20px 24px;
  box-sizing: border-box;
  overflow: hidden;
  height: auto;
  -webkit-mask-image: linear-gradient(to left, black 60%, transparent);
  mask-image: linear-gradient(to left, black 60%, transparent);
}
.pc-vertical .pc-num {
  font-size: 11px;
  margin-bottom: 0;
  margin-left: 6px;
  display: block;
  text-combine-upright: all;
}
.pc-vertical .pc-title {
  font-size: 22px;
  letter-spacing: 4px;
  margin-bottom: 0;
  margin-left: 6px;
  display: block;
}
.pc-vertical .pc-author {
  font-size: 13px;
  letter-spacing: 2px;
  margin-top: 0;
  margin-left: 4px;
  display: block;
}
.pc-vertical .pc-preview {
  margin-top: 0;
  margin-left: 6px;
  font-size: 12px;
  letter-spacing: 1px;
  line-height: 2;
  display: block;
  overflow: hidden;
}
.pc-vertical .pc-accent {
  top: auto; left: 0; bottom: 0;
  width: 0; height: 3px;
  transition: width 0.35s ease;
}
.pc-vertical:hover {
  transform: translateX(-4px);
}
.pc-vertical:hover .pc-accent { width: 100%; height: 3px; }
</style>
