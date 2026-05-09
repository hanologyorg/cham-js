<script setup lang="ts">
import type { BookMeta } from '../types'
import { useRouter } from 'vue-router'

defineProps<{ book: BookMeta }>()
const router = useRouter()

const genreLabel: Record<string, string> = {
  poetry: '詩歌',
  prose: '散文',
  mixed: '綜合',
  drama: '戲曲',
}
</script>

<template>
  <div class="bc-root" @click="router.push(`/${book.id}`)">
    <div class="bc-accent"></div>
    <div class="bc-body">
      <h2 class="bc-title">{{ book.title }}</h2>
      <p v-if="book.subtitle" class="bc-subtitle">{{ book.subtitle }}</p>
      <div class="bc-stats">
        <span class="bc-count">{{ book.count }} 篇</span>
        <span class="bc-genre">{{ genreLabel[book.genre] || book.genre }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bc-root {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
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
}
.bc-genre {
  padding: 2px 8px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
}
</style>
