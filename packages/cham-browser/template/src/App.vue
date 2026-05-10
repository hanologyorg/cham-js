<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useReadingMode } from './composables/useReadingMode'
import { useSiteConfig } from './composables/useSiteConfig'
import ReadingToolbar from './components/ReadingToolbar.vue'
import { computed, ref, provide } from 'vue'

const router = useRouter()
const { toggleLayout, cycleTheme, layout } = useReadingMode()
const { logoUrl, aboutHtml } = useSiteConfig()
const isVertical = computed(() => layout.value === 'vertical')

const aboutOpen = ref(false)
function toggleAbout() { aboutOpen.value = !aboutOpen.value }
function closeAbout() { aboutOpen.value = false }
provide('aboutPane', { toggleAbout, closeAbout })

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
    <router-view v-slot="{ Component, route }">
      <Suspense :key="route.fullPath">
        <component :is="Component" />
        <template #fallback>
          <div class="route-loading"></div>
        </template>
      </Suspense>
    </router-view>
    <!-- 橫排模式才顯示浮動設定鈕 -->
    <ReadingToolbar v-if="!isVertical" />

    <!-- About overlay (only if about content is configured) -->
    <Teleport v-if="aboutHtml" to="body">
      <div v-if="aboutOpen" class="about-overlay" @click="closeAbout">
        <div v-if="isVertical" class="about-pane-v" @click.stop>
          <button class="about-close" @click="closeAbout">✕</button>
          <div class="about-v-body" v-html="aboutHtml" />
        </div>

        <div v-else class="about-pane-h" @click.stop>
          <button class="about-close" @click="closeAbout">✕</button>
          <img v-if="logoUrl" :src="logoUrl" alt="" class="about-logo" />
          <div class="about-h-body" v-html="aboutHtml" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style>
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
  transition: all 0.15s; z-index: 1;
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
  height: 100vh;
  background: var(--paper);
  padding: 32px 28px;
  overflow-x: auto;
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
</style>
