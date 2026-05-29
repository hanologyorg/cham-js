<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useLibrary } from '../composables/useLibrary'
import { useBook } from '../composables/useBook'
import { useTitle } from '../composables/useTitle'
import { useReadingMode } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import { useI18n } from '../composables/useI18n'
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
const { t } = useI18n()

function bookCategory(book: BookMeta): string {
  if (book.id.startsWith('skqs-')) return t('genre.fourTreasuries')
  if (book.id === 'primary' || book.id === 'primary-culture' || book.id === 'secondary' || book.id === 'nss') return t('genre.textbooks')
  return t('genre.classicalText')
}

function bookCategoryKey(book: BookMeta): string {
  if (book.id.startsWith('skqs-')) return 'fourTreasuries'
  if (book.id === 'primary' || book.id === 'primary-culture' || book.id === 'secondary' || book.id === 'nss') return 'textbooks'
  return 'classicalText'
}

const groupedBooks = computed(() => {
  const groups = new Map<string, BookMeta[]>()
  const order = [t('genre.textbooks'), t('genre.classicalText'), t('genre.fourTreasuries')]
  for (const book of books.value) {
    const cat = bookCategory(book)
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(book)
  }
  return order
    .filter(cat => groups.has(cat))
    .map(cat => ({ category: cat, key: order.indexOf(cat) === 0 ? 'textbooks' : order.indexOf(cat) === 1 ? 'classicalText' : 'fourTreasuries', books: groups.get(cat)! }))
})

const totalPieces = computed(() => books.value.reduce((sum, b) => sum + b.count, 0))

</script>

<template>
  <div v-if="scale !== 'library'" class="page-loading">
    <img v-if="logoUrl" :src="logoUrl" alt="" class="page-loading-logo" />
    <div v-else class="page-loading-seal">文</div>
  </div>
  <div v-else>
    <!-- ═══════ 直排模式 ═══════ -->
    <div v-if="isVertical" class="v-root">
      <SideNav @home="router.push('/')" @back="router.push('/')" />
      <div ref="vPageRef" class="v-page">
        <!-- Hero — top-aligned -->
        <section class="v-hero">
          <div v-if="logoUrl" class="v-logo"><img :src="logoUrl" alt="" /></div>
          <div v-else class="v-seal">{{ displayTitle.slice(0, 2) }}</div>
          <h1 class="v-title">{{ displayTitle.split('').join(' ') }}</h1>
          <p v-if="siteSubtitle" class="v-subtitle">{{ siteSubtitle }}</p>
          <div class="v-divider"></div>
          <div class="v-hero-stats">
            <span class="v-hero-stat">{{ books.length }} {{ t('stat.books') }}</span>
            <span class="v-hero-stat-sep">·</span>
            <span class="v-hero-stat">{{ totalPieces }} {{ t('stat.pieces') }}</span>
          </div>
        </section>

        <!-- Category sections -->
        <section
          v-for="group in groupedBooks"
          :key="group.key"
          class="v-section"
        >
          <div class="v-section-header" :class="group.key">
            <span class="v-section-accent"></span>
            <span class="v-section-title">{{ group.category }}</span>
            <span class="v-section-count">{{ group.books.length }} {{ t('stat.books') }}</span>
          </div>
          <div class="v-section-cards">
            <router-link
              v-for="(book, bi) in group.books"
              :key="book.id"
              custom
              :to="`/${book.id}`"
              v-slot="{ navigate }"
            >
              <div
                class="v-card v-card-anim"
                :data-cat="group.key"
                tabindex="0"
                :style="{ animationDelay: bi * 0.05 + 's' }"
                @click="navigate"
                @keydown.enter="navigate"
                @keydown.space.prevent="navigate"
              >
                <div class="v-card-accent"></div>
                <div class="v-card-body">
                  <h3 class="v-card-title">{{ book.title }}</h3>
                  <span v-if="book.subtitle" class="v-card-sub">{{ book.subtitle }}</span>
                  <span class="v-card-badge">{{ t('stat.pieceCount', { count: book.count }) }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </section>
      </div>
    </div>

    <!-- ═══════ 橫排模式 ═══════ -->
    <div v-else class="lib-root">
      <header class="lib-hero">
        <img v-if="logoUrl" :src="logoUrl" alt="" class="lib-logo" />
        <div v-else class="lib-seal">{{ displayTitle.slice(0, 2) }}</div>
        <h1>{{ displayTitle }}</h1>
        <p v-if="siteSubtitle" class="lib-subtitle">{{ siteSubtitle }}</p>
        <div class="lib-stats-bar">
          <span class="lib-stat">{{ books.length }} {{ t('stat.books') }}</span>
          <span class="lib-stat-sep">·</span>
          <span class="lib-stat">{{ totalPieces }} {{ t('stat.pieces') }}</span>
        </div>
      </header>
      <div v-for="group in groupedBooks" :key="group.category" class="lib-group">
        <h2 class="lib-group-title">{{ group.category }}</h2>
        <div class="lib-grid">
          <router-link
            v-for="(book, bi) in group.books"
            :key="book.id"
            custom
            :to="`/${book.id}`"
            v-slot="{ navigate }"
          >
            <div
              class="lib-card lib-card-anim"
              tabindex="0"
              :style="{ animationDelay: bi * 0.06 + 's' }"
              @click="navigate"
              @keydown.enter="navigate"
              @keydown.space.prevent="navigate"
            >
              <div class="lib-card-accent"></div>
              <div class="lib-card-body">
                <div class="lib-card-top">
                  <h3 class="lib-card-title">{{ book.title }}</h3>
                  <span class="lib-card-genre">{{ bookCategory(book) }}</span>
                </div>
                <p v-if="book.subtitle" class="lib-card-sub">{{ book.subtitle }}</p>
                <div class="lib-card-stats">
                  <span class="lib-card-count">{{ t('stat.pieceCount', { count: book.count }) }}</span>
                </div>
              </div>
            </div>
          </router-link>
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
  padding: 0 32px;
  background: linear-gradient(90deg, var(--paper) 0%, var(--paper-warm) 100%);
}

/* Hero — top-aligned, no vertical centering */
.v-hero {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 40px 24px;
}

.v-logo {
  margin-bottom: 16px;
  margin-left: 0;
}
.v-logo img {
  height: 48px;
  width: auto;
  object-fit: contain;
}

.v-seal {
  writing-mode: vertical-rl;
  text-orientation: upright;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 48px;
  border: 2px solid var(--vermillion);
  color: var(--vermillion);
  font-size: 18px;
  font-family: var(--serif);
  letter-spacing: 2px;
  border-radius: 4px;
  line-height: 1;
  margin-left: 12px;
}

.v-title {
  font-size: 48px;
  font-weight: 900;
  letter-spacing: 16px;
  color: var(--ink);
  margin-left: 20px;
  padding-left: 20px;
  border-left: 4px solid var(--vermillion);
  line-height: 1.6;
}

.v-subtitle {
  font-size: 14px;
  font-weight: 300;
  color: var(--ink-faint);
  letter-spacing: 3px;
  margin-left: 16px;
  font-family: var(--sans);
}

.v-divider {
  width: 2px;
  height: 60px;
  background: linear-gradient(180deg, transparent, var(--gold), transparent);
  margin-left: 20px;
}

.v-hero-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 12px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.v-hero-stat {
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-light);
  letter-spacing: 2px;
}

.v-hero-stat-sep {
  font-size: 10px;
  color: var(--border);
}

/* ─── Category sections ─── */
.v-section {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0;
}

.v-section-header {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 24px 10px;
  border-left: 1px solid var(--border-light);
  gap: 6px;
  min-height: 200px;
  width: 40px;
}

.v-section-accent {
  display: block;
  width: 2px;
  height: 24px;
  background: var(--vermillion);
  border-radius: 1px;
  flex-shrink: 0;
}
.v-section-header.textbooks .v-section-accent { background: var(--gold); }
.v-section-header.fourTreasuries .v-section-accent { background: var(--jade); }

.v-section-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink);
  white-space: nowrap;
  line-height: 1.8;
}

.v-section-count {
  font-family: var(--sans);
  font-size: 11px;
  color: var(--ink-faint);
  letter-spacing: 1px;
  white-space: nowrap;
}

/* ─── Cards grid (vertical mode) ─── */
.v-section-cards {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  padding: 24px 16px;
  align-content: flex-start;
  height: 100dvh;
  box-sizing: border-box;
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
  width: 160px;
  min-height: 200px;
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
  left: 0;
  bottom: 0;
  width: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--vermillion), var(--gold));
  transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.v-card:hover .v-card-accent { width: 100%; }
.v-card:hover .v-card-title { color: var(--vermillion); }

.v-card[data-cat="textbooks"] .v-card-accent { background: linear-gradient(90deg, var(--gold), var(--vermillion)); }
.v-card[data-cat="textbooks"]:hover .v-card-title { color: var(--gold); }
.v-card[data-cat="fourTreasuries"] .v-card-accent { background: linear-gradient(90deg, var(--jade), var(--gold)); }
.v-card[data-cat="fourTreasuries"]:hover .v-card-title { color: var(--jade); }

.v-card-body {
  padding: 20px 18px 24px;
  box-sizing: border-box;
  overflow: hidden;
  height: auto;
  -webkit-mask-image: linear-gradient(to left, black 85%, transparent);
  mask-image: linear-gradient(to left, black 85%, transparent);
}

.v-card-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink);
  margin-bottom: 0;
  margin-left: 4px;
  display: block;
  transition: color 0.25s ease;
  line-height: 1.5;
}

.v-card-sub {
  font-size: 12px;
  color: var(--ink-light);
  font-family: var(--sans);
  letter-spacing: 1px;
  margin-top: 0;
  margin-left: 2px;
  display: block;
  line-height: 1.6;
}

.v-card-badge {
  font-family: var(--sans);
  font-size: 11px;
  color: var(--ink-faint);
  letter-spacing: 1px;
  background: var(--surface-warm);
  border: 1px solid var(--border-light);
  border-radius: 2px;
  padding: 2px 8px;
  margin-top: 0;
  margin-left: 2px;
  display: inline-block;
}

.v-card-anim {
  animation: cardEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
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
  display: block;
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
.lib-stat {
  font-variant-numeric: tabular-nums;
}
.lib-stat-sep { color: var(--border); }

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
  transition: border-color 0.3s var(--ease-out-expo, ease), box-shadow 0.3s var(--ease-out-expo, ease), transform 0.3s var(--ease-out-expo, ease);
  position: relative;
  background: var(--surface);
}
.lib-card:hover { border-color: var(--gold); box-shadow: 0 6px 24px rgba(var(--shadow-rgb), 0.1); transform: translateY(-2px); }
.lib-card:active { transform: scale(0.98); }
.lib-card-accent {
  position: absolute;
  top: 0; left: 0;
  width: 3px; height: 0;
  background: linear-gradient(180deg, var(--vermillion), var(--gold));
  transition: height 0.35s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}
.lib-card:hover .lib-card-accent { height: 100%; }
.lib-card:hover .lib-card-title { color: var(--vermillion); }
.lib-card-body {
  padding: 0;
}
.lib-card-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.lib-card-title {
  font-size: 22px; font-weight: 900;
  letter-spacing: 4px; color: var(--ink);
  transition: color 0.25s ease;
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
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .v-page { padding: 0 16px; }
  .v-hero { padding: 24px 16px; }
  .v-title { font-size: 36px; letter-spacing: 10px; }
  .v-section-header { padding: 16px 8px; min-height: 160px; width: 36px; }
  .v-section-title { font-size: 13px; letter-spacing: 3px; }
  .v-section-cards { gap: 8px; padding: 16px 8px; }
  .v-card { width: 140px; min-height: 180px; }
  .v-card-title { font-size: 20px; letter-spacing: 3px; }
  .v-card-body { padding: 16px 14px 20px; }

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
  .v-card { width: 120px; min-height: 160px; }
  .v-card-title { font-size: 18px; }
  .v-card-sub { display: none; }
  .lib-grid { grid-template-columns: 1fr; }
}
</style>
