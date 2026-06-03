<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useReadingMode } from './composables/useReadingMode'
import { useSiteConfig } from './composables/useSiteConfig'
import { useI18n } from './composables/useI18n'
import ReadingToolbar from './components/ReadingToolbar.vue'
import { computed, ref, watch, provide } from 'vue'
import { useFocusTrap } from './composables/useFocusTrap'
import { useAnnounce } from './composables/useAnnounce'

const router = useRouter()
const { toggleLayout, cycleTheme, layout } = useReadingMode()
const { logoUrl, aboutHtml } = useSiteConfig()
const { locale, t } = useI18n()
const isVertical = computed(() => layout.value === 'vertical')

const { message: announceMessage } = useAnnounce()

const CHAM_VERSION = import.meta.env.CHAM_VERSION || ''
const CHAM_BROWSER_VERSION = import.meta.env.CHAM_BROWSER_VERSION || ''

const aboutPaneRef = ref<HTMLElement | null>(null)
const aboutOpen = ref(false)
useFocusTrap(aboutPaneRef, aboutOpen)
function toggleAbout() { aboutOpen.value = !aboutOpen.value }
function closeAbout() { aboutOpen.value = false }
provide('aboutPane', { toggleAbout, closeAbout })

function filterAboutByLocale(html: string, loc: string): string {
  return html.replace(/<div\s+class="about-block"(\s+lang="([^"]*)")?[^>]*>([\s\S]*?)<\/div>\s*/g,
    (_match, _attr, lang, _content) => {
      if (!lang || lang === loc) return _match
      return ''
    })
}

const filteredAboutHtml = computed(() => {
  if (!aboutHtml) return ''
  let html = filterAboutByLocale(aboutHtml, locale.value)
  if (CHAM_VERSION || CHAM_BROWSER_VERSION) {
    const versionLine = `<div class="about-versions"><span>v${[CHAM_BROWSER_VERSION, CHAM_VERSION].filter(Boolean).join(' / cham@')}</span></div>`
    html += versionLine
  }
  return html
})

function onKey(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  if (event.key === 'Escape') {
    if (aboutOpen.value) { closeAbout(); return }
    router.push('/')
  }
  if (event.key === 'v' || event.key === 'V') toggleLayout()
  if (event.key === 't' || event.key === 'T') cycleTheme()
}
</script>

<template>
  <div @keydown="onKey">
    <a href="#main" class="skip-link">Skip to content</a>
    <router-view v-slot="{ Component, route }">
      <Suspense>
        <component :is="Component" :key="route.fullPath" id="main" />
        <template #fallback>
          <div class="route-loading">
            <div class="route-loading-logo-wrap">
              <img v-if="logoUrl" :src="logoUrl" alt="" class="route-loading-logo route-loading-logo--gray" />
              <img v-if="logoUrl" :src="logoUrl" alt="" class="route-loading-logo route-loading-logo--fill" />
              <template v-else>
                <span class="route-loading-seal route-loading-seal--gray">文</span>
                <span class="route-loading-seal route-loading-seal--fill">文</span>
              </template>
            </div>
          </div>
        </template>
      </Suspense>
    </router-view>
    <!-- 橫排模式才顯示浮動設定鈕 -->
    <ReadingToolbar v-if="!isVertical" />

    <!-- About overlay (only if about content is configured) -->
    <div aria-live="polite" aria-atomic="true" class="sr-only">{{ announceMessage }}</div>
    <Teleport v-if="aboutHtml" to="body">
      <div v-if="aboutOpen" class="about-overlay" @click="closeAbout">
        <div v-if="isVertical" ref="aboutPaneRef" class="about-pane-v" @click.stop>
          <button class="about-close" @click="closeAbout" :aria-label="t('action.close')">✕</button>
          <div class="about-v-body" v-html="filteredAboutHtml" />
        </div>

        <div v-else ref="aboutPaneRef" class="about-pane-h" @click.stop>
          <button class="about-close" @click="closeAbout" :aria-label="t('action.close')">✕</button>
          <img v-if="logoUrl" :src="logoUrl" alt="" class="about-logo" />
          <div class="about-h-body" v-html="filteredAboutHtml" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style>
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.page-fade-enter-active { transition: opacity 0.15s ease, transform 0.2s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)); }
.page-fade-leave-active { transition: opacity 0.1s ease; }
.page-fade-enter-from { opacity: 0; transform: translateY(8px); }
.page-fade-leave-to { opacity: 0; }

.about-overlay {
  position: fixed; inset: 0;
  background: rgba(var(--shadow-rgb), 0.3);
  z-index: 200;
  display: flex; justify-content: center; align-items: center;
  animation: aboutFadeIn 0.2s ease;
}
@keyframes aboutFadeIn { from { opacity: 0 } to { opacity: 1 } }

.about-close {
  position: absolute; top: 16px; right: 16px;
  width: 36px; height: 36px;
  border: 1px solid var(--border); border-radius: 4px;
  background: none; font-size: 16px;
  color: var(--ink-light); cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease; z-index: 1;
}
.about-close:hover { background: var(--ink); color: var(--paper); border-color: var(--ink) }

/* Horizontal pane */
.about-pane-h {
  position: relative;
  width: min(600px, 90vw);
  max-height: 85vh;
  background: var(--paper);
  border-radius: 12px;
  padding: 40px;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(var(--shadow-rgb), 0.15);
  animation: aboutSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes aboutSlideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }

.about-logo { height: 64px; width: auto; object-fit: contain; margin: 0 auto 32px; display: block }
.about-h-body {
  font-size: 15px; line-height: 2.2; color: var(--ink-mid);
}
.about-h-body :deep(h2) {
  font-size: 18px; font-weight: 700; letter-spacing: 3px; color: var(--ink);
  margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
}
.about-h-body :deep(p) {
  text-align: justify; text-indent: 2em; margin-bottom: 10px;
}
.about-h-body :deep(p:last-child) { margin-bottom: 0 }
.about-h-body :deep(.about-block) {
  margin-bottom: 32px; padding: 28px;
  background: var(--surface); border: 1px solid var(--border-light); border-radius: 8px;
}
.about-h-body :deep(.about-block:last-child) { margin-bottom: 0 }

/* Vertical pane */
.about-pane-v {
  writing-mode: vertical-rl; text-orientation: mixed;
  position: relative;
  height: 100dvh;
  background: var(--paper);
  padding: 32px 28px;
  overflow-x: auto;
  overscroll-behavior: contain;
  box-shadow: 8px 0 32px rgba(var(--shadow-rgb), 0.1);
  animation: aboutSlideInV 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes aboutSlideInV { from { transform: translateX(-100%) } to { transform: translateX(0) } }
.about-pane-v .about-close { position: static; margin-bottom: 20px }
.about-v-body {
  font-size: 16px; line-height: 2.4; color: var(--ink-mid);
  max-height: 80vh; overflow-x: auto;
}
.about-v-body :deep(p) { margin-left: 16px; text-indent: 0 }
.about-v-body :deep(.about-versions) { margin-left: 16px; padding-top: 24px; border-top: 1px solid var(--border-light) }

.about-versions {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.route-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
}
.route-loading-logo-wrap {
  position: relative;
  width: 56px;
  height: 56px;
}
.route-loading-logo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.route-loading-logo--gray {
  filter: grayscale(1) opacity(0.3);
}
.route-loading-logo--fill {
  clip-path: inset(100% 0 0 0);
  animation: logoFillUp 1.8s ease-in-out infinite;
}
.route-loading-seal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 900;
}
.route-loading-seal--gray {
  color: var(--ink-faint);
}
.route-loading-seal--fill {
  color: var(--vermillion);
  clip-path: inset(100% 0 0 0);
  animation: logoFillUp 1.8s ease-in-out infinite;
}
@keyframes logoFillUp {
  0% { clip-path: inset(100% 0 0 0); }
  100% { clip-path: inset(0% 0 0 0); }
}
</style>
