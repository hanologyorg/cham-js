<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLibrary } from '../composables/useLibrary'
import { useBook } from '../composables/useBook'
import { useData } from '../composables/useData'
import { useTitle } from '../composables/useTitle'
import { useReadingMode } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import { useI18n } from '../composables/useI18n'
import SideNav from '../components/SideNav.vue'
import BackToTop from '../components/BackToTop.vue'
import type { Piece } from '../types'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const { loadLibrary, books, singleBook } = useLibrary()
await loadLibrary()

const { loadShared, getAuthor } = useData()
await loadShared()

const { load, getPiecesByAuthor, meta } = useBook()
const bookId = singleBook.value?.id || books.value[0]?.id
if (bookId) await load(bookId)

const { layout } = useReadingMode()
const isVertical = computed(() => layout.value === 'vertical')
const vPageRef = ref<HTMLElement | null>(null)
useHorizontalScroll(vPageRef)

const authorName = computed(() => decodeURIComponent(String(route.params.name || '')))
const author = computed(() => getAuthor(authorName.value))
const authorPieces = computed(() => getPiecesByAuthor(authorName.value))

useTitle(`${authorName.value} — ${meta.value?.title || ''}`)

function openPiece(piece: Piece) {
  router.push(`/${piece.bookId}/${piece.num}`)
}
function goBack() { router.push('/') }
function goHome() { router.push('/') }
</script>

<template>
  <div v-if="author">
    <!-- ═══════ 直排模式 ═══════ -->
    <div v-if="isVertical" class="v-root">
      <SideNav :context="authorName" @back="goBack" @home="goHome" />
      <div ref="vPageRef" class="v-page">
        <section class="v-author-info">
          <div class="v-seal">{{ authorName.charAt(0) }}</div>
          <h1 class="v-name">{{ authorName }}</h1>
          <span v-if="author.era" class="v-era">{{ author.era }}</span>
          <span class="v-count">{{ t('author.worksCount', { count: authorPieces.length }) }}</span>
        </section>

        <section v-if="author.bio" class="v-bio">
          <div class="v-bio-label">{{ t('author.biography') }}</div>
          <div class="v-bio-text">{{ author.bio }}</div>
        </section>

        <div
          v-for="piece in authorPieces"
          :key="`${piece.bookId}-${piece.num}`"
          class="v-work"
          role="button"
          tabindex="0"
          @click="openPiece(piece)"
          @keydown.enter="openPiece(piece)" @keydown.space.prevent="openPiece(piece)"
        >
          <div class="v-work-num">{{ String(piece.num).padStart(3, '0') }}</div>
          <div class="v-work-title">{{ piece.title }}</div>
        </div>
      </div>
    </div>

    <!-- ═══════ 橫排模式 ═══════ -->
    <div v-else class="h-root">
      <div class="h-page">
        <nav class="h-nav" aria-label="piece navigation">
          <div class="h-nav-inner">
            <button class="h-back" @click="goBack">← {{ t('nav.back') }}</button>
            <div class="h-breadcrumb">
              <span class="h-sep">{{ t('role.author') }}</span>
              <span class="h-sep">·</span>
              <span class="h-author-name">{{ authorName }}</span>
            </div>
            <div class="h-controls">
              <span class="h-tag">{{ author.era || t('author.unknownEra') }}</span>
              <span class="h-tag">{{ t('stat.pieceCount', { count: authorPieces.length }) }}</span>
            </div>
          </div>
        </nav>

        <div class="h-content">
          <div class="h-hero">
            <div class="h-seal">{{ authorName.charAt(0) }}</div>
            <div class="h-info">
              <h1 class="h-name">{{ authorName }}</h1>
              <div class="h-meta">
                <span v-if="author.era" class="h-era">{{ author.era }}</span>
                <span class="h-count">{{ t('author.worksCount', { count: authorPieces.length }) }}</span>
              </div>
            </div>
          </div>

          <div v-if="author.bio" class="h-bio">
            <h3>{{ t('author.biography') }}</h3>
            <p>{{ author.bio }}</p>
          </div>

          <div class="h-works">
            <h3>{{ t('author.collectedWorks') }}</h3>
            <div class="h-grid">
              <div
                v-for="piece in authorPieces"
                :key="`${piece.bookId}-${piece.num}`"
                class="h-work"
                role="button"
                tabindex="0"
                @click="openPiece(piece)"
                @keydown.enter="openPiece(piece)" @keydown.space.prevent="openPiece(piece)"
              >
                <div class="h-work-num">{{ String(piece.num).padStart(3, '0') }}</div>
                <div class="h-work-title">{{ piece.title }}</div>
                <div class="h-work-preview">{{ piece.verses.map(v => v.text).join('').slice(0, 40) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BackToTop />
    </div>
  </div>

  <div v-else class="page-loading">
    <div class="page-loading-seal">文</div>
  </div>
</template>

<style scoped>
/* ═══════ 直排模式 ═══════ */

.v-page {
  height: 100dvh;
  display: flex;
  flex-direction: row-reverse;
  overflow-x: auto;
  overflow-y: hidden;
  margin-right: calc(var(--nav-width, 56px) + env(safe-area-inset-right, 0px));
  padding: 0 32px;
  background: var(--paper);
  scrollbar-width: thin;
  scrollbar-color: var(--gold) transparent;
}
.v-page::-webkit-scrollbar { height: 4px; }
.v-page::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.v-author-info {
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
.v-seal {
  width: 64px; height: 64px;
  border: 3px solid var(--vermillion); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 900;
  color: var(--vermillion);
  margin-left: 24px;
}
.v-name {
  font-size: 48px; font-weight: 900;
  letter-spacing: 10px; color: var(--ink);
  margin-left: 20px;
}
.v-era {
  font-size: 20px; color: var(--gold);
  font-weight: 600; letter-spacing: 4px;
  margin-left: 12px;
}
.v-count {
  font-size: 16px; color: var(--ink-faint);
  letter-spacing: 2px; margin-left: 12px;
}

.v-bio {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100dvh;
  padding: 40px 16px;
  border-right: 1px solid var(--border);
}
.v-bio-label {
  font-size: 18px; font-weight: 700;
  letter-spacing: 4px; color: var(--ink);
  margin-left: 16px; padding-left: 12px;
  border-left: 1px solid var(--border);
}
.v-bio-text {
  font-size: 16px; line-height: 2.4;
  color: var(--ink-mid);
  max-height: 80vh;
  overflow-x: auto;
}

.v-work {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 240px;
  padding: 24px 16px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  align-self: center;
}
.v-work:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
}
.v-work:active {
  transform: scale(0.97);
}
.v-work-num {
  font-size: 11px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 2px;
  margin-left: 8px;
}
.v-work-title {
  font-size: 22px; font-weight: 700;
  letter-spacing: 4px; color: var(--ink);
}

/* ═══════ 橫排模式 ═══════ */

.h-page { min-height: 100dvh; }
.h-nav {
  position: sticky; top: 0; z-index: 100;
  background: var(--paper);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-light);
  padding: 0 40px;
}
.h-nav-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center;
  height: 56px; gap: 16px;
}
.h-back {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 16px; border: 1px solid var(--border);
  border-radius: 2px; background: none;
  font-family: var(--sans); font-size: 13px;
  color: var(--ink-mid); cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
}
.h-back:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.h-breadcrumb { font-size: 15px; font-weight: 600; letter-spacing: 1px; }
.h-sep { color: var(--ink-faint); font-weight: 300; margin: 0 8px; }
.h-author-name { color: var(--ink-light); font-weight: 400; }
.h-controls { margin-left: auto; display: flex; gap: 6px; }
.h-tag {
  padding: 4px 12px; border: 1px solid var(--border);
  border-radius: 2px; font-family: var(--sans);
  font-size: 12px; color: var(--ink-light); letter-spacing: 1px;
}

.h-content {
  max-width: 1200px; margin: 0 auto; padding: 60px 40px;
}
.h-hero {
  display: flex; align-items: center; gap: 32px;
  max-width: min(680px, calc(100vw - 80px));
  margin: 0 auto 48px; padding: 40px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
}
.h-seal {
  width: 80px; height: 80px;
  border: 3px solid var(--vermillion); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 900;
  color: var(--vermillion); flex-shrink: 0;
}
.h-name { font-size: 36px; font-weight: 900; letter-spacing: 6px; color: var(--ink); }
.h-meta { display: flex; gap: 16px; margin-top: 8px; font-family: var(--sans); font-size: 14px; }
.h-era { color: var(--gold); font-weight: 600; letter-spacing: 2px; }
.h-count { color: var(--ink-faint); letter-spacing: 1px; }

.h-bio {
  max-width: min(680px, calc(100vw - 80px));
  margin: 0 auto 48px; padding: 24px 32px;
  background: var(--surface); border: 1px solid var(--border-light);
  border-radius: 8px;
}
.h-bio h3 {
  font-size: 16px; font-weight: 700;
  letter-spacing: 3px; color: var(--ink);
  margin-bottom: 16px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.h-bio p { font-size: 16px; line-height: 2.2; color: var(--ink-mid); text-align: justify; }

.h-works { max-width: min(900px, calc(100vw - 80px)); margin: 0 auto; }
.h-works h3 { font-size: 18px; font-weight: 700; letter-spacing: 3px; color: var(--ink); margin-bottom: 24px; }
.h-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.h-work {
  padding: 20px;
  background: var(--surface); border: 1px solid var(--border-light);
  border-radius: 6px; cursor: pointer;
  transition: all 0.2s ease;
}
.h-work:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
  transform: translateY(-2px);
}
.h-work:active {
  transform: scale(0.98);
}
.h-work-num { font-size: 11px; color: var(--ink-faint); font-family: var(--sans); letter-spacing: 2px; }
.h-work-title { font-size: 18px; font-weight: 700; letter-spacing: 2px; margin: 6px 0 4px; }
.h-work-preview {
  font-size: 12px; color: var(--ink-faint); line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 1;
  -webkit-box-orient: vertical; overflow: hidden;
}

@media (max-width: 768px) {
  .h-hero { flex-direction: column; text-align: center; padding: 24px; }
  .h-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .h-content { padding: 30px 20px; }
  .v-page { padding: 0 16px; margin-right: calc(var(--nav-width, 44px) + env(safe-area-inset-right, 0px)); }
}
</style>
