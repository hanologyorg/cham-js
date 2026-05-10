<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useLibrary } from '../composables/useLibrary'
import { useBook } from '../composables/useBook'
import { useTitle } from '../composables/useTitle'
import { useReadingMode } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import BookCard from '../components/BookCard.vue'
import SideNav from '../components/SideNav.vue'
import ReadingToolbar from '../components/ReadingToolbar.vue'
import BackToTop from '../components/BackToTop.vue'
import { useSiteConfig } from '../composables/useSiteConfig'
import type { BookMeta } from '../types'

const aboutPane = inject<{ toggleAbout: () => void; closeAbout: () => void }>('aboutPane')

const { scale, books, singleBook, loadLibrary } = useLibrary()
await loadLibrary()

const { siteTitle, siteSubtitle, aboutHtml, logoUrl } = useSiteConfig()
const displayTitle = siteTitle || 'CHAM'
useTitle(displayTitle)

// Single-book: redirect to book home
if (scale.value === 'single-book' && singleBook.value) {
  const router = useRouter()
  router.replace(`/${singleBook.value.id}`)
}

// Single-piece: redirect to the piece
if (scale.value === 'single-piece' && singleBook.value) {
  const router = useRouter()
  const { load } = useBook()
  await load(singleBook.value.id)
  const { pieces } = useBook()
  if (pieces.value.length === 1) {
    router.replace(`/${singleBook.value.id}/${pieces.value[0].num}`)
  }
}

const router = useRouter()
const { layout } = useReadingMode()
const isVertical = computed(() => layout.value === 'vertical')
const vPageRef = ref<HTMLElement | null>(null)
const vScroll = useHorizontalScroll(vPageRef)

const genreLabel: Record<string, string> = {
  poetry: '詩歌',
  prose: '散文',
  mixed: '綜合',
  drama: '戲曲',
}

function bookCategory(book: BookMeta): string {
  if (book.id.startsWith('skqs-')) return '四庫全書'
  if (book.id === 'primary' || book.id === 'primary-culture' || book.id === 'secondary' || book.id === 'nss') return '教材'
  return '古典文本'
}

const groupedBooks = computed(() => {
  const groups = new Map<string, BookMeta[]>()
  const order = ['教材', '古典文本', '四庫全書']
  for (const book of books.value) {
    const cat = bookCategory(book)
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(book)
  }
  return order
    .filter(cat => groups.has(cat))
    .map(cat => ({ category: cat, books: groups.get(cat)! }))
})

const totalPieces = computed(() => books.value.reduce((sum, b) => sum + b.count, 0))

const spacedTitle = computed(() => displayTitle.split('').join(' '))

function openBook(bookId: string) {
  router.push(`/${bookId}`)
}
</script>

<template>
  <div v-if="scale !== 'library'" class="loading">
    <img v-if="logoUrl" :src="logoUrl" alt="" class="loading-logo" />
    <div v-else class="loading-seal">文</div>
  </div>
  <div v-else>
    <!-- ═══════ 直排模式 ═══════ -->
    <div v-if="isVertical" class="v-root">
      <SideNav @home="router.push('/')" @back="router.push('/')" />
      <div ref="vPageRef" class="v-page">
        <div v-if="aboutHtml" class="v-about-col">
          <button class="v-about-link" @click="aboutPane?.toggleAbout()">關 於</button>
        </div>
        <section class="v-hero">
          <h1 class="v-title">{{ spacedTitle }}</h1>
          <p v-if="siteSubtitle" class="v-subtitle">{{ siteSubtitle }}</p>
          <div class="v-divider"></div>
        </section>

        <section class="v-cards-col">
          <div
            v-for="book in books"
            :key="book.id"
            class="v-book-card"
            @click="openBook(book.id)"
          >
            <div class="v-book-accent"></div>
            <h2 class="v-book-title">{{ book.title }}</h2>
            <p v-if="book.subtitle" class="v-book-sub">{{ book.subtitle }}</p>
            <div class="v-book-stats">
              <span class="v-book-count">{{ book.count }} 篇</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ═══════ 橫排模式 ═══════ -->
    <div v-else class="lib-root">
      <header class="lib-hero">
        <img v-if="logoUrl" :src="logoUrl" alt="" class="lib-logo" />
        <div v-else class="lib-seal">{{ displayTitle.slice(0, 2) }}</div>
        <h1>{{ displayTitle }} <button v-if="aboutHtml" class="lib-about-link" @click="aboutPane?.toggleAbout()">關於</button></h1>
        <p v-if="siteSubtitle" class="lib-subtitle">{{ siteSubtitle }}</p>
        <div class="lib-stats-bar">
          <span class="lib-stat">{{ books.length }} 部</span>
          <span class="lib-stat-sep">·</span>
          <span class="lib-stat">{{ totalPieces }} 篇</span>
        </div>
      </header>
      <div v-for="group in groupedBooks" :key="group.category" class="lib-group">
        <h2 class="lib-group-title">{{ group.category }}</h2>
        <div class="lib-grid">
          <div
            v-for="(book, bi) in group.books"
            :key="book.id"
            class="lib-card lib-card-anim"
            :style="{ animationDelay: bi * 0.06 + 's' }"
            @click="openBook(book.id)"
          >
            <div class="lib-card-accent"></div>
            <div class="lib-card-body">
              <div class="lib-card-top">
                <h3 class="lib-card-title">{{ book.title }}</h3>
                <span class="lib-card-genre">{{ genreLabel[book.genre] || book.genre }}</span>
              </div>
              <p v-if="book.subtitle" class="lib-card-sub">{{ book.subtitle }}</p>
              <div class="lib-card-stats">
                <span class="lib-card-count">{{ book.count }} 篇</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ReadingToolbar />
      <BackToTop />
    </div>
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
.v-about-col {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-right: 1px solid var(--border-light);
}
.v-about-link {
  font-size: 14px;
  color: var(--ink-faint);
  letter-spacing: 6px;
  font-family: var(--sans);
  padding: 12px 8px;
  border: 1px solid var(--border-light);
  border-radius: 2px;
  background: none;
  cursor: pointer;
  transition: all 0.2s;
}
.v-about-link:hover {
  color: var(--ink);
  border-color: var(--ink);
}
.v-title {
  font-size: 48px; font-weight: 900;
  letter-spacing: 16px; color: var(--ink);
  margin-left: 20px; padding-left: 20px;
  border-left: 4px solid var(--vermillion);
  line-height: 1.6;
}
.v-subtitle {
  font-size: 14px; font-weight: 300;
  color: var(--ink-faint); letter-spacing: 3px;
  margin-left: 16px; font-family: var(--sans);
}
.v-divider {
  width: 2px; height: 80px;
  background: linear-gradient(180deg, transparent, var(--gold), transparent);
  margin-left: 20px;
}

.v-cards-col {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 40px 16px;
  height: 100vh;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: flex-start;
}

.v-book-card {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 24px 16px;
  border-left: 1px solid var(--border-light);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}
.v-book-card:hover {
  background: var(--surface);
}
.v-book-accent {
  position: absolute;
  top: 0; right: 0;
  width: 0; height: 3px;
  background: var(--vermillion);
  transition: width 0.35s ease;
}
.v-book-card:hover .v-book-accent { width: 100%; }
.v-book-title {
  font-size: 32px; font-weight: 900;
  letter-spacing: 8px; color: var(--ink);
  margin-left: 16px; padding-left: 16px;
  border-left: 3px solid var(--vermillion);
  line-height: 1.6;
}
.v-book-sub {
  font-size: 14px;
  color: var(--ink-light);
  letter-spacing: 3px;
  margin-left: 12px;
  font-family: var(--sans);
}
.v-book-stats {
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--border);
}
.v-book-count {
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  font-family: var(--sans);
  padding: 2px 8px;
  background: var(--surface-warm);
  border-radius: 4px;
}

/* ═══════ 橫排模式 ═══════ */

.lib-root {
  max-width: 960px;
  margin: 0 auto;
  padding: 64px 24px 120px;
}
.lib-hero {
  text-align: center;
  margin-bottom: 48px;
}
.lib-logo {
  height: 64px;
  width: auto;
  object-fit: contain;
  margin-bottom: 24px;
}
.lib-seal {
  writing-mode: vertical-rl;
  text-orientation: upright;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px; height: 56px;
  border: 2px solid var(--vermillion);
  color: var(--vermillion);
  font-size: 20px;
  font-family: var(--serif);
  letter-spacing: 2px;
  margin-bottom: 24px;
  border-radius: 4px;
  line-height: 1;
}
.lib-hero h1 {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--ink);
  margin-bottom: 8px;
}
.lib-subtitle {
  font-size: 14px;
  font-family: var(--sans);
  color: var(--ink-faint);
  letter-spacing: 2px;
  margin-bottom: 12px;
}
.lib-stats-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--sans);
  font-size: 14px;
  color: var(--ink-light);
  letter-spacing: 2px;
}
.lib-stat-sep { color: var(--border); }

.lib-about-link {
  display: inline-block;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  padding: 4px 12px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  background: none;
  cursor: pointer;
  transition: all 0.2s;
  vertical-align: middle;
}
.lib-about-link:hover {
  color: var(--ink);
  border-color: var(--ink);
}

.lib-group { margin-bottom: 40px; }
.lib-group-title {
  font-size: 15px;
  font-family: var(--sans);
  font-weight: 600;
  color: var(--ink-light);
  letter-spacing: 3px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
}

.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.lib-card-anim {
  animation: cardEnter 0.4s var(--ease-out-expo) both;
}

.lib-card {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 20px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s var(--ease-out-expo, ease);
  position: relative;
  background: var(--surface);
  animation: cardEnter 0.5s var(--ease-out-expo, ease) both;
}
@keyframes cardEnter {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.lib-card:hover { border-color: var(--gold); box-shadow: 0 4px 20px rgba(var(--shadow-rgb), 0.1); }
.lib-card-accent {
  position: absolute;
  top: 0; left: 0;
  width: 3px; height: 0;
  background: var(--vermillion);
  transition: height 0.35s ease;
}
.lib-card:hover .lib-card-accent { height: 100%; }
.lib-card-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.lib-card-title {
  font-size: 22px; font-weight: 900;
  letter-spacing: 4px; color: var(--ink);
}
.lib-card-genre {
  font-size: 11px;
  font-family: var(--sans);
  color: var(--ink-faint);
  padding: 1px 6px;
  border: 1px solid var(--border-light);
  border-radius: 3px;
  white-space: nowrap;
}
.lib-card-sub {
  font-size: 13px; color: var(--ink-light);
  letter-spacing: 1px; font-family: var(--sans);
  margin-bottom: 12px;
}
.lib-card-stats {
  font-size: 12px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 1px;
}
.lib-card-count {
  padding: 2px 8px;
  background: var(--surface-warm);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .v-page { padding: 0 16px; }
  .v-title { font-size: 36px; letter-spacing: 10px; }
  .lib-root { padding: 40px 16px 80px; }
  .lib-hero { margin-bottom: 32px; }
  .lib-hero h1 { font-size: 28px; letter-spacing: 4px; }
  .lib-logo { height: 48px; margin-bottom: 16px; }
  .lib-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .lib-card { padding: 14px; }
  .lib-card:active { transform: scale(0.98); }
  .lib-card-title { font-size: 18px; letter-spacing: 2px; }
  .lib-card-genre { display: none; }
  .lib-card-sub { font-size: 12px; margin-bottom: 8px; }
}

@media (max-width: 480px) {
  .lib-grid { grid-template-columns: 1fr; }
}

.loading {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  height: 100vh;
}
.loading-seal {
  width: 56px; height: 56px;
  border: 2px solid var(--vermillion);
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 900;
  color: var(--vermillion);
  animation: pulse 1.2s ease-in-out infinite;
}
.loading-logo {
  width: 56px; height: auto;
  object-fit: contain;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
</style>
