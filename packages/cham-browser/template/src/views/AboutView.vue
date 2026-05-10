<script setup lang="ts">
import { useI18n } from '../composables/useI18n'
import { useTitle } from '../composables/useTitle'
import { useReadingMode } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import SideNav from '../components/SideNav.vue'
import ReadingToolbar from '../components/ReadingToolbar.vue'
import { useSiteConfig } from '../composables/useSiteConfig'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const { t, locale } = useI18n()
const { layout } = useReadingMode()
const { logoUrl } = useSiteConfig()
const isVertical = computed(() => layout.value === 'vertical')
const vPageRef = ref<HTMLElement | null>(null)
const vScroll = useHorizontalScroll(vPageRef)
const router = useRouter()

useTitle(locale.value === 'en' ? 'About — Hanology' : '關於 — 漢流')

function goBack() { router.push('/') }
function goHome() { router.push('/') }
</script>

<template>
  <div v-if="isVertical" class="v-root">
    <SideNav @back="goBack" @home="goHome" />
    <div ref="vPageRef" class="v-page">
      <section class="v-about">
        <h1 class="v-about-title">關 於 漢 流</h1>
        <div class="v-divider"></div>
        <div class="v-about-body">
          <p><strong>漢流</strong>，粵音 Han-Lou，普音 Han-Liu，意為「漢學之流」。</p>
          <p>經典如水，源遠流長，世代浸潤其中，前人開源，後人受益。每一代人都能在經典的長河中，找到屬於自己的領悟。</p>
          <p><strong>Hanology</strong>，English portmanteau of <em>Han</em> + <em>anthology</em> + <em>-logy</em> (the study of). The sound "lou/liu" echoes the first syllable of "-logy" — a perfect phonetic and semantic fit.</p>
          <p>Hanology is a digital library for classical Chinese texts, designed to make the wisdom of the ages accessible in the modern world.</p>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="h-root">
    <header class="h-header">
      <button class="h-back" @click="goBack">← {{ t('nav.back') }}</button>
      <h1 class="h-page-title">關於漢流 / About Hanology</h1>
    </header>
    <div class="h-content">
      <img v-if="logoUrl" :src="logoUrl" alt="" class="h-logo" />
      <div v-else class="h-seal">漢流</div>
      <div class="h-about-block">
        <h2>漢流 · Hanology</h2>
        <p><strong>漢流</strong>，粵音 Han-Lou，普音 Han-Liu，意為「漢學之流」。</p>
        <p>經典如水，源遠流長，世代浸潤其中，前人開源，後人受益。每一代人都能在經典的長河中，找到屬於自己的領悟。</p>
      </div>
      <div class="h-about-block">
        <h2>Hanology</h2>
        <p>English portmanteau of <em>Han</em> + <em>anthology</em> + <em>-logy</em> (the study of).</p>
        <p>The sound "lou/liu" echoes the first syllable of "-logy" — a perfect phonetic and semantic fit. Just as the classics flow through generations, Hanology aims to carry that stream into the digital age.</p>
      </div>
      <div class="h-about-block">
        <h2>Our Mission</h2>
        <p>Hanology is a digital library for classical Chinese texts. We believe that the wisdom of antiquity should not be locked behind impenetrable editions or forgotten in dusty shelves. By combining rigorous scholarship with thoughtful design, we make the classics accessible, beautiful, and alive for every reader.</p>
      </div>
    </div>
    <ReadingToolbar />
  </div>
</template>

<style scoped>
/* ═══════ 直排模式 ═══════ */
.v-page {
  height: 100vh;
  display: flex;
  flex-direction: row-reverse;
  overflow-x: auto;
  overflow-y: hidden;
  margin-right: var(--nav-width, 56px);
  padding: 0 32px;
  background: var(--paper);
  scrollbar-width: thin;
  scrollbar-color: var(--gold) transparent;
}
.v-page::-webkit-scrollbar { height: 4px; }
.v-page::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.v-about {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 24px;
}
.v-about-title {
  font-size: 48px; font-weight: 900;
  letter-spacing: 16px; color: var(--ink);
  margin-left: 20px; padding-left: 20px;
  border-left: 4px solid var(--vermillion);
  line-height: 1.6;
}
.v-divider {
  width: 2px; height: 80px;
  background: linear-gradient(180deg, transparent, var(--gold), transparent);
  margin-left: 20px;
}
.v-about-body {
  font-size: 16px; line-height: 2.4;
  color: var(--ink-mid);
  max-height: 80vh;
  overflow-x: auto;
}
.v-about-body p {
  margin-left: 16px;
  text-indent: 0;
}

/* ═══════ 橫排模式 ═══════ */
.h-root { max-width: 960px; margin: 0 auto; padding: 40px 24px 120px; }
.h-header {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 40px; padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.h-back {
  padding: 6px 16px; border: 1px solid var(--border);
  border-radius: 2px; background: none;
  font-family: var(--sans); font-size: 13px;
  color: var(--ink-mid); cursor: pointer;
  transition: all 0.2s;
}
.h-back:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.h-page-title { font-size: 20px; font-weight: 700; letter-spacing: 2px; }

.h-content { max-width: 680px; margin: 0 auto; }
.h-logo {
  height: 80px;
  width: auto;
  object-fit: contain;
  margin: 0 auto 40px;
  display: block;
}
.h-seal {
  writing-mode: vertical-rl;
  text-orientation: upright;
  display: inline-flex;
  align-items: center; justify-content: center;
  width: 56px; height: 72px;
  border: 2px solid var(--vermillion);
  color: var(--vermillion);
  font-size: 24px; font-family: var(--serif);
  font-weight: 900; letter-spacing: 2px;
  margin: 0 auto 40px; border-radius: 4px;
  line-height: 1;
}
.h-about-block {
  margin-bottom: 40px; padding: 32px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}
.h-about-block:last-child { margin-bottom: 0; }
.h-about-block h2 {
  font-size: 20px; font-weight: 700;
  letter-spacing: 3px; color: var(--ink);
  margin-bottom: 16px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.h-about-block p {
  font-size: 16px; line-height: 2.2;
  color: var(--ink-mid); text-align: justify;
  text-indent: 2em; margin-bottom: 12px;
}
.h-about-block p:last-child { margin-bottom: 0; }

@media (max-width: 768px) {
  .h-root { padding: 24px 16px 80px; }
  .h-about-block { padding: 20px; }
}
</style>
