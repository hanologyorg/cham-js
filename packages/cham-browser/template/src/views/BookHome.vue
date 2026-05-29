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

interface AuthorGroup {
  author: string
  era: string
  pieces: Piece[]
}

const groupedByAuthor = computed<AuthorGroup[]>(() => {
  const map = new Map<string, AuthorGroup>()
  for (const piece of filtered.value) {
    if (!map.has(piece.author)) {
      map.set(piece.author, { author: piece.author, era: piece.era, pieces: [] })
    }
    map.get(piece.author)!.pieces.push(piece)
  }
  return Array.from(map.values())
})

function openPiece(num: number) {
  router.push(`/${props.bookId}/${num}`)
}
</script>

<template>
  <!-- ═══════ 直排模式 ═══════ -->
  <div v-if="isVertical && meta" class="v-root">
    <SideNav @home="router.push('/')" @back="router.push('/')" />
    <div ref="vPageRef" class="v-page">
      <section class="v-info">
        <h1 class="v-info-title">{{ meta.title }}</h1>
        <p v-if="meta.subtitle" class="v-info-sub">{{ meta.subtitle }}</p>
        <div class="v-info-divider"></div>
        <div class="v-info-stats">
          <span class="v-info-stat" v-html="tcy(pieces.length) + ' ' + t('stat.piecePoems')" />
          <span class="v-info-stat" v-html="tcy(authorCount) + ' ' + t('stat.authorsLabel')" />
        </div>
        <span class="v-search-wrap">
          <input v-model="searchQuery" class="v-search" :placeholder="t('catalog.search')" :aria-label="t('catalog.search')" />
        </span>
      </section>

      <div class="v-shelf">
        <template v-for="group in groupedByAuthor" :key="group.author">
          <div class="v-author-sep">
            <span class="v-author-name">{{ group.author }}</span>
            <span class="v-author-era">{{ group.era }}</span>
            <span class="v-author-count">{{ group.pieces.length }}</span>
          </div>
          <router-link
            v-for="piece in group.pieces"
            :key="piece.num"
            custom
            :to="`/${bookId}/${piece.num}`"
            v-slot="{ navigate }"
          >
            <div
              class="v-spine v-spine-anim"
              tabindex="0"
              @click="navigate"
              @keydown.enter="navigate"
              @keydown.space.prevent="navigate"
            >
              <span class="v-spine-title">{{ piece.title }}</span>
            </div>
          </router-link>
        </template>
      </div>

      <div v-if="searchQuery && filtered.length === 0" class="v-empty">
        <span class="v-empty-text">{{ t('catalog.noResults', { query: searchQuery }) }}</span>
      </div>
    </div>
  </div>

  <!-- ═══════ 橫排模式 ═══════ -->
  <div v-else-if="meta" class="h-root">
    <header class="h-header">
      <h1 class="h-title">{{ meta.title }}</h1>
      <p v-if="meta.subtitle" class="h-subtitle">{{ meta.subtitle }}</p>
      <div class="h-stats">
        <span>{{ pieces.length }} {{ t('stat.piecePoems') }}</span>
        <span class="h-stat-sep">·</span>
        <span>{{ authorCount }} {{ t('stat.authorsLabel') }}</span>
      </div>
    </header>

    <div class="h-search-wrap">
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
          :style="{ animationDelay: Math.min(idx * 0.03, 0.6) + 's' }"
          @click="navigate"
          @keydown.enter="navigate"
          @keydown.space.prevent="navigate"
        >
          <div class="h-card-accent"></div>
          <div class="h-card-body">
            <span class="h-card-num">{{ String(piece.num).padStart(3, '0') }}</span>
            <h3 class="h-card-title">{{ piece.title }}</h3>
            <div class="h-card-meta">
              <span class="h-card-author">{{ piece.author }}</span>
              <span class="h-card-era">{{ piece.era }}</span>
            </div>
          </div>
        </div>
      </router-link>
    </div>

    <div v-if="searchQuery && filtered.length === 0" class="h-empty">
      <p>{{ t('catalog.noResults', { query: searchQuery }) }}</p>
    </div>

    <BackToTop />
    <ReadingToolbar />
  </div>
</template>

<style scoped>
/* ═══════ 直排模式 ═══════ */

.v-info {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 20px;
  border-left: 1px solid var(--border-light);
}

.v-info-title {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: 8px;
  color: var(--ink);
  margin-left: 16px;
  padding-left: 16px;
  border-left: 3px solid var(--vermillion);
  line-height: 1.4;
}

.v-info-sub {
  font-size: 14px;
  font-weight: 300;
  color: var(--ink-light);
  letter-spacing: 3px;
  margin-left: 12px;
  font-family: var(--sans);
}

.v-info-divider {
  width: 2px;
  height: 60px;
  background: linear-gradient(180deg, transparent, var(--gold), transparent);
  margin-left: 16px;
}

.v-info-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 12px;
}

.v-info-stat {
  font-size: 14px;
  font-weight: 400;
  color: var(--ink-light);
  letter-spacing: 2px;
  white-space: nowrap;
}

.v-info-stat :deep(.tcy) {
  text-combine-upright: all;
}

.v-search-wrap {
  margin-left: 12px;
  margin-top: 16px;
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
  height: 160px;
  width: 36px;
  outline: none;
  text-align: start;
}

.v-search:focus {
  border-color: var(--gold);
}

.v-search::placeholder {
  color: var(--ink-faint);
}

.v-shelf {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--gold) transparent;
}

.v-shelf::-webkit-scrollbar { height: 3px; }
.v-shelf::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.v-author-sep {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 6px;
  flex-shrink: 0;
  gap: 6px;
}

.v-author-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--ink-light);
}

.v-author-era {
  font-size: 10px;
  font-family: var(--sans);
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.v-author-count {
  writing-mode: horizontal-tb;
  font-family: var(--sans);
  font-size: 9px;
  font-weight: 700;
  color: var(--ink-faint);
  background: var(--surface-warm);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 1px 5px;
}

.v-spine {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  height: 100dvh;
  width: 40px;
  padding: 20px 0;
  border-left: 1px solid var(--border-light);
  cursor: pointer;
  position: relative;
  box-sizing: border-box;
  transition: background 0.25s ease, width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  flex-shrink: 0;
}

.v-spine:hover {
  background: linear-gradient(90deg, rgba(var(--shadow-rgb), 0.04), rgba(var(--shadow-rgb), 0.01));
  width: 52px;
}

.v-spine:active {
  transform: scale(0.97);
}

.v-spine-anim {
  animation: spineEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes spineEnter {
  from { opacity: 0; transform: scaleX(0.6); }
  to { opacity: 1; transform: scaleX(1); }
}

.v-spine-title {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink);
  line-height: 1.5;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.v-spine:hover .v-spine-title {
  color: var(--vermillion);
}

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

/* ═══════ 橫排模式 ═══════ */

.h-root {
  max-width: 1080px;
  margin: 0 auto;
  padding: 48px 24px 120px;
}

.h-header {
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--border-light);
}

.h-title {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 900;
  letter-spacing: 8px;
  color: var(--ink);
  margin-bottom: 8px;
}

.h-subtitle {
  font-size: 14px;
  font-family: var(--sans);
  font-weight: 300;
  color: var(--ink-light);
  letter-spacing: 3px;
  margin-bottom: 16px;
}

.h-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 2px;
}

.h-stat-sep {
  color: var(--border);
}

.h-search-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.h-search {
  padding: 10px 20px;
  border: none;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  background: transparent;
  font-family: var(--sans);
  font-size: 14px;
  color: var(--ink);
  width: 320px;
  outline: none;
  transition: border-color 0.2s ease;
}

.h-search:focus {
  border-bottom-color: var(--gold);
}

.h-search::placeholder {
  color: var(--ink-faint);
}

.h-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.h-card-anim {
  animation: cardEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.h-card {
  display: flex;
  position: relative;
  padding: 16px 16px 16px 20px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
  background: var(--surface);
  overflow: hidden;
}

.h-card:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 20px rgba(var(--shadow-rgb), 0.08);
  transform: translateY(-2px);
}

.h-card:active {
  transform: scale(0.98);
}

.h-card-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 0;
  background: linear-gradient(180deg, var(--vermillion), var(--gold));
  transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.h-card:hover .h-card-accent {
  height: 100%;
}

.h-card:hover .h-card-title {
  color: var(--vermillion);
}

.h-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.h-card-num {
  font-size: 10px;
  color: var(--ink-faint);
  font-family: var(--sans);
  letter-spacing: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 5px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  background: var(--surface-warm);
  width: fit-content;
}

.h-card-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink);
  transition: color 0.2s ease;
}

.h-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
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

.h-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--ink-faint);
  font-family: var(--sans);
  font-size: 14px;
  letter-spacing: 1px;
}

@media (max-width: 768px) {
  .v-info { padding: 20px 12px; }
  .v-info-title { font-size: 28px; letter-spacing: 5px; }
  .v-spine { width: 36px; }
  .v-spine:hover { width: 46px; }
  .v-spine-title { font-size: 12px; letter-spacing: 2px; }
  .v-search { height: 120px; }

  .h-root { padding: 32px 16px 80px; }
  .h-header { margin-bottom: 20px; padding-bottom: 20px; }
  .h-title { letter-spacing: 4px; }
  .h-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .h-card { padding: 12px 12px 12px 16px; }
  .h-card-title { font-size: 16px; letter-spacing: 2px; }
  .h-card-era { display: none; }
  .h-search { width: 100%; }
}

@media (max-width: 480px) {
  .h-grid { grid-template-columns: 1fr 1fr; }
  .h-card-title { font-size: 15px; }
  .h-card-num { display: none; }
}
</style>
