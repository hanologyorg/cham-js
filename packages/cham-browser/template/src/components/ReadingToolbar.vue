<script setup lang="ts">
import { ref } from 'vue'
import { useReadingMode, THEMES, THEME_LABELS, FONT_SIZES } from '../composables/useReadingMode'
import type { LayoutMode, FontSize } from '../composables/useReadingMode'
import { useI18n, LOCALE_LABELS, type Locale } from '../composables/useI18n'

const { theme, layout, mainFontSize, bodyFontSize, setTheme, setLayout, setMainFontSize, setBodyFontSize } = useReadingMode()
const { t, setLocale, locale, availableLocales, localeLabels } = useI18n()
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
        <div class="rt-label">{{ t('settings.layout') }}</div>
        <div class="rt-options">
          <button
            class="rt-opt"
            :class="{ active: layout === 'horizontal' }"
            @click="setLayout('horizontal' as LayoutMode)"
          >{{ t('settings.horizontal') }}</button>
          <button
            class="rt-opt"
            :class="{ active: layout === 'vertical' }"
            @click="setLayout('vertical' as LayoutMode)"
          >{{ t('settings.vertical') }}</button>
        </div>
      </div>
      <div class="rt-group">
        <div class="rt-label">{{ t('settings.theme') }}</div>
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
      <div class="rt-group">
        <div class="rt-label">{{ t('settings.mainFontSize') }}</div>
        <div class="rt-size-row">
          <button class="rt-size-btn" @click="setMainFontSize(FONT_SIZES[Math.max(0, FONT_SIZES.indexOf(mainFontSize) - 1)] as FontSize)">−</button>
          <span class="rt-size-val">{{ mainFontSize }}</span>
          <button class="rt-size-btn" @click="setMainFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, FONT_SIZES.indexOf(mainFontSize) + 1)] as FontSize)">+</button>
        </div>
      </div>
      <div class="rt-group">
        <div class="rt-label">{{ t('settings.bodyFontSize') }}</div>
        <div class="rt-size-row">
          <button class="rt-size-btn" @click="setBodyFontSize(FONT_SIZES[Math.max(0, FONT_SIZES.indexOf(bodyFontSize) - 1)] as FontSize)">−</button>
          <span class="rt-size-val">{{ bodyFontSize }}</span>
          <button class="rt-size-btn" @click="setBodyFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, FONT_SIZES.indexOf(bodyFontSize) + 1)] as FontSize)">+</button>
        </div>
      </div>
      <div class="rt-group">
        <div class="rt-label">{{ t('settings.language') }}</div>
        <div class="rt-options">
          <button
            v-for="loc in availableLocales"
            :key="loc"
            class="rt-opt"
            :class="{ active: locale === loc }"
            @click="setLocale(loc as Locale)"
          >{{ localeLabels[loc] }}</button>
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
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; align-items: center; justify-content: center;
}
.rt-fab:hover {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
  transform: scale(1.05);
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
  animation: slideUp 0.25s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
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
.rt-size-row {
  display: flex; align-items: center; gap: 6px; justify-content: center;
}
.rt-size-btn {
  width: 28px; height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  font-family: var(--sans);
  font-size: 14px;
  color: var(--ink-mid);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.rt-size-btn:hover { border-color: var(--ink); color: var(--ink); }
.rt-size-val {
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink);
  min-width: 32px;
  text-align: center;
}
.rt-backdrop {
  position: fixed; inset: 0;
  z-index: -1;
}
</style>
