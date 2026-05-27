<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n'
import type { Author } from '../types'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  author: Author | undefined
  name: string
  era: string
  workCount: number
  lifespan: string
  vertical?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const courtesyName = computed(() => props.author?.courtesyName)
const artName = computed(() => props.author?.artName)
const bio = computed(() => props.author?.bio)

const links = computed(() => {
  const a = props.author
  if (!a) return []
  const items: { label: string; href: string }[] = []
  if (a.ctextId) items.push({ label: 'CTEXT', href: `https://ctext.org/wiki.pl?if=en&res=${a.ctextId}` })
  if (a.wikipediaZh) items.push({ label: 'Wikipedia ZH', href: a.wikipediaZh })
  if (a.wikipediaEn) items.push({ label: 'Wikipedia EN', href: a.wikipediaEn })
  if (a.wikidata) items.push({ label: 'Wikidata', href: `https://www.wikidata.org/wiki/${a.wikidata}` })
  return items
})
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="open" class="ap-overlay" :class="{ 'ap-overlay--vertical': vertical }" @click="emit('close')">
        <div class="ap-pane" :class="{ 'ap-pane--vertical': vertical }" @click.stop>
          <button class="ap-close unstyled" @click="emit('close')" :aria-label="t('action.close')">✕</button>
          <div class="ap-header" :class="{ 'ap-header--vertical': vertical }">
            <div class="ap-name">{{ name }}</div>
            <div class="ap-meta">
              <span v-if="era" class="ap-era">{{ era }}</span>
              <span v-if="lifespan" class="ap-lifespan">{{ lifespan }}</span>
              <span v-if="workCount" class="ap-count">{{ vertical ? t('stat.pieceCount', { count: workCount }) : t('piece.collected', { count: workCount }) }}</span>
            </div>
            <div v-if="courtesyName || artName" class="ap-alt-names">
              <span v-if="courtesyName">{{ t('author.courtesyName', { name: courtesyName }) }}</span>
              <span v-if="artName">{{ t('author.artName', { name: artName }) }}</span>
            </div>
          </div>
          <div v-if="links.length" class="ap-links" :class="{ 'ap-links--vertical': vertical }">
            <a v-for="link in links" :key="link.href" :href="link.href" target="_blank" rel="noopener" class="ap-link">{{ link.label }}</a>
          </div>
          <div v-if="bio" class="ap-bio" :class="{ 'ap-bio--vertical': vertical }">
            <div v-for="p in bio.split('\n').filter(l => l.trim())" :key="p" class="ap-p" :class="{ 'ap-p--vertical': vertical }">
              {{ p.trim() }}
            </div>
          </div>
          <div v-if="!bio" class="ap-empty">{{ t('piece.noAuthorData') }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ap-overlay {
  position: fixed; inset: 0;
  background: rgba(var(--shadow-rgb), 0.24);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 200;
  display: flex; justify-content: flex-end;
}
.ap-overlay--vertical {
  justify-content: flex-start;
}

.ap-pane {
  overscroll-behavior: contain;
  width: min(420px, 90vw);
  height: 100dvh;
  background: var(--paper);
  padding: 32px;
  overflow-y: auto;
  box-shadow: -8px 0 32px rgba(var(--shadow-rgb), 0.1);
}
.ap-pane--vertical {
  width: auto;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 32px 24px;
  overflow-y: hidden;
  overflow-x: auto;
  box-shadow: 8px 0 32px rgba(var(--shadow-rgb), 0.1);
}

.ap-close {
  display: block; margin-left: auto;
  width: 36px; height: 36px;
  border: 1px solid var(--border); border-radius: 4px;
  background: none; font-size: 16px;
  color: var(--ink-light); cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.ap-close:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.ap-pane--vertical .ap-close {
  width: 32px; height: 32px;
  font-size: 14px;
  margin-left: 0;
  margin-bottom: 16px;
}

.ap-header {
  display: flex; align-items: center; gap: 20px;
  margin: 24px 0 32px;
}
.ap-header--vertical {
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-left: 20px;
  border-left: 1px solid var(--border);
}

.ap-name {
  font-size: 28px; font-weight: 900;
  letter-spacing: 4px; color: var(--ink);
}
.ap-pane--vertical .ap-name {
  letter-spacing: 6px;
}

.ap-meta {
  font-size: 14px; color: var(--ink-faint);
  letter-spacing: 2px; margin-top: 6px;
  display: flex; align-items: center; gap: 8px;
}
.ap-pane--vertical .ap-meta {
  font-size: 13px;
  margin-top: 0;
  margin-left: 4px;
}

.ap-era {
  display: inline-flex;
  padding: 2px 8px;
  background: var(--vermillion);
  color: var(--paper);
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  border-radius: 3px;
}

.ap-count {
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.ap-lifespan {
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-light);
  letter-spacing: 1px;
}

.ap-alt-names {
  font-size: 14px;
  color: var(--ink-light);
  letter-spacing: 2px;
  margin-top: 6px;
  display: flex; gap: 12px;
}
.ap-pane--vertical .ap-alt-names {
  margin-top: 0;
  margin-left: 4px;
  gap: 8px;
}

.ap-links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0 0;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}
.ap-links--vertical {
  border-bottom: none;
  padding-bottom: 0;
  padding-left: 16px;
  border-left: 1px solid var(--border);
  margin-bottom: 16px;
  margin-top: 0;
}

.ap-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-mid);
  text-decoration: none;
  letter-spacing: 1px;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.ap-link:hover {
  border-color: var(--vermillion);
  color: var(--vermillion);
}

.ap-bio {
  border-top: 1px solid var(--border);
  padding-top: 24px;
}
.ap-bio--vertical {
  border-top: none;
  padding-top: 0;
  font-size: 16px;
  line-height: 2.4;
  color: var(--ink-mid);
  padding-left: 16px;
  border-left: 1px solid var(--border);
}

.ap-p {
  font-size: 16px; line-height: 2.2;
  color: var(--ink-mid); text-align: justify;
  text-indent: 2em; margin-bottom: 12px;
}
.ap-p--vertical {
  text-indent: 0;
  text-align: start;
  margin-bottom: 0;
  margin-left: 12px;
}

.ap-empty {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-faint);
  font-family: var(--sans);
  font-size: 14px;
  letter-spacing: 2px;
}
.ap-pane--vertical .ap-empty {
  padding: 0;
  padding-left: 16px;
  border-left: 1px solid var(--border);
}

/* Transition */
.overlay-enter-active { transition: opacity var(--dur-mid, 0.25s) ease; }
.overlay-enter-active .ap-pane {
  transition: transform var(--dur-mid, 0.25s) cubic-bezier(0.34, 1.56, 0.64, 1);
}
.overlay-leave-active { transition: opacity var(--dur-fast, 0.15s) ease; }
.overlay-leave-active .ap-pane {
  transition: transform var(--dur-fast, 0.15s) ease;
}
.overlay-enter-from { opacity: 0; }
.overlay-enter-from .ap-pane { transform: translateX(100%); }
.overlay-enter-from .ap-pane--vertical { transform: translateX(-100%); }
.overlay-leave-to { opacity: 0; }
.overlay-leave-to .ap-pane { transform: translateX(40px); }
.overlay-leave-to .ap-pane--vertical { transform: translateX(-40px); }
</style>
