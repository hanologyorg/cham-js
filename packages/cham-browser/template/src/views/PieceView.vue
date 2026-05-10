<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBook } from '../composables/useBook'
import { useTitle } from '../composables/useTitle'
import { useReadingMode } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import { useAnnotationInteraction } from '../composables/useAnnotationInteraction'
import { useData } from '../composables/useData'
import VerticalScroll from '../components/VerticalScroll.vue'
import HorizontalDisplay from '../components/HorizontalDisplay.vue'
import SectionBlock from '../components/SectionBlock.vue'
import AnnotationTooltip from '../components/AnnotationTooltip.vue'
import AnnotationControlBar from '../components/AnnotationControlBar.vue'
import SideNav from '../components/SideNav.vue'
import PartGroup from '../components/PartGroup.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import type { Piece, Annotation, AnnotationLayer, Part } from '../types'

const props = defineProps<{ bookId: string; num: string | number }>()
const router = useRouter()
const { getPiece, pieces, meta, load, getAdjacentNums } = useBook()
await load(props.bookId)

const { layout } = useReadingMode()
const vPageRef = ref<HTMLElement | null>(null)
const vScroll = useHorizontalScroll(vPageRef)

const authorPaneOpen = ref(false)
const selectedAuthorId = ref('')
const interaction = reactive(useAnnotationInteraction())
const titleCollapsed = ref(false)
const vTitleRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!vTitleRef.value) return
  const observer = new IntersectionObserver(
    ([entry]) => { titleCollapsed.value = !entry.isIntersecting },
    { threshold: 0 }
  )
  observer.observe(vTitleRef.value)
  onUnmounted(() => observer.disconnect())
})

const piece = computed<Piece | undefined>(() => {
  const n = typeof props.num === 'string' ? parseInt(props.num, 10) : props.num
  return getPiece(n)
})

const adjacent = computed(() => {
  const n = typeof props.num === 'string' ? parseInt(props.num, 10) : props.num
  return getAdjacentNums(n)
})

const pageTitle = computed(() => piece.value
  ? `${piece.value.title}·${piece.value.author} — ${meta.value?.title}`
  : meta.value?.title || ''
)
useTitle(pageTitle.value)

const isVertical = computed(() => layout.value === 'vertical')

const totalAnnotationCount = computed(() => {
  if (!piece.value) return 0
  let count = piece.value.annotations.length
  if (piece.value.annotationLayers) {
    for (const layer of piece.value.annotationLayers) {
      count += layer.annotations.length
    }
  }
  return count
})

const annotationLayers = computed<AnnotationLayer[]>(() => piece.value?.annotationLayers || [])
const hasLayers = computed(() => annotationLayers.value.length > 1)
const activeLayerIds = ref<string[]>([])
const annotationsVisible = ref(true)

function initLayers() {
  if (hasLayers.value && activeLayerIds.value.length === 0) {
    activeLayerIds.value = annotationLayers.value
      .filter(l => l.enabled)
      .map(l => l.id)
  }
}

const mergedAnnotations = computed<Annotation[]>(() => {
  if (!hasLayers.value) return piece.value?.annotations || []
  const result: Annotation[] = []
  for (const layer of annotationLayers.value) {
    if (!activeLayerIds.value.includes(layer.id)) continue
    for (const ann of layer.annotations) {
      result.push(ann)
    }
  }
  for (const ann of piece.value?.annotations || []) {
    result.push(ann)
  }
  return result
})

const layerLabels = computed(() => {
  const labels: Record<string, string> = {}
  for (const layer of annotationLayers.value) {
    if (layer.id !== 'default') labels[layer.id] = layer.label
  }
  return labels
})

const layerAnnotationBlocks = computed(() => {
  if (!hasLayers.value || !annotationsVisible.value) return []
  const result: { label: string; text: string }[] = []
  const activeLayers = annotationLayers.value.filter(l => activeLayerIds.value.includes(l.id) && l.id !== 'default')
  for (const layer of activeLayers) {
    if (layer.annotations.length === 0) continue
    const lines: string[] = []
    let n = 1
    for (const ann of layer.annotations) {
      const headword = getHeadword(ann)
      lines.push(`${n}.${headword}：${ann.text}`)
      n++
    }
    result.push({ label: layer.label, text: lines.join('\n') })
  }
  return result
})

function getHeadword(ann: Annotation): string {
  const p = piece.value
  if (!p) return ''
  if (ann.range.scope === 'title') {
    return p.title.slice(ann.range.start ?? 0, ann.range.end)
  }
  if (ann.range.scope === 'verse' && ann.range.verseIndex !== undefined) {
    const verse = p.verses[ann.range.verseIndex]
    if (verse) return verse.text.slice(ann.range.start ?? 0, ann.range.end)
  }
  return ''
}

// Initialize layers when piece loads
watch(() => piece.value, () => initLayers(), { immediate: true })

// ─── Multi-part ───────────────────────────────────────────────
const isMultiPart = computed(() => (piece.value?.parts?.length ?? 0) > 0)

const partGroups = computed<{ label: string; parts: Part[] }[]>(() => {
  if (!piece.value?.parts?.length) return []
  const groupMap = new Map<string, Part[]>()
  for (const part of piece.value.parts) {
    const key = part.group || ''
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(part)
  }
  return [...groupMap.entries()].map(([label, parts]) => ({ label, parts }))
})

const allPartAnnotations = computed<Annotation[]>(() => {
  if (!piece.value?.parts) return []
  return piece.value.parts.flatMap(p => p.annotations)
})

const totalPartAnnotationCount = computed(() => {
  return piece.value?.parts?.reduce((sum, p) => sum + p.annotations.length, 0) ?? 0
})

const SECTION_META: Record<string, { label: string; special: boolean }> = {
  background: { label: '背景資料', special: false },
  analysis: { label: '賞析重點', special: false },
  preparation: { label: '預習活動', special: true },
  follow_up: { label: '跟進活動', special: true },
  think_questions: { label: '想一想', special: true },
}

const proseSections = computed(() => {
  const ss = piece.value?.structuredSections
  if (ss && ss.length > 0) {
    return ss.filter(s => s.key !== 'author_bio' && s.body)
  }
  // Fallback to legacy sections record
  const sections = piece.value?.sections || {}
  const result: { key: string; title: string; body: string; order: number; special: boolean }[] = []
  for (const [key, label] of Object.entries({ background: '背景資料', analysis: '賞析重點', preparation: '預習活動', follow_up: '跟進活動', think_questions: '想一想' })) {
    if (sections[key]) {
      const meta = SECTION_META[key]
      result.push({ key, title: label, body: sections[key], order: meta ? (key === 'background' ? 1 : key === 'analysis' ? 2 : 3) : 99, special: meta?.special ?? false })
    }
  }
  return result
})


const { getAuthor, loadShared } = useData()
await loadShared()

const selectedAuthorName = computed(() => {
  if (!selectedAuthorId.value) return piece.value?.author || ''
  const c = piece.value?.contributors?.find(x => x.id === selectedAuthorId.value)
  return c?.name || piece.value?.author || ''
})
const selectedAuthorBio = computed(() => {
  const name = selectedAuthorName.value
  const a = getAuthor(name)
  return a?.bio || piece.value?.sections?.author_bio || ''
})

function openAuthorPane(id?: string) {
  selectedAuthorId.value = id || piece.value?.authorId || ''
  authorPaneOpen.value = true
}
function closeAuthorPane() { authorPaneOpen.value = false; selectedAuthorId.value = '' }
function goBack() { router.push(`/${props.bookId}`) }
function goHome() { router.push('/') }

function navigate(delta: number) {
  if (!piece.value) return
  const target = delta < 0 ? adjacent.value.prev : adjacent.value.next
  if (target !== null) router.push(`/${props.bookId}/${target}`)
}

const contributorGroups = computed(() => {
  const c = piece.value?.contributors
  if (!c || c.length <= 1) return []
  const groups = new Map<string, string[]>()
  for (const x of c) {
    const t = x.title || '作者'
    if (!groups.has(t)) groups.set(t, [])
    groups.get(t)!.push(x.name)
  }
  return [...groups.entries()].map(([title, names]) => ({ title, names }))
})

const authorDisplay = computed(() => {
  const c = piece.value?.contributors
  if (!c || c.length <= 1) return piece.value?.author || ''
  return contributorGroups.value.map(g => `${g.title} ${g.names.join(' ')}`).join(' ')
})

function tcy(n: number): string {
  const s = String(n)
  return s.length <= 2 ? `<span style="text-combine-upright:all">${s}</span>` : s
}
</script>

<template>
  <div v-if="piece">
    <!-- ═══════ 直排模式 ═══════ -->
    <div v-if="isVertical" class="v-root">
      <SideNav
        :context="`${piece.num}. ${piece.title}`"
        :poem-title="piece.title"
        :poem-author="piece.author"
        :title-collapsed="titleCollapsed"
        @back="goBack"
        @home="goHome"
      />
      <ReadingProgress vertical :scroll-container="vPageRef" />
      <div ref="vPageRef" class="v-page">
        <section ref="vTitleRef" class="v-title-col">
          <h1 class="v-poem-title">{{ piece.title }}</h1>
          <template v-if="piece.contributors && piece.contributors.length > 1">
            <div v-for="group in contributorGroups" :key="group.title" class="v-author-group">
              <span class="v-author-role">{{ group.title }}</span>
              <span v-for="name in group.names" :key="name" class="v-poem-author" @click="openAuthorPane(piece.contributors!.find(c => c.name === name)?.id)">{{ name }}</span>
            </div>
          </template>
          <span v-else class="v-poem-author" @click="openAuthorPane">{{ piece.author }}</span>
          <div v-if="piece.source?.textRef" class="v-source-link" @click="router.push(`/${piece.source.textRef}`)">
            ← {{ meta?.title }}
          </div>
          <div class="v-poem-meta">
            <template v-if="isMultiPart">
              <span class="v-meta-item" v-html="tcy(piece.parts!.length) + ' 段'" />
              <span class="v-meta-item" v-html="totalPartAnnotationCount > 0 ? tcy(totalPartAnnotationCount) + ' 注' : '無注'" />
            </template>
            <template v-else>
              <span class="v-meta-item" v-html="tcy(piece.verses.length) + ' 段'" />
              <span class="v-meta-item" v-html="totalAnnotationCount > 0 ? tcy(totalAnnotationCount) + ' 注' : '無注'" />
            </template>
          </div>
        </section>

        <section v-if="isMultiPart" class="v-poem-col v-multipart">
          <PartGroup
            v-for="group in partGroups"
            :key="group.label"
            :label="group.label"
            :parts="group.parts"
            :vertical="true"
            @annotation-hover="interaction.onHover"
            @annotation-leave="interaction.onLeave"
            @annotation-tap="interaction.onTap"
          />
        </section>

        <section v-else class="v-poem-col">
          <VerticalScroll
            :title="''"
            :author="''"
            :verses="piece.verses"
            :author-initial="piece.author?.charAt(0) || '詩'"
            :annotations="mergedAnnotations"
            @annotation-hover="interaction.onHover"
            @annotation-leave="interaction.onLeave"
            @annotation-tap="interaction.onTap"
            @open-author="openAuthorPane"
          />
        </section>

        <SectionBlock
          v-if="!isMultiPart && annotationsVisible && piece.sections.annotations"
          num=""
          label="注釋"
          :special="false"
          :text="piece.sections.annotations"
          :is-annotations="true"
          :vertical="true"
          class="v-section"
        />
        <template v-if="hasLayers">
          <div class="v-layers-inline v-section">
            <AnnotationControlBar
              :layers="annotationLayers"
              :has-annotations="piece.annotations.length > 0"
              v-model:active-ids="activeLayerIds"
              v-model:annotations-visible="annotationsVisible"
            />
          </div>
          <SectionBlock
            v-for="block in layerAnnotationBlocks"
            :key="block.label"
            num=""
            :label="block.label"
            :special="false"
            :text="block.text"
            :is-annotations="true"
            :vertical="true"
            class="v-section"
          />
        </template>
        <SectionBlock
          v-else-if="piece.annotations.length > 0"
          num=""
          label="注釋"
          :special="false"
          :text="piece.sections.annotations || ''"
          :is-annotations="true"
          :vertical="true"
          class="v-section"
        />

        <SectionBlock
          v-for="(sec, idx) in proseSections"
          :key="sec.key"
          :num="String(idx + 1).padStart(2, '0')"
          :label="sec.title"
          :special="SECTION_META[sec.key]?.special ?? false"
          :text="sec.body"
          :is-annotations="false"
          :vertical="true"
          class="v-section"
        />

        <nav class="v-nav">
          <button v-if="adjacent.prev !== null" class="v-nav-btn" @click="navigate(-1)">
            <span class="v-nav-dir">▲</span>
            <span class="v-nav-label">上一篇</span>
            <span class="v-nav-title">{{ getPiece(adjacent.prev)?.title }}</span>
          </button>
          <div v-else class="v-nav-spacer" />
          <button v-if="adjacent.next !== null" class="v-nav-btn" @click="navigate(1)">
            <span class="v-nav-dir">▼</span>
            <span class="v-nav-label">下一篇</span>
            <span class="v-nav-title">{{ getPiece(adjacent.next)?.title }}</span>
          </button>
        </nav>
      </div>

      <AnnotationTooltip
        :visible="interaction.visible"
        :annotations="interaction.items"
        :layer-labels="layerLabels"
        :style="interaction.style"
        @close="interaction.dismiss"
        @tooltip-enter="interaction.onTooltipEnter"
        @tooltip-leave="interaction.onTooltipLeave"
      />

      <Teleport to="body">
        <div v-if="authorPaneOpen" class="v-overlay" @click="closeAuthorPane">
          <div class="v-author-pane" @click.stop>
            <button class="v-pane-close" @click="closeAuthorPane">✕</button>
            <div class="v-pane-header">
              <div class="v-pane-name">{{ selectedAuthorName }}</div>
            </div>
            <div v-if="selectedAuthorBio" class="v-pane-bio">
              <div v-for="p in selectedAuthorBio.split('\n').filter(l => l.trim())" :key="p" class="v-pane-p">
                {{ p.trim() }}
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <!-- ═══════ 橫排模式 ═══════ -->
    <div v-else class="h-root">
      <ReadingProgress />
      <div class="h-page">
        <nav class="h-nav">
          <div class="h-nav-inner">
            <button class="h-back" @click="goBack">← 返回</button>
            <div class="h-breadcrumb">
              <span v-if="piece.source?.textRef" class="h-source-link" @click="router.push(`/${piece.source.textRef}`)">
                {{ meta?.title }} →
              </span>
              <span class="h-sep">{{ piece.num }}.</span>
              {{ piece.title }}
              <span class="h-sep">·</span>
              <template v-if="piece.contributors && piece.contributors.length > 1">
                <template v-for="(group, gi) in contributorGroups" :key="group.title">
                  <span v-if="gi > 0" class="h-sep">|</span>
                  <span class="h-author-role">{{ group.title }}</span>
                  <span v-for="name in group.names" :key="name" class="h-author-link" @click="openAuthorPane(piece.contributors!.find(c => c.name === name)?.id)">{{ name }}</span>
                </template>
              </template>
              <span v-else class="h-author-link" @click="openAuthorPane">{{ piece.author }}</span>
            </div>
            <div class="h-controls">
              <template v-if="isMultiPart">
                <span class="h-tag">{{ piece.parts!.length }} 段</span>
                <span class="h-tag">{{ totalPartAnnotationCount > 0 ? totalPartAnnotationCount + ' 注' : '無注' }}</span>
              </template>
              <template v-else>
                <span class="h-tag">{{ piece.verses.length }} 段</span>
                <span class="h-tag">{{ totalAnnotationCount > 0 ? totalAnnotationCount + ' 注' : '無注' }}</span>
              </template>
            </div>
          </div>
        </nav>

        <div class="h-content">
          <div v-if="isMultiPart" class="h-multipart">
            <PartGroup
              v-for="group in partGroups"
              :key="group.label"
              :label="group.label"
              :parts="group.parts"
              @annotation-hover="interaction.onHover"
              @annotation-leave="interaction.onLeave"
              @annotation-tap="interaction.onTap"
            />
          </div>

          <div v-else class="h-poem-block">
            <HorizontalDisplay
              :title="piece.title"
              :author="piece.author"
              :verses="piece.verses"
              :annotations="mergedAnnotations"
              @annotation-hover="interaction.onHover"
              @annotation-leave="interaction.onLeave"
              @annotation-tap="interaction.onTap"
            />
          </div>

          <div class="h-sections">
            <div v-if="(piece.sections.annotations && annotationsVisible) || hasLayers" class="h-ann-section">
              <AnnotationControlBar
                :layers="annotationLayers"
                :has-annotations="piece.annotations.length > 0"
                v-model:active-ids="activeLayerIds"
                v-model:annotations-visible="annotationsVisible"
                style="margin-bottom: 16px"
              />
              <SectionBlock
                v-if="annotationsVisible && piece.sections.annotations"
                num=""
                label="注釋"
                :special="false"
                :text="piece.sections.annotations"
                :is-annotations="true"
              />
              <template v-if="hasLayers">
                <SectionBlock
                  v-for="block in layerAnnotationBlocks"
                  :key="block.label"
                  num=""
                  :label="block.label"
                  :special="false"
                  :text="block.text"
                  :is-annotations="true"
                />
              </template>
            </div>

            <SectionBlock
              v-for="(sec, idx) in proseSections"
              :key="sec.key"
              :num="String(idx + 1).padStart(2, '0')"
              :label="sec.title"
              :special="SECTION_META[sec.key]?.special ?? false"
              :text="sec.body"
              :is-annotations="false"
              :style="{ animationDelay: idx * 0.08 + 's' }"
            />
          </div>

          <div class="h-nav-bottom">
            <button v-if="adjacent.prev !== null" class="h-nav-btn" @click="navigate(-1)">
              <div class="h-nav-label">← 上一篇</div>
              <div class="h-nav-title">{{ getPiece(adjacent.prev)?.title }}</div>
            </button>
            <div v-else />
            <button v-if="adjacent.next !== null" class="h-nav-btn h-nav-next" @click="navigate(1)">
              <div class="h-nav-label">下一篇 →</div>
              <div class="h-nav-title">{{ getPiece(adjacent.next)?.title }}</div>
            </button>
          </div>
        </div>
      </div>

      <AnnotationTooltip
        :visible="interaction.visible"
        :annotations="interaction.items"
        :layer-labels="layerLabels"
        :style="interaction.style"
        @close="interaction.dismiss"
        @tooltip-enter="interaction.onTooltipEnter"
        @tooltip-leave="interaction.onTooltipLeave"
      />

      <Teleport to="body">
        <div v-if="authorPaneOpen" class="h-overlay" @click="closeAuthorPane">
          <div class="h-pane" @click.stop>
            <button class="h-pane-close" @click="closeAuthorPane">✕</button>
            <div class="h-pane-header">
              <div>
                <div class="h-pane-name">{{ selectedAuthorName }}</div>
                <div class="h-pane-meta">{{ piece.title }} 等</div>
              </div>
            </div>
            <div v-if="selectedAuthorBio" class="h-pane-bio">
              <div v-for="p in selectedAuthorBio.split('\n').filter(l => l.trim())" :key="p" class="h-pane-p">
                {{ p.trim() }}
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>

  <div v-else class="loading">
    <div class="loading-seal">詩</div>
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
  padding: 0;
  background: var(--paper);
  scrollbar-width: thin;
  scrollbar-color: var(--gold) transparent;
  scroll-snap-type: x proximity;
}
.v-page::-webkit-scrollbar { height: 4px; }
.v-page::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.v-title-col {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 16px;
  padding: 40px 24px;
  border-right: 1px solid var(--border);
  scroll-snap-align: start;
}
.v-poem-title {
  font-size: 40px; font-weight: 900;
  letter-spacing: 12px; color: var(--ink);
  padding-left: 20px;
  border-left: 4px solid var(--vermillion);
  line-height: 1.6;
}
.v-poem-author {
  font-size: 24px; font-weight: 400;
  color: var(--ink-light); letter-spacing: 6px;
  cursor: pointer;
  transition: color 0.15s;
}
.v-poem-author:hover { color: var(--vermillion); }
.v-author-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.v-author-role {
  font-size: 12px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 2px;
}
.v-poem-meta {
  display: flex;
  gap: 8px;
}
.v-meta-item {
  font-size: 13px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 2px;
}

.v-poem-col {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 24px;
}

.v-multipart {
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  gap: 0;
  max-height: calc(100vh - 120px);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 24px 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--gold) var(--paper);
}

.v-multipart::-webkit-scrollbar { height: 4px; }
.v-multipart::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.v-section {
  flex-shrink: 0;
}

.v-layers-inline {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 12px 0 4px;
  border-top: 1px solid var(--border-light);
}

.v-source-link {
  font-size: 12px;
  color: var(--vermillion);
  cursor: pointer;
  margin-top: 4px;
  opacity: 0.8;
}
.v-source-link:hover { opacity: 1; text-decoration: underline; }

.v-nav {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100vh;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  gap: 32px;
  scroll-snap-align: start;
}
.v-nav-spacer { flex: 1; }
.v-nav-btn {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.v-nav-btn:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
}
.v-nav-dir {
  font-size: 16px; color: var(--vermillion);
}
.v-nav-label {
  font-size: 11px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 2px;
}
.v-nav-title {
  font-size: 18px; font-weight: 700;
  letter-spacing: 3px; color: var(--ink);
}

/* ═══════ 橫排模式 ═══════ */

.h-page { min-height: 100vh; }
.h-nav {
  position: sticky; top: 0; z-index: 100;
  background: var(--paper); opacity: 0.97;
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
.h-author-link {
  color: var(--ink-light); font-weight: 400;
  cursor: pointer; transition: color 0.15s;
}
.h-author-link:hover { color: var(--vermillion); }
.h-author-role {
  font-size: 12px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 1px;
  margin-right: 4px;
}
.h-controls { margin-left: auto; display: flex; gap: 6px; }
.h-tag {
  padding: 4px 12px; border: 1px solid var(--border);
  border-radius: 2px; font-family: var(--sans);
  font-size: 12px; color: var(--ink-light); letter-spacing: 1px;
}

.h-content {
  max-width: 1200px; margin: 0 auto; padding: 60px 40px;
}
.h-poem-block {
  margin-bottom: 60px; display: flex; justify-content: center;
}

.h-multipart {
  max-width: min(680px, calc(100vw - 80px));
  margin: 0 auto 60px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 32px 40px;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
}
.h-sections {
  max-width: min(680px, calc(100vw - 80px));
  margin: 0 auto; padding-bottom: 80px;
}

.h-ann-section {
  margin-bottom: 16px;
}

.h-layers-inline {
  padding: 12px 0;
  margin-bottom: 8px;
}

.h-source-link {
  color: var(--vermillion);
  cursor: pointer;
  font-size: 13px;
}
.h-source-link:hover { text-decoration: underline; }

.h-nav-bottom {
  max-width: min(680px, calc(100vw - 80px));
  margin: 0 auto 60px;
  display: flex; justify-content: space-between; gap: 16px;
}
.h-nav-btn {
  flex: 1; padding: 16px 24px;
  background: var(--surface); border: 1px solid var(--border-light);
  border-radius: 8px; cursor: pointer;
  transition: all 0.2s ease; font-family: var(--serif);
  text-align: left;
}
.h-nav-btn:hover { border-color: var(--gold); box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08); }
.h-nav-btn.h-nav-next { text-align: right; }
.h-nav-label { font-size: 11px; color: var(--ink-faint); font-family: var(--sans); letter-spacing: 2px; margin-bottom: 4px; }
.h-nav-title { font-size: 16px; font-weight: 600; letter-spacing: 1px; color: var(--ink); }

.h-overlay {
  position: fixed; inset: 0;
  background: rgba(var(--shadow-rgb), 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 200;
  display: flex; justify-content: flex-end;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.h-pane {
  width: min(420px, 90vw);
  height: 100vh;
  background: var(--paper);
  padding: 32px;
  overflow-y: auto;
  animation: slideIn 0.25s ease;
  box-shadow: -8px 0 32px rgba(var(--shadow-rgb), 0.1);
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.h-pane-close {
  display: block; margin-left: auto;
  width: 36px; height: 36px;
  border: 1px solid var(--border); border-radius: 4px;
  background: none; font-size: 16px;
  color: var(--ink-light); cursor: pointer;
  transition: all 0.15s;
}
.h-pane-close:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.h-pane-header {
  display: flex; align-items: center; gap: 20px;
  margin: 24px 0 32px;
}
.h-pane-seal {
  width: 64px; height: 64px;
  border: 2px solid var(--vermillion); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 900;
  color: var(--vermillion); flex-shrink: 0;
}
.h-pane-name { font-size: 28px; font-weight: 900; letter-spacing: 4px; color: var(--ink); }
.h-pane-meta { font-size: 14px; color: var(--ink-faint); letter-spacing: 2px; margin-top: 4px; }
.h-pane-bio { border-top: 1px solid var(--border); padding-top: 24px; }
.h-pane-p {
  font-size: 16px; line-height: 2.2;
  color: var(--ink-mid); text-align: justify;
  text-indent: 2em; margin-bottom: 12px;
}

.v-overlay {
  position: fixed; inset: 0;
  background: rgba(var(--shadow-rgb), 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 200;
  display: flex; justify-content: flex-start;
  animation: fadeIn 0.2s ease;
}
.v-author-pane {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  height: 100vh;
  background: var(--paper);
  padding: 32px 24px;
  overflow-x: auto;
  box-shadow: 8px 0 32px rgba(var(--shadow-rgb), 0.1);
  animation: slideInV 0.25s ease;
}
@keyframes slideInV { from { transform: translateX(-100%); } to { transform: translateX(0); } }
.v-pane-close {
  display: block;
  width: 32px; height: 32px;
  border: 1px solid var(--border); border-radius: 4px;
  background: none; font-size: 14px;
  color: var(--ink-light); cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 16px;
}
.v-pane-close:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.v-pane-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-left: 20px;
  border-left: 1px solid var(--border);
}
.v-pane-seal {
  width: 56px; height: 56px;
  border: 2px solid var(--vermillion); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 900;
  color: var(--vermillion);
  margin-bottom: 12px;
}
.v-pane-name {
  font-size: 28px; font-weight: 900;
  letter-spacing: 6px; color: var(--ink);
}
.v-pane-bio {
  font-size: 16px; line-height: 2.4;
  color: var(--ink-mid);
  padding-left: 16px;
  border-left: 1px solid var(--border);
}
.v-pane-p {
  margin-bottom: 0;
  margin-left: 12px;
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
@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

@media (max-width: 768px) {
  .h-content { padding: 30px 20px; }
}
</style>
