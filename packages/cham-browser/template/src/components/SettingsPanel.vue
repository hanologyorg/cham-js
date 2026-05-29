<script setup lang="ts">
import { useReadingMode, THEMES, FONT_SIZES } from '../composables/useReadingMode'
import type { LayoutMode, FontSize } from '../composables/useReadingMode'
import { useI18n, type Locale } from '../composables/useI18n'

defineProps<{ showAnnotationPane?: boolean }>()

const { theme, layout, mainFontSize, bodyFontSize, annotationsVisible, annotationPane, setTheme, setLayout, setMainFontSize, setBodyFontSize, setAnnotationsVisible, setAnnotationPane } = useReadingMode()
const { t, setLocale, locale, availableLocales, localeLabels } = useI18n()

function mainFontDown() {
  const idx = FONT_SIZES.indexOf(mainFontSize.value)
  if (idx > 0) setMainFontSize(FONT_SIZES[idx - 1] as FontSize)
}
function mainFontUp() {
  const idx = FONT_SIZES.indexOf(mainFontSize.value)
  if (idx < FONT_SIZES.length - 1) setMainFontSize(FONT_SIZES[idx + 1] as FontSize)
}
function bodyFontDown() {
  const idx = FONT_SIZES.indexOf(bodyFontSize.value)
  if (idx > 0) setBodyFontSize(FONT_SIZES[idx - 1] as FontSize)
}
function bodyFontUp() {
  const idx = FONT_SIZES.indexOf(bodyFontSize.value)
  if (idx < FONT_SIZES.length - 1) setBodyFontSize(FONT_SIZES[idx + 1] as FontSize)
}
</script>

<template>
  <div class="sp-group">
    <div class="sp-label">{{ t('settings.layout') }}</div>
    <div class="sp-options">
      <button class="sp-opt" :class="{ active: layout === 'horizontal' }" @click="setLayout('horizontal' as LayoutMode)">{{ t('settings.horizontal') }}</button>
      <button class="sp-opt" :class="{ active: layout === 'vertical' }" @click="setLayout('vertical' as LayoutMode)">{{ t('settings.vertical') }}</button>
    </div>
  </div>
  <div class="sp-group">
    <div class="sp-label">{{ t('settings.theme') }}</div>
    <div class="sp-options">
      <button v-for="th in THEMES" :key="th" class="sp-opt sp-theme" :class="{ active: theme === th, ['theme-' + th]: true }" @click="setTheme(th)">
        <span class="sp-theme-dot" :class="'dot-' + th" />
        {{ t('theme.' + th) }}
      </button>
    </div>
  </div>
  <div class="sp-group">
    <div class="sp-label">{{ t('settings.mainFontSize') }}</div>
    <div class="sp-size-row">
      <button class="sp-size-btn" @click="mainFontDown">−</button>
      <span class="sp-size-val">{{ mainFontSize }}</span>
      <button class="sp-size-btn" @click="mainFontUp">+</button>
    </div>
  </div>
  <div class="sp-group">
    <div class="sp-label">{{ t('settings.bodyFontSize') }}</div>
    <div class="sp-size-row">
      <button class="sp-size-btn" @click="bodyFontDown">−</button>
      <span class="sp-size-val">{{ bodyFontSize }}</span>
      <button class="sp-size-btn" @click="bodyFontUp">+</button>
    </div>
  </div>
  <div class="sp-group">
    <div class="sp-label">{{ t('settings.annotations') }}</div>
    <div class="sp-options">
      <button class="sp-opt" :class="{ active: annotationsVisible }" @click="setAnnotationsVisible(true)">{{ t('settings.show') }}</button>
      <button class="sp-opt" :class="{ active: !annotationsVisible }" @click="setAnnotationsVisible(false)">{{ t('settings.hide') }}</button>
    </div>
  </div>
  <div v-if="showAnnotationPane" class="sp-group">
    <div class="sp-label">{{ t('settings.annotationPane') }}</div>
    <div class="sp-options">
      <button class="sp-opt" :class="{ active: annotationPane }" @click="setAnnotationPane(true)">{{ t('settings.show') }}</button>
      <button class="sp-opt" :class="{ active: !annotationPane }" @click="setAnnotationPane(false)">{{ t('settings.hide') }}</button>
    </div>
  </div>
  <div class="sp-group">
    <div class="sp-label">{{ t('settings.language') }}</div>
    <div class="sp-options">
      <button v-for="loc in availableLocales" :key="loc" class="sp-opt" :class="{ active: locale === loc }" @click="setLocale(loc as Locale)">{{ localeLabels[loc] }}</button>
    </div>
  </div>
  <div class="sp-shortcuts">
    <span class="sp-sc"><kbd>V</kbd> {{ t('shortcut.toggleLayout') }}</span>
    <span class="sp-sc"><kbd>T</kbd> {{ t('shortcut.toggleTheme') }}</span>
    <span class="sp-sc"><kbd>Esc</kbd> {{ t('shortcut.goHome') }}</span>
  </div>
</template>

<style scoped>
.sp-group { margin-bottom: 14px; }
.sp-group:last-child { margin-bottom: 0; }
.sp-label {
  font-family: var(--sans);
  font-size: 11px; font-weight: 600;
  color: var(--ink-faint);
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.sp-options { display: flex; gap: 6px; }
.sp-opt {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-mid);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.sp-opt:hover { border-color: var(--ink); color: var(--ink); }
.sp-opt.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.sp-opt.active .sp-theme-dot { border-color: var(--paper); }
.sp-theme {
  position: relative;
  padding-left: 22px;
}
.sp-theme-dot {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--border);
}
.sp-theme-dot.dot-light { background: #faf6ee; }
.sp-theme-dot.dot-sepia { background: #f0e4c8; }
.sp-theme-dot.dot-dark { background: #1c1c1e; border-color: #48484a; }
.sp-theme-dot.dot-oled { background: #000; border-color: #333; }
.sp-size-row {
  display: flex; align-items: center; gap: 6px; justify-content: center;
}
.sp-size-btn {
  width: 28px; height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  font-family: var(--sans);
  font-size: 14px;
  color: var(--ink-mid);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, border-color 0.15s;
}
.sp-size-btn:hover { border-color: var(--ink); color: var(--ink); }
.sp-size-val {
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink);
  min-width: 32px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.sp-shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-light);
  margin-top: 2px;
}
.sp-sc {
  font-family: var(--sans);
  font-size: 10px;
  color: var(--ink-faint);
  letter-spacing: 1px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.sp-sc kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 3px;
  border: 1px solid var(--border);
  border-radius: 2px;
  font-family: var(--sans);
  font-size: 9px;
  color: var(--ink-light);
  background: var(--surface);
}
</style>
