<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBook } from '../composables/useBook'
import { useTitle } from '../composables/useTitle'
import { useReadingMode } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import { useI18n } from '../composables/useI18n'
import { tcy } from '../utils/tcy'
import SideNav from '../components/SideNav.vue'
import ReadingToolbar from '../components/ReadingToolbar.vue'
import BackToTop from '../components/BackToTop.vue'
import type { Piece } from '../types'

const props = defineProps<{ bookId: string }>()
const router = useRouter()

const { pieces, meta, load } = useBook()
await load(props.bookId)

useTitle(meta.value?.title || '')

const { layout } = useReadingMode()
const isVertical = computed(() => layout.value === 'vertical')
const vPageRef = ref<HTMLElement | null>(null)
useHorizontalScroll(vPageRef)
const { t } = useI18n()

const searchQuery = ref('')

function eraOf(p: Piece): string {
  return p.era || p.dynasty || ''
}

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return pieces.value
  return pieces.value.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.author.toLowerCase().includes(q) ||
    p.verses.some(v => v.text.toLowerCase().includes(q))
  )
})

const authorCount = computed(() => new Set(pieces.value.map(p => p.author)).size)

function heroHtml(template: string): string {
  return template
    .replace('{count}', tcy(pieces.value.length))
    .replace('{authorCount}', tcy(authorCount.value))
}

function previewText(p: Piece): string {
  return p.verses.slice(0, 2).map(v => v.text).join('\n')
}

function scrollToCatalog() {
  document.querySelector('.h-catalog')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <!-- ═══════ 直排模式 ═══════ -->
  <div v-if="isVertical && meta" class="v-root">
    <SideNav has-back @home="router.push('/')" @back="router.push('/')" />
    <div ref="vPageRef" class="v-page">
      <!-- Hero -->
      <section class="v-hero">
        <div class="v-ornament">◆ ◇ ◆</div>
        <h1 class="v-title">{{ meta.title }}</h1>
        <p v-if="meta.subtitle" class="v-subtitle">{{ meta.subtitle }}</p>
        <span v-if="meta.publisher" class="v-publisher">{{ meta.publisher }}</span>
        <div class="v-divider"></div>
        <div v-if="meta.hero?.length" class="v-stats">
          <span v-for="line in meta.hero" :key="line" class="v-stat" v-html="heroHtml(line)" />
        </div>
      </section>

      <!-- Catalog navigation column -->
      <section class="v-catalog-col">
        <span class="v-ch-title">{{ t('catalog.title') }}</span>
        <span class="v-ch-line"> </span>
        <span class="v-count">{{ t('catalog.total', { count: filtered.length }) }}</span>
        <span class="v-search-wrap">
          <input v-model="searchQuery" class="v-search" :placeholder="t('catalog.search')" :aria-label="t('catalog.search')" />
        </span>
      </section>

      <!-- Piece cards -->
      <div class="v-cards-col">
        <router-link
          v-for="piece in filtered"
          :key="piece.num"
          custom
          :to="`/${bookId}/${piece.num}`"
          v-slot="{ navigate }"
        >
          <div
            class="v-card v-card-anim"
            tabindex="0"
            @click="navigate"
            @keydown.enter="navigate"
            @keydown.space.prevent="navigate"
          >
            <div class="v-card-accent"></div>
            <div class="v-card-body">
              <div class="v-card-num">{{ String(piece.num).padStart(3, '0') }}</div>
              <h3 class="v-card-title">{{ piece.title }}</h3>
              <div class="v-card-author">{{ piece.author }}</div>
            </div>
          </div>
        </router-link>
      </div>

      <div v-if="searchQuery && filtered.length === 0" class="v-empty">
        <span class="v-empty-text">{{ t('catalog.noResults', { query: searchQuery }) }}</span>
      </div>
    </div>
  </div>

  <!-- ═══════ 橫排模式 ═══════ -->
  <div v-else-if="meta" class="h-root">
    <!-- Hero -->
    <section class="h-hero">
      <div class="h-hero-inner">
        <div class="h-ornament">◆ ◇ ◆</div>
        <h1 class="h-title">{{ meta.title }}</h1>
        <p v-if="meta.subtitle" class="h-subtitle">{{ meta.subtitle }}</p>
        <div class="h-divider"></div>
        <div class="h-stats">
          <div class="h-stat-block">
            <div class="h-stat-num">{{ pieces.length }}</div>
            <div class="h-stat-label">{{ t('stat.piecePoems') }}</div>
          </div>
          <div class="h-stat-block">
            <div class="h-stat-num">{{ authorCount }}</div>
            <div class="h-stat-label">{{ t('stat.authorsLabel') }}</div>
          </div>
        </div>
        <p v-if="meta.publisher" class="h-publisher">{{ meta.publisher }}</p>
        <button class="h-cta" @click="scrollToCatalog">
          {{ t('catalog.enterLibrary') }}
        </button>
      </div>
    </section>

    <!-- Catalog -->
    <section class="h-catalog">
      <div class="h-catalog-header">
        <h2>{{ t('catalog.title') }}</h2>
        <div class="h-line"></div>
        <p v-if="meta.publisher">{{ meta.publisher }}</p>
      </div>
      <div class="h-filter">
        <input v-model="searchQuery" class="h-search" :placeholder="t('catalog.search')" :aria-label="t('catalog.search')" />
      </div>
      <div class="h-grid">
        <router-link
          v-for="(piece, idx) in filtered"
          :key="piece.num"
          custom
          :to="`/${bookId}/${piece.num}`"
          v-slot="{ navigate }"
        >
          <div
            class="h-card h-card-anim"
            tabindex="0"
            :style="{ animationDelay: Math.min(idx * 0.04, 0.8) + 's' }"
            @click="navigate"
            @keydown.enter="navigate"
            @keydown.space.prevent="navigate"
          >
            <div class="h-card-accent"></div>
            <div class="h-card-body">
              <div class="h-card-num">{{ String(piece.num).padStart(3, '0') }}</div>
              <h3 class="h-card-title">{{ piece.title }}</h3>
              <div class="h-card-meta">
                <span class="h-card-author">{{ piece.author }}</span>
                <span v-if="eraOf(piece)" class="h-card-era">{{ eraOf(piece) }}</span>
              </div>
              <p v-if="previewText(piece)" class="h-card-preview">{{ previewText(piece) }}</p>
            </div>
          </div>
        </router-link>
      </div>
      <div v-if="searchQuery && filtered.length === 0" class="h-empty">
        <p>{{ t('catalog.noResults', { query: searchQuery }) }}</p>
      </div>
    </section>

    <BackToTop />
    <ReadingToolbar />
  </div>
</template>

<style scoped>
/* ═══════ 直排模式 ═══════ */

.v-page {
  padding: 0 32px;
  background: linear-gradient(90deg, var(--paper) 0%, var(--paper-warm) 100%);
}

.v-hero {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
}

.v-ornament {
  font-size: 36px;
  color: var(--vermillion);
  opacity: 0.6;
  letter-spacing: 12px;
  margin-left: 24px;
}

.v-title {
  font-size: 56px;
  font-weight: 900;
  letter-spacing: 16px;
  color: var(--ink);
  margin-left: 20px;
  padding-left: 20px;
  border-left: 4px solid var(--vermillion);
  line-height: 1.6;
}

.v-subtitle {
  font-size: 18px;
  font-weight: 300;
  color: var(--ink-light);
  letter-spacing: 6px;
  margin-left: 16px;
  font-family: var(--sans);
}

.v-divider {
  width: 2px;
  height: 80px;
  background: linear-gradient(180deg, transparent, var(--gold), transparent);
  margin-left: 20px;
}

.v-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-left: 16px;
}

.v-stat {
  font-size: 22px;
  font-weight: 200;
  color: var(--ink);
  letter-spacing: 4px;
  white-space: nowrap;
}

.v-stat :deep(.tcy) {
  text-combine-upright: all;
}

.v-publisher {
  font-size: 14px;
  font-weight: 300;
  color: var(--ink-faint);
  letter-spacing: 3px;
  margin-left: 16px;
  font-family: var(--sans);
}

/* Catalog column */
.v-catalog-col {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100dvh;
  padding: 40px 16px;
  border-right: 1px solid var(--border);
  display: flex;
  align-items: center;
}

.v-ch-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 8px;
  color: var(--ink);
  margin-left: 16px;
}

.v-ch-line {
  display: inline-block;
  width: 2px;
  height: 40px;
  background: var(--vermillion);
  margin-left: 16px;
}

.v-count {
  font-size: 14px;
  color: var(--ink-light);
  letter-spacing: 2px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--border);
}

.v-search-wrap {
  margin-left: 12px;
}

.v-search {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 12px 8px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--surface);
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink);
  height: 200px;
  width: 36px;
  outline: none;
  text-align: start;
}

.v-search:focus { border-color: var(--gold); }
.v-search::placeholder { color: var(--ink-faint); }

/* Vertical cards */
.v-cards-col {
  flex-shrink: 0;
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(auto-fill, 180px);
  gap: 10px;
  padding: 24px 16px;
  height: 100dvh;
  box-sizing: border-box;
  direction: rtl;
  align-items: start;
}

.v-card {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  direction: ltr;
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  width: 140px;
  min-height: 180px;
  flex-shrink: 0;
  align-self: start;
  justify-self: start;
}

.v-card:hover {
  transform: translateX(-4px);
  box-shadow: 0 8px 28px rgba(var(--shadow-rgb), 0.1);
  border-color: var(--gold);
}

.v-card:active { transform: scale(0.98); }

.v-card-accent {
  position: absolute;
  top: auto;
  left: 0;
  bottom: 0;
  width: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--gold), var(--vermillion));
  transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.v-card:hover .v-card-accent { width: 100%; height: 3px; }
.v-card:hover .v-card-title { color: var(--vermillion); }

.v-card-body {
  padding: 16px 20px 24px;
  box-sizing: border-box;
  overflow: hidden;
  height: auto;
  -webkit-mask-image: linear-gradient(to left, black 80%, transparent);
  mask-image: linear-gradient(to left, black 80%, transparent);
}

.v-card-num {
  font-size: 11px;
  color: var(--ink-faint);
  font-family: var(--sans);
  letter-spacing: 2px;
  margin-bottom: 0;
  margin-left: 6px;
  display: block;
  text-combine-upright: all;
}

.v-card-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink);
  margin-bottom: 0;
  margin-left: 6px;
  display: block;
  transition: color 0.25s ease;
}

.v-card-author {
  font-size: 13px;
  color: var(--ink-light);
  font-family: var(--sans);
  letter-spacing: 2px;
  margin-top: 0;
  margin-left: 4px;
  display: block;
}

.v-card-anim {
  animation: cardEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ═══════ 橫排模式 ═══════ */

.h-hero {
  position: relative;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%);
  overflow: hidden;
}

.h-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0v60M0 30h60' stroke='%23d8cdb8' stroke-width='.3' fill='none'/%3E%3C/svg%3E") repeat;
  opacity: 0.3;
  pointer-events: none;
}

.h-hero-inner {
  position: relative;
  z-index: 1;
  text-align: center;
}

.h-ornament {
  font-size: 48px;
  color: var(--vermillion);
  opacity: 0.6;
  letter-spacing: 20px;
  margin-bottom: 32px;
}

.h-title {
  font-size: clamp(36px, 6vw, 64px);
  font-weight: 900;
  letter-spacing: 12px;
  color: var(--ink);
  margin-bottom: 12px;
}

.h-subtitle {
  font-size: clamp(14px, 2vw, 18px);
  font-weight: 300;
  color: var(--ink-light);
  letter-spacing: 6px;
  margin-bottom: 48px;
  font-family: var(--sans);
}

.h-divider {
  width: 120px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  margin: 0 auto 48px;
}

.h-stats {
  display: flex;
  gap: 48px;
  justify-content: center;
  margin-bottom: 48px;
}

.h-stat-num {
  font-size: 36px;
  font-weight: 200;
  color: var(--ink);
  letter-spacing: 2px;
}

.h-stat-label {
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 4px;
  font-family: var(--sans);
  margin-top: 4px;
  text-align: center;
}

.h-publisher {
  font-size: 14px;
  color: var(--ink-faint);
  font-family: var(--sans);
  letter-spacing: 3px;
  margin-bottom: 48px;
}

.h-cta {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 40px;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--sans);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 3px;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.h-cta:hover {
  background: var(--vermillion);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(var(--shadow-rgb), 0.12);
}

.h-cta:active {
  transform: scale(0.97);
  box-shadow: 0 4px 12px rgba(var(--shadow-rgb), 0.08);
}

/* Catalog */
.h-catalog {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 40px;
}

.h-catalog-header {
  text-align: center;
  margin-bottom: 60px;
}

.h-catalog-header h2 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 8px;
  color: var(--ink);
  margin-bottom: 8px;
}

.h-line {
  width: 60px;
  height: 2px;
  background: var(--vermillion);
  margin: 16px auto;
}

.h-catalog-header p {
  font-size: 14px;
  color: var(--ink-faint);
  font-family: var(--sans);
  letter-spacing: 2px;
}

.h-filter {
  display: flex;
  justify-content: center;
  margin-bottom: 40px;
}

.h-search {
  padding: 10px 20px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--surface);
  font-family: var(--sans);
  font-size: 14px;
  color: var(--ink);
  width: 320px;
  outline: none;
}

.h-search:focus { border-color: var(--gold); }
.h-search::placeholder { color: var(--ink-faint); }

.h-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.h-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.h-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(var(--shadow-rgb), 0.1);
  border-color: var(--gold);
}

.h-card:active { transform: scale(0.98); }

.h-card-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 0;
  background: linear-gradient(180deg, var(--vermillion), var(--gold));
  transition: height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.h-card:hover .h-card-accent { height: 100%; }
.h-card:hover .h-card-title { color: var(--vermillion); }

.h-card-body { padding: 24px; }

.h-card-num {
  font-size: 11px;
  color: var(--ink-faint);
  font-family: var(--sans);
  letter-spacing: 2px;
  margin-bottom: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  background: var(--surface-warm);
}

.h-card-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 6px;
  color: var(--ink);
  transition: color 0.25s ease;
}

.h-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-family: var(--sans);
}

.h-card-author {
  color: var(--ink-light);
  letter-spacing: 1px;
}

.h-card-era {
  color: var(--ink-faint);
  letter-spacing: 0.5px;
  padding-left: 6px;
  border-left: 1px solid var(--border-light);
}

.h-card-preview {
  font-size: 13px;
  color: var(--ink-faint);
  margin-top: 14px;
  line-height: 1.7;
  overflow: hidden;
  white-space: pre-line;
}

.h-card-anim {
  animation: cardEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Empty states */
.v-empty {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.v-empty-text {
  font-size: 14px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  font-family: var(--sans);
}

.h-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--ink-faint);
  font-family: var(--sans);
  font-size: 15px;
  letter-spacing: 1px;
}

/* Responsive */
@media (max-width: 768px) {
  .v-page { padding: 0 16px; }
  .v-hero { padding: 20px 12px; }
  .v-title { font-size: 40px; letter-spacing: 10px; }
  .v-ornament { font-size: 28px; letter-spacing: 8px; }
  .v-catalog-col { padding: 24px 12px; }
  .v-ch-title { font-size: 22px; }
  .v-search { height: 160px; }
  .v-cards-col { padding: 16px 8px; gap: 8px; }
  .v-card { width: 120px; min-height: 160px; }
  .v-card-title { font-size: 20px; letter-spacing: 3px; }

  .h-hero { min-height: 80vh; height: auto; padding: 60px 16px; }
  .h-ornament { font-size: 32px; letter-spacing: 12px; margin-bottom: 20px; }
  .h-subtitle { margin-bottom: 32px; }
  .h-divider { margin-bottom: 32px; }
  .h-stats { gap: 24px; margin-bottom: 32px; }
  .h-stat-num { font-size: 28px; }
  .h-publisher { margin-bottom: 32px; }
  .h-cta { padding: 12px 32px; font-size: 14px; letter-spacing: 2px; }
  .h-catalog { padding: 40px 16px; }
  .h-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
  .h-search { width: 100%; }
}

@media (max-width: 480px) {
  .h-hero { min-height: 70vh; }
  .h-title { letter-spacing: 6px; }
  .h-cta { width: 80%; justify-content: center; }
  .h-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .h-catalog-header h2 { font-size: 22px; }
  .h-card-preview { display: none; }
}
</style>
