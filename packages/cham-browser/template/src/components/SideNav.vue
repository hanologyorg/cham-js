<script setup lang="ts">
import { ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useReadingMode } from '../composables/useReadingMode'
import { useI18n } from '../composables/useI18n'
import { useSiteConfig } from '../composables/useSiteConfig'
import SettingsPanel from './SettingsPanel.vue'

defineProps<{
  context?: string
  poemTitle?: string
  poemAuthor?: string
  titleCollapsed?: boolean
  hasBack?: boolean
  hasPrev?: boolean
  hasNext?: boolean
}>()

const emit = defineEmits<{
  back: []
  home: []
  navigate: [delta: number]
}>()

const { layout } = useReadingMode()
const { t } = useI18n()
const { logoUrl, aboutHtml } = useSiteConfig()
const router = useRouter()
const settingsOpen = ref(false)
const aboutPane = inject<{ toggleAbout: () => void }>('aboutPane')

function toggleSettings() { settingsOpen.value = !settingsOpen.value }
</script>

<template>
  <nav class="sidenav">
    <button class="sn-brand" @click="emit('home')" :aria-label="t('nav.home')">
      <img v-if="logoUrl" :src="logoUrl" alt="" width="36" height="44" class="sn-logo" />
      <span v-else class="sn-seal">文</span>
    </button>

    <button v-if="hasBack" class="sn-btn" @click="emit('back')" :aria-label="t('nav.back')">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </button>

    <div v-if="context && !titleCollapsed" class="sn-context">{{ context }}</div>

    <Transition name="title-in">
      <div v-if="titleCollapsed && poemTitle" class="sn-poem-info">
        <div class="sn-poem-title" :class="{ 'sn-title-long': poemTitle.length > 6 }">{{ poemTitle }}</div>
        <div v-if="poemAuthor" class="sn-poem-author">{{ poemAuthor }}</div>
      </div>
    </Transition>

    <div class="sn-spacer" />

    <button v-if="hasPrev" class="sn-btn sn-nav-btn" @click="emit('navigate', -1)" :aria-label="t('piece.previous')">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
    </button>

    <button v-if="hasNext" class="sn-btn sn-nav-btn" @click="emit('navigate', 1)" :aria-label="t('piece.next')">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </button>

    <button v-if="aboutHtml" class="sn-btn" @click="aboutPane?.toggleAbout()" :aria-label="t('nav.about')">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
    </button>

    <button
      class="sn-btn"
      :class="{ active: settingsOpen }"
      @click="toggleSettings"
      :aria-label="t('settings.shortTitle')"
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    </button>

    <div v-if="layout === 'vertical'" class="sn-layout-tag">{{ t('layout.verticalShort') }}</div>

    <Transition name="slide-left">
      <div v-if="settingsOpen" class="sn-settings" @click.stop>
        <SettingsPanel />
      </div>
    </Transition>

    <div v-if="settingsOpen" class="sn-overlay" @click="settingsOpen = false" />
  </nav>
</template>

<style scoped>
.sidenav {
  position: fixed;
  top: 0; right: 0;
  width: 56px; height: 100dvh;
  background: var(--paper);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  align-items: center;
  padding: max(12px, env(safe-area-inset-top, 0px)) 0 max(12px, env(safe-area-inset-bottom, 0px));
  z-index: 200;
  gap: 8px;
}

.sn-brand {
  width: 40px; height: 48px;
  border: 2px solid var(--vermillion);
  border-radius: 3px;
  background: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-bottom: 4px;
  padding: 2px;
}
.sn-brand:hover { opacity: 0.8; }
.sn-logo {
  height: 100%;
  width: auto;
  object-fit: contain;
}
.sn-brand:has(.sn-logo) { border: none; }
.sn-seal {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-family: var(--serif);
  font-size: 14px; font-weight: 900;
  color: var(--vermillion);
  display: flex;
  align-items: center;
  letter-spacing: 2px;
  line-height: 1;
}

.sn-btn {
  width: 36px; height: 36px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  color: var(--ink-light);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.sn-btn:hover { border-color: var(--ink); color: var(--ink); }
.sn-btn.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.sn-nav-btn svg {
  writing-mode: vertical-rl;
}

.sn-context {
  writing-mode: vertical-rl;
  font-size: 11px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  max-height: 120px;
  overflow: hidden;
  font-family: var(--sans);
  text-align: center;
  transition: opacity 0.3s ease, max-height 0.3s ease;
}

.sn-poem-info {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 4px;
  max-height: 240px;
  overflow: hidden;
}
.sn-poem-title {
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 4px;
  color: var(--ink);
  padding-left: 6px;
  border-left: 2px solid var(--vermillion);
  line-height: 1.5;
}
.sn-title-long {
  font-size: 13px;
  letter-spacing: 2px;
  line-height: 1.6;
}
.sn-poem-author {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-light);
  letter-spacing: 2px;
}

.title-in-enter-active, .title-in-leave-active {
  transition: opacity 0.4s, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.title-in-enter-from, .title-in-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.sn-spacer { flex: 1; }

.sn-layout-tag {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--paper);
  font-size: 11px; font-weight: 700;
  font-family: var(--sans);
  display: flex; align-items: center; justify-content: center;
}

.sn-settings {
  position: absolute;
  top: 50%;
  right: 64px;
  transform: translateY(-50%);
  width: 200px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(var(--shadow-rgb), 0.16);
  padding: 16px;
  z-index: 210;
}

.slide-left-enter-active, .slide-left-leave-active {
  transition: opacity 0.2s, transform 0.2s ease;
}
.slide-left-enter-from, .slide-left-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(12px);
}

.sn-overlay {
  position: fixed; inset: 0;
  z-index: -1;
}

@media (max-width: 768px) {
  .sidenav { width: 44px; padding: max(8px, env(safe-area-inset-top, 0px)) 0 max(8px, env(safe-area-inset-bottom, 0px)); gap: 5px; }
  .sn-brand { width: 30px; height: 36px; margin-bottom: 2px; }
  .sn-seal { font-size: 14px; }
  .sn-btn { width: 32px; height: 32px; }
  .sn-btn svg { width: 16px; height: 16px; }
  .sn-context { font-size: 10px; max-height: 70px; }
  .sn-settings { width: 180px; right: 52px; padding: 12px; }
  .sn-layout-tag { width: 20px; height: 20px; font-size: 10px; }
}
</style>
