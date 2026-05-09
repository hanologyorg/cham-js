<script setup lang="ts">
import { ref } from 'vue'
import { useReadingMode, THEMES, THEME_LABELS } from '../composables/useReadingMode'
import type { LayoutMode } from '../composables/useReadingMode'

const { theme, layout, setTheme, setLayout } = useReadingMode()
const open = ref(false)

function toggle() { open.value = !open.value }
function close() { open.value = false }
</script>

<template>
  <div class="rt" :class="{ open }">
    <button class="rt-fab" @click="toggle" :aria-label="open ? '關閉設定' : '閱讀設定'">
      <span v-if="!open" class="rt-icon">設</span>
      <span v-else class="rt-icon">✕</span>
    </button>
    <div v-if="open" class="rt-panel" @click.stop>
      <div class="rt-group">
        <div class="rt-label">版面</div>
        <div class="rt-options">
          <button
            class="rt-opt"
            :class="{ active: layout === 'horizontal' }"
            @click="setLayout('horizontal' as LayoutMode)"
          >橫排</button>
          <button
            class="rt-opt"
            :class="{ active: layout === 'vertical' }"
            @click="setLayout('vertical' as LayoutMode)"
          >直排</button>
        </div>
      </div>
      <div class="rt-group">
        <div class="rt-label">主題</div>
        <div class="rt-options">
          <button
            v-for="t in THEMES"
            :key="t"
            class="rt-opt rt-theme"
            :class="{ active: theme === t, ['theme-' + t]: true }"
            @click="setTheme(t)"
          >{{ THEME_LABELS[t] }}</button>
        </div>
      </div>
    </div>
    <div v-if="open" class="rt-backdrop" @click="close" />
  </div>
</template>

<style scoped>
.rt {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 500;
}
.rt-fab {
  width: 44px; height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-mid);
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.12);
  transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.rt-fab:hover {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
.rt-icon {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 15px;
}
.rt-panel {
  position: absolute;
  bottom: 56px;
  right: 0;
  width: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(var(--shadow-rgb), 0.16);
  padding: 16px;
  animation: slideUp 0.2s ease;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.rt-group { margin-bottom: 14px; }
.rt-group:last-child { margin-bottom: 0; }
.rt-label {
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-faint);
  letter-spacing: 2px;
  margin-bottom: 8px;
  text-transform: uppercase;
}
.rt-options { display: flex; gap: 6px; }
.rt-opt {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-mid);
  cursor: pointer;
  transition: all 0.15s;
}
.rt-opt:hover { border-color: var(--ink); color: var(--ink); }
.rt-opt.active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
.rt-backdrop {
  position: fixed; inset: 0;
  z-index: -1;
}
</style>
