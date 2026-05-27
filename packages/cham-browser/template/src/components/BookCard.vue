<script setup lang="ts">
import type { BookMeta } from '../types'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{ book: BookMeta }>()
const { t } = useI18n()

function genreLabel(genre: string): string {
  return t(`genre.${genre}` as 'genre.poetry') || genre
}
</script>

<template>
  <router-link custom :to="`/${props.book.id}`" v-slot="{ navigate }">
    <div class="bc-root" tabindex="0" @click="navigate" @keydown.enter="navigate" @keydown.space.prevent="navigate">
      <div class="bc-accent"></div>
      <div class="bc-body">
        <h2 class="bc-title">{{ props.book.title }}</h2>
        <p v-if="props.book.subtitle" class="bc-subtitle">{{ props.book.subtitle }}</p>
        <div class="bc-stats">
          <span class="bc-count">{{ t('stat.pieceCount', { count: props.book.count }) }}</span>
          <span class="bc-genre">{{ genreLabel(props.book.genre) }}</span>
        </div>
      </div>
    </div>
  </router-link>
</template>

<style scoped>
.bc-root {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.bc-accent {
  position: absolute;
  top: 0; left: 0;
  width: 3px; height: 0;
  background: var(--vermillion);
  transition: height 0.35s ease;
}
.bc-root:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(var(--shadow-rgb), 0.1);
  border-color: var(--gold-light);
}
.bc-root:hover .bc-accent { height: 100%; }
.bc-root:active { transform: scale(0.98); }
.bc-body { padding: 28px 24px; }
.bc-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink);
  margin-bottom: 6px;
}
.bc-subtitle {
  font-size: 13px;
  font-family: var(--sans);
  color: var(--ink-light);
  letter-spacing: 1px;
  margin-bottom: 16px;
}
.bc-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  font-family: var(--sans);
  color: var(--ink-faint);
}
.bc-count {
  padding: 2px 8px;
  background: var(--surface-warm);
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}
.bc-genre {
  padding: 2px 8px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
}
</style>
