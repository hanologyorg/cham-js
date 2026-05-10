<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBook } from '../composables/useBook'
import { useTitle } from '../composables/useTitle'
import { useReadingMode } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import PoemCard from '../components/PoemCard.vue'
import SideNav from '../components/SideNav.vue'
import ReadingToolbar from '../components/ReadingToolbar.vue'

const props = defineProps<{ bookId: string }>()
const router = useRouter()
const { pieces, meta, load } = useBook()
await load(props.bookId)

const searchQuery = ref('')
useTitle(meta.value?.title || '')

const { layout } = useReadingMode()
const isVertical = computed(() => layout.value === 'vertical')
const vPageRef = ref<HTMLElement | null>(null)
const vScroll = useHorizontalScroll(vPageRef)

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

function tcy(n: number): string {
  const s = String(n)
  return `<span class="tcy">${s}</span>`
}

function heroHtml(template: string): string {
  return template
    .replace('{count}', tcy(pieces.value.length))
    .replace('{authorCount}', tcy(authorCount.value))
}

function openPiece(num: number) {
  router.push(`/${props.bookId}/${num}`)
}

function scrollToCatalog() {
  document.querySelector('.h-catalog')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <!-- ═══════ 直排模式 ═══════ -->
  <div v-if="isVertical" class="v-root">
    <SideNav @home="router.push('/')" @back="router.push('/')" />
    <div ref="vPageRef" class="v-page">
      <section class="v-hero">
        <div class="v-ornament">◆ ◇ ◆</div>
        <h1 class="v-title">{{ meta?.title }}</h1>
        <p class="v-subtitle">{{ meta?.subtitle }}</p>
        <span v-if="meta?.publisher" class="v-publisher">{{ meta.publisher }}</span>
        <div class="v-divider"></div>
        <div v-if="meta?.hero?.length" class="v-stats">
          <span v-for="line in meta.hero" :key="line" class="v-stat" v-html="heroHtml(line)" />
        </div>
      </section>

      <section class="v-catalog-col">
        <span class="v-ch-title">篇 章 目 錄</span>
        <span class="v-ch-line"> </span>
        <span class="v-count">共 {{ filtered.length }} 篇</span>
        <span class="v-search-wrap">
          <input v-model="searchQuery" class="v-search" placeholder="搜索詩題、作者…" />
        </span>
      </section>

      <div class="v-cards-col">
        <PoemCard
          v-for="piece in filtered"
          :key="piece.num"
          :poem="piece"
          :vertical="true"
          class="v-card"
          @click="openPiece(piece.num)"
        />
      </div>
    </div>
  </div>

  <!-- ═══════ 橫排模式 ═══════ -->
  <div v-else class="h-root">
    <section class="h-hero">
      <div class="h-hero-inner">
        <div class="h-ornament">◆ ◇ ◆</div>
        <h1 class="h-title">{{ meta?.title }}</h1>
        <p class="h-subtitle">{{ meta?.subtitle }}</p>
        <div class="h-divider"></div>
        <div class="h-stats">
          <div class="h-stat-block">
            <div class="h-stat-num">{{ pieces.length }}</div>
            <div class="h-stat-label">篇詩文</div>
          </div>
          <div class="h-stat-block">
            <div class="h-stat-num">{{ authorCount }}</div>
            <div class="h-stat-label">位作者</div>
          </div>
        </div>
        <p v-if="meta?.publisher" class="h-publisher">{{ meta.publisher }}</p>
        <button class="h-cta" @click="scrollToCatalog">
          進 入 文 庫 ↓
        </button>
      </div>
    </section>

    <section class="h-catalog">
      <div class="h-catalog-header">
        <h2>篇 章 目 錄</h2>
        <div class="h-line"></div>
        <p v-if="meta?.publisher">{{ meta.publisher }}</p>
      </div>
      <div class="h-filter">
        <input v-model="searchQuery" class="h-search" placeholder="搜索詩題、作者…" />
      </div>
      <div class="h-grid">
        <PoemCard
          v-for="piece in filtered"
          :key="piece.num"
          :poem="piece"
          @click="openPiece(piece.num)"
        />
      </div>
    </section>

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
  background: linear-gradient(90deg, var(--paper) 0%, var(--paper-warm) 100%);
  scrollbar-width: thin;
  scrollbar-color: var(--gold) transparent;
  scroll-snap-type: x proximity;
}
.v-page::-webkit-scrollbar { height: 4px; }
.v-page::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.v-hero {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
}
.v-ornament {
  font-size: 36px; color: var(--vermillion);
  opacity: 0.6; letter-spacing: 12px; margin-left: 24px;
}
.v-title {
  font-size: 56px; font-weight: 900;
  letter-spacing: 16px; color: var(--ink);
  margin-left: 20px; padding-left: 20px;
  border-left: 4px solid var(--vermillion);
  line-height: 1.6;
}
.v-subtitle {
  font-size: 18px; font-weight: 300;
  color: var(--ink-light); letter-spacing: 6px;
  margin-left: 16px; font-family: var(--sans);
}
.v-divider {
  width: 2px; height: 80px;
  background: linear-gradient(180deg, transparent, var(--gold), transparent);
  margin-left: 20px;
}
.v-stats { display: flex; flex-direction: column; gap: 16px; margin-left: 16px; }
.v-stat {
  font-size: 22px; font-weight: 200;
  color: var(--ink); letter-spacing: 4px; white-space: nowrap;
}
.v-stat :deep(.tcy) {
  text-combine-upright: all;
}
.v-publisher {
  font-size: 14px; font-weight: 300;
  color: var(--ink-faint); letter-spacing: 3px;
  margin-left: 16px; font-family: var(--sans);
}

.v-catalog-col {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100vh;
  padding: 40px 16px;
  border-right: 1px solid var(--border);
  display: flex;
  align-items: center;
}
.v-ch-title {
  font-size: 28px; font-weight: 700;
  letter-spacing: 8px; color: var(--ink);
  margin-left: 16px;
}
.v-ch-line {
  display: inline-block;
  width: 2px; height: 40px;
  background: var(--vermillion);
  margin-left: 16px;
}
.v-count {
  font-size: 14px; color: var(--ink-light);
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
.v-search::placeholder {
  color: var(--ink-faint);
}

.v-cards-col {
  flex-shrink: 0;
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(auto-fill, 240px);
  gap: 12px;
  padding: 24px 16px;
  height: 100vh;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
  direction: rtl;
  align-items: start;
}

.v-card {
  flex-shrink: 0;
}

/* ═══════ 橫排模式 ═══════ */

.h-hero {
  position: relative;
  height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%);
  overflow: hidden;
}
.h-hero::before {
  content: '';
  position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0v60M0 30h60' stroke='%23d8cdb8' stroke-width='.3' fill='none'/%3E%3C/svg%3E") repeat;
  opacity: 0.3;
  pointer-events: none;
}
.h-hero-inner { position: relative; z-index: 1; text-align: center; }
.h-ornament {
  font-size: 48px; color: var(--vermillion);
  opacity: 0.6; letter-spacing: 20px; margin-bottom: 32px;
}
.h-title {
  font-size: clamp(36px, 6vw, 64px);
  font-weight: 900; letter-spacing: 12px;
  color: var(--ink); margin-bottom: 12px;
}
.h-subtitle {
  font-size: clamp(14px, 2vw, 18px);
  font-weight: 300; color: var(--ink-light);
  letter-spacing: 6px; margin-bottom: 48px;
  font-family: var(--sans);
}
.h-divider {
  width: 120px; height: 2px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  margin: 0 auto 48px;
}
.h-stats { display: flex; gap: 48px; justify-content: center; margin-bottom: 48px; }
.h-stat-num { font-size: 36px; font-weight: 200; color: var(--ink); letter-spacing: 2px; }
.h-stat-label {
  font-size: 12px; color: var(--ink-faint);
  letter-spacing: 4px; font-family: var(--sans);
  margin-top: 4px; text-align: center;
}
.h-publisher {
  font-size: 14px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 3px;
  margin-bottom: 48px;
}
.h-cta {
  display: inline-flex; align-items: center; gap: 12px;
  padding: 14px 40px;
  background: var(--ink); color: var(--paper);
  font-family: var(--sans); font-size: 15px;
  font-weight: 500; letter-spacing: 3px;
  border: none; border-radius: 2px; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.h-cta:hover {
  background: var(--vermillion);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(var(--shadow-rgb), 0.12);
}

.h-catalog { max-width: 1200px; margin: 0 auto; padding: 80px 40px; }
.h-catalog-header { text-align: center; margin-bottom: 60px; }
.h-catalog-header h2 { font-size: 28px; font-weight: 700; letter-spacing: 8px; color: var(--ink); margin-bottom: 8px; }
.h-catalog-header .h-line { width: 60px; height: 2px; background: var(--vermillion); margin: 16px auto; }
.h-catalog-header p { font-size: 14px; color: var(--ink-faint); font-family: var(--sans); letter-spacing: 2px; }
.h-filter { display: flex; justify-content: center; margin-bottom: 40px; }
.h-search {
  padding: 10px 20px; border: 1px solid var(--border);
  border-radius: 2px; background: var(--surface);
  font-family: var(--sans); font-size: 14px;
  color: var(--ink); width: 320px; outline: none;
}
.h-search:focus { border-color: var(--gold); }
.h-search::placeholder { color: var(--ink-faint); }
.h-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .h-stats { gap: 24px; }
  .h-stat-num { font-size: 28px; }
  .h-catalog { padding: 40px 20px; }
  .h-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
  .h-search { width: 100%; }
  .v-page { padding: 0 16px; }
  .v-cards-col {
    padding: 16px 8px;
    gap: 10px;
  }
  .v-search { height: 160px; }
}
</style>
