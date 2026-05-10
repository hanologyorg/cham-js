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
import BackToTop from '../components/BackToTop.vue'
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

// Keyboard navigation
onMounted(() => {
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const adj = adjacent.value
    if (isVertical.value) {
      if (e.key === 'ArrowLeft' && adj.next !== null) { e.preventDefault(); navigate(1) }
      if (e.key === 'ArrowRight' && adj.prev !== null) { e.preventDefault(); navigate(-1) }
    } else {
      if (e.key === 'ArrowRight' && adj.next !== null) { e.preventDefault(); navigate(1) }
      if (e.key === 'ArrowLeft' && adj.prev !== null) { e.preventDefault(); navigate(-1) }
    }
    if (e.key === 'Escape') { e.preventDefault(); goBack() }
  }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
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
  if (!annotationsVisible.value) return []
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

const CHAM_LOGO_URL = import.meta.env.CHAM_LOGO_URL || ''

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

const selectedAuthorDynasty = computed(() => {
  const name = selectedAuthorName.value
  const a = getAuthor(name)
  return a?.dynasty || piece.value?.dynasty || ''
})

const selectedAuthorPoemCount = computed(() => {
  const name = selectedAuthorName.value
  const a = getAuthor(name)
  return a?.poemCount || 0
})

const selectedAuthorData = computed(() => {
  const name = selectedAuthorName.value
  return getAuthor(name)
})

const authorLifespan = computed(() => {
  const a = selectedAuthorData.value
  if (!a?.born && !a?.died) return ''
  if (a.born && a.died) return `${a.born}–${a.died}`
  return a.born ? `${a.born}–` : `?–${a.died}`
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

const ROLE_LABELS: Record<string, string> = {
  author: '作者',
  commentator: '註者',
  editor: '編者',
  translator: '譯者',
  annotator: '注者',
}

const contributorGroups = computed(() => {
  const c = piece.value?.contributors
  if (!c || c.length <= 1) return []
  const groups = new Map<string, string[]>()
  for (const x of c) {
    const t = x.title || ROLE_LABELS[x.role] || '作者'
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
              :has-annotations="true"
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
        <div v-else-if="piece.annotations.length > 0 || piece.sections.annotations" class="v-layers-inline v-section">
          <AnnotationControlBar
            :layers="annotationLayers"
            :has-annotations="true"
            v-model:active-ids="activeLayerIds"
            v-model:annotations-visible="annotationsVisible"
          />
        </div>

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
        <Transition name="overlay">
          <div v-if="authorPaneOpen" class="v-overlay" @click="closeAuthorPane">
            <div class="v-author-pane" @click.stop>
              <button class="v-pane-close" @click="closeAuthorPane">✕</button>
              <div class="v-pane-header">
                <div class="v-pane-name">{{ selectedAuthorName }}</div>
                <div class="v-pane-meta">
                  <span v-if="selectedAuthorDynasty">{{ selectedAuthorDynasty }}</span>
                  <span v-if="authorLifespan">{{ authorLifespan }}</span>
                  <span v-if="selectedAuthorPoemCount" class="v-pane-count">{{ selectedAuthorPoemCount }} 篇</span>
                </div>
                <div v-if="selectedAuthorData?.courtesyName || selectedAuthorData?.artName" class="v-pane-names">
                  <span v-if="selectedAuthorData?.courtesyName">字{{ selectedAuthorData.courtesyName }}</span>
                  <span v-if="selectedAuthorData?.artName">號{{ selectedAuthorData.artName }}</span>
                </div>
              </div>
              <div class="v-pane-links">
                <a v-if="selectedAuthorData?.ctextId" :href="`https://ctext.org/wiki.pl?if=en&res=${selectedAuthorData.ctextId}`" target="_blank" rel="noopener" class="v-pane-link">CTEXT</a>
                <a v-if="selectedAuthorData?.wikipediaZh" :href="selectedAuthorData.wikipediaZh" target="_blank" rel="noopener" class="v-pane-link">維基</a>
                <a v-if="selectedAuthorData?.wikipediaEn" :href="selectedAuthorData.wikipediaEn" target="_blank" rel="noopener" class="v-pane-link">Wikipedia</a>
                <a v-if="selectedAuthorData?.wikidata" :href="`https://www.wikidata.org/wiki/${selectedAuthorData.wikidata}`" target="_blank" rel="noopener" class="v-pane-link">Wikidata</a>
              </div>
              <div v-if="selectedAuthorBio" class="v-pane-bio">
                <div v-for="p in selectedAuthorBio.split('\n').filter(l => l.trim())" :key="p" class="v-pane-p">
                  {{ p.trim() }}
                </div>
              </div>
              <div v-if="!selectedAuthorBio" class="v-pane-empty">暫無作者資料</div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>

    <!-- ═══════ 橫排模式 ═══════ -->
    <div v-else class="h-root">
      <ReadingProgress />
      <div class="h-page">
        <nav class="h-nav">
          <div class="h-nav-inner">
            <button class="h-back" @click="goBack">← 返回</button>
            <div class="h-nav-title-row">
              <span v-if="piece.dynasty" class="h-dynasty">{{ piece.dynasty }}</span>
              <span class="h-breadcrumb">
                <span v-if="piece.source?.textRef" class="h-source-link" @click="router.push(`/${piece.source.textRef}`)">
                  {{ meta?.title }} →
                </span>
                <span class="h-sep">{{ piece.num }}.</span>
                {{ piece.title }}
              </span>
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
              <span class="h-tag h-tag-pager">{{ piece.num }} / {{ pieces.length }}</span>
              <template v-if="isMultiPart">
                <span class="h-tag">{{ piece.parts!.length }} 段</span>
                <span class="h-tag">{{ totalPartAnnotationCount > 0 ? totalPartAnnotationCount + ' 注' : '無注' }}</span>
              </template>
              <template v-else>
                <span class="h-tag">{{ piece.verses.length }} 段</span>
                <span class="h-tag">{{ totalAnnotationCount > 0 ? totalAnnotationCount + ' 注' : '無注' }}</span>
              </template>
              <button v-if="adjacent.prev !== null" class="h-nav-arrow" @click="navigate(-1)" title="上一篇">←</button>
              <button v-if="adjacent.next !== null" class="h-nav-arrow" @click="navigate(1)" title="下一篇">→</button>
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
            <div v-if="piece.annotations.length > 0 || piece.sections.annotations || hasLayers" class="h-ann-section">
              <AnnotationControlBar
                :layers="annotationLayers"
                :has-annotations="true"
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
              <template v-if="hasLayers && annotationsVisible">
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

      <BackToTop />

      <Teleport to="body">
        <Transition name="overlay">
          <div v-if="authorPaneOpen" class="h-overlay" @click="closeAuthorPane">
            <div class="h-pane" @click.stop>
              <button class="h-pane-close" @click="closeAuthorPane">✕</button>
              <div class="h-pane-header">
                <div>
                  <div class="h-pane-name">{{ selectedAuthorName }}</div>
                  <div class="h-pane-meta">
                    <span v-if="selectedAuthorDynasty" class="h-pane-dynasty">{{ selectedAuthorDynasty }}</span>
                    <span v-if="authorLifespan" class="h-pane-lifespan">{{ authorLifespan }}</span>
                    <span v-if="selectedAuthorPoemCount" class="h-pane-count">{{ selectedAuthorPoemCount }} 篇收錄</span>
                  </div>
                  <div v-if="selectedAuthorData?.courtesyName || selectedAuthorData?.artName" class="h-pane-alt-names">
                    <span v-if="selectedAuthorData?.courtesyName">字 {{ selectedAuthorData.courtesyName }}</span>
                    <span v-if="selectedAuthorData?.artName">號 {{ selectedAuthorData.artName }}</span>
                  </div>
                </div>
              </div>
              <div class="h-pane-links">
                <a v-if="selectedAuthorData?.ctextId" :href="`https://ctext.org/wiki.pl?if=en&res=${selectedAuthorData.ctextId}`" target="_blank" rel="noopener" class="h-pane-link">
                  <span class="link-icon">文</span> CTEXT
                </a>
                <a v-if="selectedAuthorData?.wikipediaZh" :href="selectedAuthorData.wikipediaZh" target="_blank" rel="noopener" class="h-pane-link">
                  <span class="link-icon">維</span> 維基百科
                </a>
                <a v-if="selectedAuthorData?.wikipediaEn" :href="selectedAuthorData.wikipediaEn" target="_blank" rel="noopener" class="h-pane-link">
                  <span class="link-icon">W</span> Wikipedia
                </a>
                <a v-if="selectedAuthorData?.wikidata" :href="`https://www.wikidata.org/wiki/${selectedAuthorData.wikidata}`" target="_blank" rel="noopener" class="h-pane-link">
                  <span class="link-icon">Q</span> Wikidata
                </a>
              </div>
              <div v-if="selectedAuthorBio" class="h-pane-bio">
                <div v-for="p in selectedAuthorBio.split('\n').filter(l => l.trim())" :key="p" class="h-pane-p">
                  {{ p.trim() }}
                </div>
              </div>
              <div v-if="!selectedAuthorBio" class="h-pane-empty">暫無作者資料</div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>

  <div v-else class="loading">
    <img v-if="CHAM_LOGO_URL" :src="CHAM_LOGO_URL" alt="" class="loading-logo" />
    <div v-else class="loading-seal">文</div>
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
.h-back:active { transform: scale(0.97); }

.h-nav-title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  min-width: 0;
}

.h-dynasty {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--vermillion);
  color: #fff;
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.h-breadcrumb {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
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
.h-tag-pager {
  background: var(--surface-warm);
  font-weight: 600;
  color: var(--ink-mid);
}

.h-nav-arrow {
  width: 32px; height: 32px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  font-family: var(--sans);
  font-size: 16px;
  color: var(--ink-light);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.h-nav-arrow:hover {
  border-color: var(--vermillion);
  color: var(--vermillion);
}
.h-nav-arrow:active { transform: scale(0.95); }

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
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
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
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
.h-nav-btn {
  padding: 20px 24px;
  background: var(--surface); border: 1px solid var(--border-light);
  border-radius: 8px; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: var(--serif);
  text-align: left;
  position: relative;
  overflow: hidden;
}
.h-nav-btn::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: var(--vermillion);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}
.h-nav-btn:hover {
  border-color: var(--gold);
  box-shadow: 0 8px 32px rgba(var(--shadow-rgb), 0.1);
  transform: translateY(-2px);
}
.h-nav-btn:hover::after { transform: scaleX(1); }
.h-nav-btn:active { transform: scale(0.98); }
.h-nav-btn.h-nav-next { text-align: right; }
.h-nav-label { font-size: 11px; color: var(--ink-faint); font-family: var(--sans); letter-spacing: 2px; margin-bottom: 4px; }
.h-nav-title { font-size: 16px; font-weight: 600; letter-spacing: 1px; color: var(--ink); }

.h-overlay {
  position: fixed; inset: 0;
  background: rgba(var(--shadow-rgb), 0.24);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 200;
  display: flex; justify-content: flex-end;
}
.h-pane {
  width: min(420px, 90vw);
  height: 100vh;
  background: var(--paper);
  padding: 32px;
  overflow-y: auto;
  box-shadow: -8px 0 32px rgba(var(--shadow-rgb), 0.1);
}

/* Overlay transition */
.overlay-enter-active { transition: opacity var(--dur-mid, 0.25s) ease; }
.overlay-enter-active .h-pane { transition: transform var(--dur-mid, 0.25s) cubic-bezier(0.34, 1.56, 0.64, 1); }
.overlay-leave-active { transition: opacity var(--dur-fast, 0.15s) ease; }
.overlay-leave-active .h-pane { transition: transform var(--dur-fast, 0.15s) ease; }
.overlay-enter-from { opacity: 0; }
.overlay-enter-from .h-pane { transform: translateX(100%); }
.overlay-leave-to { opacity: 0; }
.overlay-leave-to .h-pane { transform: translateX(40px); }
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
.h-pane-meta { font-size: 14px; color: var(--ink-faint); letter-spacing: 2px; margin-top: 6px; display: flex; align-items: center; gap: 8px; }
.h-pane-dynasty {
  display: inline-flex;
  padding: 2px 8px;
  background: var(--vermillion);
  color: #fff;
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  border-radius: 3px;
}
.h-pane-count {
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}
.h-pane-lifespan {
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-light);
  letter-spacing: 1px;
}
.h-pane-alt-names {
  font-size: 14px;
  color: var(--ink-light);
  letter-spacing: 2px;
  margin-top: 6px;
  display: flex;
  gap: 12px;
}
.h-pane-links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0 0;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}
.h-pane-link {
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
  transition: all 0.15s;
}
.h-pane-link:hover {
  border-color: var(--vermillion);
  color: var(--vermillion);
}
.h-pane-link .link-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  background: var(--surface-warm);
  font-size: 10px;
  font-weight: 700;
}
.h-pane-empty {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-faint);
  font-family: var(--sans);
  font-size: 14px;
  letter-spacing: 2px;
}
.h-pane-bio { border-top: 1px solid var(--border); padding-top: 24px; }
.h-pane-p {
  font-size: 16px; line-height: 2.2;
  color: var(--ink-mid); text-align: justify;
  text-indent: 2em; margin-bottom: 12px;
}

.v-overlay {
  position: fixed; inset: 0;
  background: rgba(var(--shadow-rgb), 0.24);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 200;
  display: flex; justify-content: flex-start;
}
.v-author-pane {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  height: 100vh;
  background: var(--paper);
  padding: 32px 24px;
  overflow-x: auto;
  box-shadow: 8px 0 32px rgba(var(--shadow-rgb), 0.1);
}
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
.v-pane-meta {
  font-size: 13px;
  color: var(--ink-faint);
  font-family: var(--sans);
  letter-spacing: 2px;
  display: flex;
  gap: 8px;
  margin-left: 4px;
}
.v-pane-count {
  font-size: 12px;
  color: var(--ink-faint);
  letter-spacing: 1px;
}
.v-pane-names {
  font-size: 14px;
  color: var(--ink-light);
  letter-spacing: 2px;
  display: flex;
  gap: 8px;
  margin-left: 4px;
}
.v-pane-links {
  display: flex;
  gap: 8px;
  padding-left: 16px;
  border-left: 1px solid var(--border);
  margin-bottom: 16px;
}
.v-pane-link {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--sans);
  font-size: 11px;
  color: var(--ink-mid);
  text-decoration: none;
  letter-spacing: 1px;
  transition: all 0.15s;
}
.v-pane-link:hover {
  border-color: var(--vermillion);
  color: var(--vermillion);
}
.v-pane-empty {
  font-size: 14px;
  color: var(--ink-faint);
  font-family: var(--sans);
  letter-spacing: 2px;
  padding-left: 16px;
  border-left: 1px solid var(--border);
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
.loading-logo {
  width: 56px; height: auto;
  object-fit: contain;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* ─── 觸控回饋 ─── */
.v-nav-btn:active { transform: scale(0.97); }
.h-back:active { transform: scale(0.97); }
.h-source-link:active { opacity: 1; }
.v-source-link:active { opacity: 1; }
.v-poem-author:active { color: var(--vermillion); }
.h-author-link:active { color: var(--vermillion); }

/* ═══════ 行動裝置適配 ═══════ */

@media (max-width: 768px) {
  /* ─── 直排模式 ─── */
  .v-page { margin-right: var(--nav-width, 44px); }
  .v-title-col { padding: 24px 16px; }
  .v-poem-title { font-size: 32px; letter-spacing: 8px; }
  .v-poem-author { font-size: 20px; }
  .v-poem-col { padding: 16px; }

  /* ─── 橫排模式導航 ─── */
  .h-nav { padding: 0 16px; }
  .h-nav-inner {
    height: auto;
    min-height: 48px;
    flex-wrap: wrap;
    padding: 8px 0;
    gap: 6px 12px;
  }
  .h-back {
    padding: 6px 10px;
    font-size: 12px;
  }
  .h-nav-title-row {
    font-size: 14px;
    order: 3;
    width: 100%;
    overflow: hidden;
  }
  .h-breadcrumb {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .h-dynasty { font-size: 10px; padding: 1px 6px; }
  .h-sep { margin: 0 4px; }
  .h-controls {
    margin-left: 0;
    gap: 4px;
  }
  .h-tag {
    padding: 3px 8px;
    font-size: 11px;
  }
  .h-nav-arrow { width: 28px; height: 28px; font-size: 14px; }

  /* ─── 橫排內容 ─── */
  .h-content { padding: 24px 16px; }
  .h-poem-block { margin-bottom: 40px; }

  .h-multipart {
    padding: 20px 16px;
    border-radius: 6px;
  }

  .h-sections {
    padding-bottom: 60px;
  }

  .h-ann-section {
    margin-bottom: 12px;
  }

  /* ─── 上/下篇導航 ─── */
  .h-nav-bottom {
    gap: 10px;
    margin: 0 auto 32px;
  }
  .h-nav-btn {
    padding: 16px;
    border-radius: 6px;
  }
  .h-nav-title { font-size: 14px; }
  .h-nav-label { font-size: 10px; }

  /* ─── 作者面板 ─── */
  .h-overlay { justify-content: center; align-items: flex-end; }
  .h-pane {
    width: 100%;
    max-height: 85vh;
    height: auto;
    border-radius: 16px 16px 0 0;
    padding: 20px;
  }
  .overlay-enter-from .h-pane { transform: translateY(100%); }
  .overlay-leave-to .h-pane { transform: translateY(40px); }

  .h-pane-name { font-size: 24px; }
  .h-pane-p { font-size: 15px; line-height: 2; }
}

@media (max-width: 480px) {
  .h-nav-bottom {
    grid-template-columns: 1fr;
  }
  .h-nav-btn.h-nav-next { text-align: left; }
  .h-nav-title-row { font-size: 13px; }
  .h-nav-arrow { display: none; }
}
</style>
