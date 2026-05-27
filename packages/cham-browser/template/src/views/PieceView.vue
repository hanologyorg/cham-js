<script setup lang="ts">
import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBook } from '../composables/useBook'
import { useTitle } from '../composables/useTitle'
import { useReadingMode, FONT_SIZES } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import { useAnnotationInteraction } from '../composables/useAnnotationInteraction'
import { useData } from '../composables/useData'
import { useI18n } from '../composables/useI18n'
import VerticalScroll from '../components/VerticalScroll.vue'
import HorizontalDisplay from '../components/HorizontalDisplay.vue'
import SectionBlock from '../components/SectionBlock.vue'
import AnnotationTooltip from '../components/AnnotationTooltip.vue'
import AnnotationPane from '../components/AnnotationPane.vue'
import AnnotationControlBar from '../components/AnnotationControlBar.vue'
import SideNav from '../components/SideNav.vue'
import PartGroup from '../components/PartGroup.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import BackToTop from '../components/BackToTop.vue'
import AuthorPane from '../components/AuthorPane.vue'
import { toChineseNumber } from '../utils/chineseNumber'
import type { Piece, Annotation, AnnotationLayer, Part } from '../types'

const props = defineProps<{ bookId: string; num: string | number }>()
const router = useRouter()
const { getPiece, pieces, meta, load, getAdjacentNums } = useBook()
await load(props.bookId)

const { layout, annotationsVisible: prefAnnotationsVisible, annotationPane, mainFontSize, setMainFontSize } = useReadingMode()
const vPageRef = ref<HTMLElement | null>(null)
const vScroll = useHorizontalScroll(vPageRef)
const { t } = useI18n()

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

// Track current section in vertical mode
let sectionCache: { key: string; el: Element }[] = []
let rafId = 0

function rebuildSectionCache() {
  const container = vPageRef.value
  if (!container) { sectionCache = []; return }
  const cache: { key: string; el: Element }[] = []
  const titleCol = container.querySelector('.v-title-col')
  if (titleCol) cache.push({ key: 'title', el: titleCol })
  for (const block of container.querySelectorAll('[data-section-key]')) {
    cache.push({ key: block.getAttribute('data-section-key')!, el: block })
  }
  sectionCache = cache
}

function updateCurrentSection() {
  if (!vPageRef.value || !isVertical.value) return
  if (!sectionCache.length) rebuildSectionCache()
  const containerRect = vPageRef.value.getBoundingClientRect()
  const viewportCenter = containerRect.left + containerRect.width / 2

  let best = 'title'
  for (const s of sectionCache) {
    const r = s.el.getBoundingClientRect()
    if (viewportCenter >= r.left && viewportCenter <= r.right) {
      best = s.key
      break
    }
  }
  if (best === 'title') {
    let bestDist = Infinity
    for (const s of sectionCache) {
      const r = s.el.getBoundingClientRect()
      const center = (r.left + r.right) / 2
      const dist = Math.abs(center - viewportCenter)
      if (dist < bestDist) { bestDist = dist; best = s.key }
    }
  }
  currentSection.value = best
}

onMounted(() => {
  const el = vPageRef.value
  if (!el) return
  const onScroll = () => {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(updateCurrentSection)
  }
  el.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => {
    el.removeEventListener('scroll', onScroll)
    cancelAnimationFrame(rafId)
  })
})

watch(() => piece.value?.id, () => {
  sectionCache = []
  nextTick(rebuildSectionCache)
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
const toggleableLayers = computed(() => annotationLayers.value.filter(l => l.id !== 'default'))
const activeLayerIds = ref<string[]>([])
const annotationsVisible = prefAnnotationsVisible

function toggleLayer(id: string) {
  const current = activeLayerIds.value
  if (current.includes(id)) {
    const next = current.filter(x => x !== id)
    activeLayerIds.value = next
    if (next.length === 0) annotationsVisible.value = false
  } else {
    activeLayerIds.value = [...current, id]
    annotationsVisible.value = true
  }
}
const paneVisible = ref(false)
const paneActiveId = ref('')

function onAnnotationHover(event: MouseEvent, annotations: Annotation[]) {
  if (annotationPane.value && isVertical.value) {
    paneActiveId.value = annotations[0]?.id || ''
  } else {
    interaction.onHover(event, annotations)
  }
}
function onAnnotationLeave() {
  if (annotationPane.value && isVertical.value) return
  interaction.onLeave()
}
function onAnnotationTap(event: MouseEvent, annotations: Annotation[]) {
  if (annotationPane.value && isVertical.value) {
    if (!paneVisible.value) paneVisible.value = true
    paneActiveId.value = annotations[0]?.id || ''
  } else {
    interaction.onTap(event, annotations)
  }
}
function onPaneSelect(ann: Annotation) {
  const el = document.querySelector(`[data-ann-ids*="${ann.id}"]`) as HTMLElement | null
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    el.classList.add('ann-flash')
    setTimeout(() => el.classList.remove('ann-flash'), 1500)
  }
}
const annotationHeadwords = computed(() => {
  const result: Record<string, string> = {}
  for (const ann of mergedAnnotations.value) {
    result[ann.id] = getHeadword(ann)
  }
  return result
})

watch([annotationPane, isVertical], ([pane, vert]) => {
  if (pane && vert) {
    interaction.dismiss()
  } else {
    paneVisible.value = false
  }
})

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

const SECTION_META: Record<string, { special: boolean }> = {
  background: { special: false },
  analysis: { special: false },
  preparation: { special: true },
  follow_up: { special: true },
  think_questions: { special: true },
}

const sectionNavItems = computed(() => {
  const items: { key: string; short: string; label: string }[] = []
  items.push({ key: 'verse', short: t('section.short.verse'), label: t('section.verse') })
  const hasAnn = piece.value?.annotations.length > 0 || piece.value?.sections.annotations || hasLayers.value
  if (hasAnn) {
    items.push({ key: 'annotations', short: t('section.short.annotations'), label: t('annotation.notes') })
  }
  for (const sec of proseSections.value) {
    items.push({ key: sec.key, short: t('section.short.' + sec.key) || sec.title.charAt(0), label: sec.title })
  }
  return items
})

function toggleAnnotationsPreserveScroll() {
  const el = vPageRef.value
  const scrollLeft = el?.scrollLeft ?? 0
  annotationsVisible.value = !annotationsVisible.value
  requestAnimationFrame(() => { if (el) el.scrollLeft = scrollLeft })
}

function scrollToSection(key: string) {
  const container = isVertical.value ? vPageRef.value : document.documentElement
  if (!container) return
  let el: Element | null
  if (key === 'verse') {
    el = container.querySelector('.v-title-col, .h-poem-block') || container.querySelector('.v-poem-col')
  } else if (key === 'annotations') {
    el = container.querySelector('.h-ann-section, [data-section-key="annotations"]')
  } else {
    const blocks = container.querySelectorAll('[data-section-key]')
    el = [...blocks].find(b => b.getAttribute('data-section-key') === key) || null
  }
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' })
}

function fontSizeUp() {
  const idx = FONT_SIZES.indexOf(mainFontSize.value)
  if (idx < FONT_SIZES.length - 1) setMainFontSize(FONT_SIZES[idx + 1])
}
function fontSizeDown() {
  const idx = FONT_SIZES.indexOf(mainFontSize.value)
  if (idx > 0) setMainFontSize(FONT_SIZES[idx - 1])
}

const currentSection = ref('')
const tocOpen = ref(false)

const tocItems = computed(() => {
  const p = piece.value
  const items: { key: string; label: string; context?: string; level: number }[] = [
    { key: 'title', label: p?.title || '', context: `${p?.num}. `, level: 0 },
  ]
  if (isMultiPart.value && p?.parts) {
    for (const part of p.parts) {
      const chapter = part.source?.range?.chapter
      if (chapter) {
        items.push({ key: `part-${part.num}`, label: chapter, context: `（${toChineseNumber(part.num)}）`, level: 1 })
      }
    }
  } else {
    items.push({ key: 'verse', label: t('section.verse'), level: 1 })
  }
  const hasAnn = p?.annotations.length > 0 || p?.sections.annotations || hasLayers.value
  if (hasAnn) {
    items.push({ key: 'annotations', label: t('annotation.notes'), level: 1 })
  }
  let secIdx = 1
  for (const sec of proseSections.value) {
    const isSpecial = SECTION_META[sec.key]?.special ?? false
    items.push({ key: sec.key, label: sec.title, context: toChineseNumber(secIdx), level: isSpecial ? 2 : 1 })
    secIdx++
  }
  return items
})

const proseSections = computed(() => {
  const ss = piece.value?.structuredSections
  if (ss && ss.length > 0) {
    return ss.filter(s => s.key !== 'author_bio' && s.body)
  }
  const sections = piece.value?.sections || {}
  const result: { key: string; title: string; body: string; order: number; special: boolean }[] = []
  for (const [key, i18nKey] of Object.entries({ background: 'section.background', analysis: 'section.analysis', preparation: 'section.preparation', follow_up: 'section.follow_up', think_questions: 'section.think_questions' })) {
    if (sections[key]) {
      const meta = SECTION_META[key]
      result.push({ key, title: t(i18nKey), body: sections[key], order: meta ? (key === 'background' ? 1 : key === 'analysis' ? 2 : 3) : 99, special: meta?.special ?? false })
    }
  }
  return result
})


const { getAuthor, getAuthorIndex, loadAuthorDetail, loadShared } = useData()
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

const selectedAuthorEra = computed(() => {
  const name = selectedAuthorName.value
  const a = getAuthor(name)
  return a?.era || getAuthorIndex(name)?.era || piece.value?.era || ''
})

const selectedAuthorWorkCount = computed(() => {
  const name = selectedAuthorName.value
  const a = getAuthor(name)
  return a?.workCount || getAuthorIndex(name)?.workCount || 0
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
  loadAuthorDetail(selectedAuthorId.value)
}
function closeAuthorPane() { authorPaneOpen.value = false; selectedAuthorId.value = '' }
function goBack() { router.push(`/${props.bookId}`) }
function goHome() { router.push('/') }

function navigate(delta: number) {
  if (!piece.value) return
  const target = delta < 0 ? adjacent.value.prev : adjacent.value.next
  if (target !== null) router.push(`/${props.bookId}/${target}`)
}

const ROLE_LABELS = computed(() => ({
  author: t('role.author'),
  commentator: t('role.commentator'),
  editor: t('role.editor'),
  translator: t('role.translator'),
  annotator: t('role.annotator'),
}))

const contributorGroups = computed(() => {
  const c = piece.value?.contributors
  if (!c || c.length <= 1) return []
  const groups = new Map<string, string[]>()
  for (const x of c) {
    const t = x.title || ROLE_LABELS.value[x.role] || t('role.defaultAuthor')
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
  <template v-if="piece">
  <div>
    <!-- ═══════ 直排模式 ═══════ -->
    <div v-if="isVertical" class="v-root">
      <SideNav
        :context="`${piece.num}. ${piece.title}`"
        :poem-title="piece.title"
        :poem-author="piece.author"
        :title-collapsed="titleCollapsed"
        :has-prev="adjacent.prev !== null"
        :has-next="adjacent.next !== null"
        @back="goBack"
        @home="goHome"
        @navigate="navigate"
      />
      <ReadingProgress vertical :scroll-container="vPageRef" />
      <div ref="vPageRef" class="v-page">
        <section ref="vTitleRef" class="v-title-col">
          <h1 class="v-poem-title">{{ piece.title }}</h1>
          <template v-if="piece.contributors && piece.contributors.length > 1">
            <div v-for="group in contributorGroups" :key="group.title" class="v-author-group">
              <span class="v-author-role">{{ group.title }}</span>
              <button v-for="name in group.names" :key="name" class="v-poem-author unstyled" @click="openAuthorPane(piece.contributors!.find(c => c.name === name)?.id)" @keydown.enter="openAuthorPane(piece.contributors!.find(c => c.name === name)?.id)">{{ name }}</button>
            </div>
          </template>
          <button class="v-poem-author unstyled" tabindex="0" @click="openAuthorPane" @keydown.enter="openAuthorPane">{{ piece.author }}</button>
          <router-link v-if="piece.source?.textRef" :to="`/${piece.source.textRef}`" class="v-source-link">
            ← {{ meta?.title }}
          </router-link>
          <div class="v-poem-meta">
            <template v-if="isMultiPart">
              <span class="v-meta-item" v-html="tcy(piece.parts!.length) + ' ' + t('piece.stanzas')" />
              <span class="v-meta-item" v-html="totalPartAnnotationCount > 0 ? tcy(totalPartAnnotationCount) + ' ' + t('piece.notes') : t('piece.noNotes')" />
            </template>
            <template v-else>
              <span class="v-meta-item" v-html="tcy(piece.verses.length) + ' ' + t('piece.stanzas')" />
              <span class="v-meta-item" v-html="totalAnnotationCount > 0 ? tcy(totalAnnotationCount) + ' ' + t('piece.notes') : t('piece.noNotes')" />
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
            :annotations-visible="annotationsVisible"
            @annotation-hover="onAnnotationHover"
            @annotation-leave="onAnnotationLeave"
            @annotation-tap="onAnnotationTap"
            @toggle-annotations="toggleAnnotationsPreserveScroll"
          />
        </section>

        <section v-else class="v-poem-col">
          <VerticalScroll
            :title="''"
            :author="''"
            :verses="piece.verses"
            :author-initial="piece.author?.charAt(0) || t('piece.defaultAuthorInitial')"
            :annotations="mergedAnnotations"
            @annotation-hover="onAnnotationHover"
            @annotation-leave="onAnnotationLeave"
            @annotation-tap="onAnnotationTap"
            @open-author="openAuthorPane"
          />
        </section>

        <SectionBlock
          v-if="(isMultiPart ? hasLayers : (piece.sections.annotations || piece.annotations.length > 0 || hasLayers))"
          data-section-key="annotations"
          num=""
          :label="t('annotation.notes')"
          :special="false"
          :text="annotationsVisible ? (piece.sections.annotations || '') : ''"
          :is-annotations="true"
          :vertical="true"
          :always-show="true"
          :toggleable="true"
          :toggled-on="annotationsVisible"
          class="v-section v-indent-1"
          @toggle="toggleAnnotationsPreserveScroll"
        >
          <template v-if="hasLayers" #header-actions>
            <div class="v-layer-toggles">
              <button
                v-for="layer in toggleableLayers"
                :key="layer.id"
                class="v-layer-btn"
                :class="{ active: activeLayerIds.includes(layer.id) }"
                @click="toggleLayer(layer.id)"
                :title="layer.label"
              >{{ layer.shortLabel }}</button>
            </div>
          </template>
        </SectionBlock>
        <template v-if="hasLayers && annotationsVisible">
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
          v-for="(sec, idx) in proseSections"
          :key="sec.key"
          :data-section-key="sec.key"
          :num="String(idx + 1).padStart(2, '0')"
          :label="sec.title"
          :special="SECTION_META[sec.key]?.special ?? false"
          :text="sec.body"
          :is-annotations="false"
          :vertical="true"
          class="v-section"
          :class="SECTION_META[sec.key]?.special ? 'v-indent-2' : 'v-indent-1'"
        />

        <nav class="v-nav" aria-label="piece navigation">
          <button v-if="adjacent.prev !== null" class="v-nav-btn" @click="navigate(-1)" :aria-label="t('piece.previous')">
            <span class="v-nav-dir">▲</span>
            <span class="v-nav-title">{{ getPiece(adjacent.prev)?.title }}</span>
          </button>
          <div v-else class="v-nav-spacer" />
          <button v-if="adjacent.next !== null" class="v-nav-btn" @click="navigate(1)" :aria-label="t('piece.next')">
            <span class="v-nav-dir">▼</span>
            <span class="v-nav-title">{{ getPiece(adjacent.next)?.title }}</span>
          </button>
        </nav>
      </div>

      <AnnotationPane
        v-if="annotationPane"
        :visible="paneVisible"
        :annotations="mergedAnnotations"
        :headwords="annotationHeadwords"
        :layer-labels="layerLabels"
        :active-id="paneActiveId"
        :vertical="isVertical"
        @close="paneVisible = false"
        @select="onPaneSelect"
      />

      <AuthorPane
        :open="authorPaneOpen"
        :author="selectedAuthorData"
        :name="selectedAuthorName"
        :era="selectedAuthorEra"
        :work-count="selectedAuthorWorkCount"
        :lifespan="authorLifespan"
        vertical
        @close="closeAuthorPane"
      />

      <BackToTop vertical :scroll-container="vPageRef" />

      <!-- 底部浮動段落導航列 -->
      <nav class="v-section-bar" aria-label="section navigation">
        <button v-for="item in sectionNavItems" :key="item.key"
          class="v-sec-item" :class="{ active: currentSection === item.key }"
          @click="scrollToSection(item.key)" :title="item.label">
          {{ item.short }}
        </button>
      </nav>

      <!-- 右側 TOC 條 + 麵包屑 -->
      <button class="v-toc-strip" :class="{ open: tocOpen }" @click="tocOpen = !tocOpen" :aria-label="t('nav.contents')" :aria-expanded="tocOpen">
        <svg class="v-toc-hamburger" viewBox="0 0 12 48" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">
          <line x1="2" y1="4" x2="2" y2="44" />
          <line x1="6" y1="4" x2="6" y2="44" />
          <line x1="10" y1="4" x2="10" y2="44" />
        </svg>
        <div v-if="currentSection && currentSection !== 'title'" class="v-toc-breadcrumb">
          <span>{{ tocItems.find(i => i.key === currentSection)?.label || '' }}</span>
        </div>
      </button>

      <!-- 目錄彈出面板 -->
      <Teleport to="body">
        <Transition name="toc-slide">
          <div v-if="tocOpen" class="v-toc-overlay" @click="tocOpen = false">
            <div class="v-toc-panel" @click.stop>
              <div v-for="item in tocItems" :key="item.key"
                class="v-toc-item" :class="{ active: currentSection === item.key, ['v-toc-l' + item.level]: true }"
                @click="scrollToSection(item.key); tocOpen = false">
                <span v-if="item.context" class="v-toc-context">{{ item.context }}</span>
                <span class="v-toc-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>

    <!-- ═══════ 橫排模式 ═══════ -->
    <div v-else class="h-root">
      <ReadingProgress />
      <div class="h-page">
        <nav class="h-nav" aria-label="piece navigation">
          <div class="h-nav-inner">
            <button class="h-back" @click="goBack">← {{ t('nav.back') }}</button>
            <div class="h-nav-title-row">
              <span v-if="piece.era" class="h-era">{{ piece.era }}</span>
              <span class="h-breadcrumb">
                <router-link v-if="piece.source?.textRef" :to="`/${piece.source.textRef}`" class="h-source-link">
                  {{ meta?.title }} →
                </router-link>
                <span class="h-sep">{{ piece.num }}.</span>
                {{ piece.title }}
              </span>
              <template v-if="piece.contributors && piece.contributors.length > 1">
                <template v-for="(group, gi) in contributorGroups" :key="group.title">
                  <span v-if="gi > 0" class="h-sep">|</span>
                  <span class="h-author-role">{{ group.title }}</span>
                  <button v-for="name in group.names" :key="name" class="h-author-link unstyled" tabindex="0" @click="openAuthorPane(piece.contributors!.find(c => c.name === name)?.id)" @keydown.enter="openAuthorPane(piece.contributors!.find(c => c.name === name)?.id)">{{ name }}</button>
                </template>
              </template>
              <button v-else class="h-author-link unstyled" @click="openAuthorPane" @keydown.enter="openAuthorPane">{{ piece.author }}</button>
            </div>
            <div class="h-controls">
              <div class="h-section-nav">
                <button
                  v-for="item in sectionNavItems"
                  :key="item.key"
                  class="h-sec-btn"
                  @click="scrollToSection(item.key)"
                  :title="item.label"
                >{{ item.short }}</button>
              </div>
              <div class="h-font-btns">
                <button class="h-font-btn" @click="fontSizeDown" :title="t('nav.fontSizeDown')">A</button>
                <button class="h-font-btn h-font-btn-lg" @click="fontSizeUp" :title="t('nav.fontSizeUp')">A</button>
              </div>
              <span class="h-tag h-tag-pager">{{ piece.num }} / {{ pieces.length }}</span>
              <template v-if="isMultiPart">
                <span class="h-tag">{{ piece.parts!.length }} {{ t('piece.stanzas') }}</span>
                <span class="h-tag">{{ totalPartAnnotationCount > 0 ? totalPartAnnotationCount + ' ' + t('piece.notes') : t('piece.noNotes') }}</span>
              </template>
              <template v-else>
                <span class="h-tag">{{ piece.verses.length }} {{ t('piece.stanzas') }}</span>
                <span class="h-tag">{{ totalAnnotationCount > 0 ? totalAnnotationCount + ' ' + t('piece.notes') : t('piece.noNotes') }}</span>
              </template>
              <button v-if="adjacent.prev !== null" class="h-nav-arrow" @click="navigate(-1)" :title="t('piece.previous')">←</button>
              <button v-if="adjacent.next !== null" class="h-nav-arrow" @click="navigate(1)" :title="t('piece.next')">→</button>
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
              :annotations-visible="annotationsVisible"
              @annotation-hover="interaction.onHover"
              @annotation-leave="interaction.onLeave"
              @annotation-tap="interaction.onTap"
              @toggle-annotations="toggleAnnotationsPreserveScroll"
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
                :label="t('annotation.notes')"
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
              :data-section-key="sec.key"
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
              <div class="h-nav-label">← {{ t('piece.previous') }}</div>
              <div class="h-nav-title">{{ getPiece(adjacent.prev)?.title }}</div>
            </button>
            <div v-else />
            <button v-if="adjacent.next !== null" class="h-nav-btn h-nav-next" @click="navigate(1)">
              <div class="h-nav-label">{{ t('piece.next') }} →</div>
              <div class="h-nav-title">{{ getPiece(adjacent.next)?.title }}</div>
            </button>
          </div>
        </div>
      </div>

      <BackToTop />

      <AuthorPane
        :open="authorPaneOpen"
        :author="selectedAuthorData"
        :name="selectedAuthorName"
        :era="selectedAuthorEra"
        :work-count="selectedAuthorWorkCount"
        :lifespan="authorLifespan"
        @close="closeAuthorPane"
      />
    </div>
  </div>

  <AnnotationTooltip
    v-if="piece && !(annotationPane && isVertical)"
    :visible="interaction.visible"
    :annotations="interaction.items"
    :headword="interaction.headword"
    :layer-labels="layerLabels"
    :style="interaction.style"
    :vertical="isVertical"
    @close="interaction.dismiss"
    @tooltip-enter="interaction.onTooltipEnter"
    @tooltip-leave="interaction.onTooltipLeave"
  />
  </template>

  <div v-else class="page-loading">
    <img v-if="CHAM_LOGO_URL" :src="CHAM_LOGO_URL" alt="" width="56" height="56" class="page-loading-logo" />
    <div v-else class="page-loading-seal">文</div>
  </div>
</template>

<style scoped>
/* ═══════ 直排模式 ═══════ */

.v-page {
  --v-indent-0: 24px;
  --v-indent-1: 40px;
  --v-indent-2: 56px;
  --v-pad: 20px;
  padding: 0;
  background: var(--paper);
  margin-right: calc(var(--nav-width, 56px) + 28px);
}

.v-title-col {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100dvh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 16px;
  padding: var(--v-indent-0) var(--v-pad);
  border-right: 1px solid var(--border);
  scroll-snap-align: start;
  position: relative;
  z-index: 1;
}
.v-poem-title {
  font-size: 40px; font-weight: 900;
  letter-spacing: 10px; color: var(--ink);
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
  padding: var(--v-indent-0) var(--v-pad);
}

.v-multipart {
  display: flex;
  flex-direction: row-reverse;
  align-items: stretch;
  gap: 0;
  height: 100dvh;
  box-sizing: border-box;
  padding: var(--v-indent-0) var(--v-pad);
}

.v-section {
  flex-shrink: 0;
}
.v-indent-1 { --v-indent: var(--v-indent-1); }
.v-indent-2 { --v-indent: var(--v-indent-2); }

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
  height: 100dvh;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: var(--v-indent-0) var(--v-pad);
  gap: 32px;
  scroll-snap-align: start;
  background: var(--surface);
  border-right: 1px solid var(--border-light);
  margin-right: auto;
}
.v-nav-spacer { flex: 1; }
.v-nav-btn {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 20px 14px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  line-height: 1.6;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  max-height: calc(100dvh - var(--v-indent-0) * 2);
  gap: 4px;
}
.v-nav-btn:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 20px rgba(var(--shadow-rgb), 0.1);
}
.v-nav-btn:hover .v-nav-title { color: var(--vermillion); }
.v-nav-dir {
  font-size: 16px; color: var(--vermillion);
  flex-shrink: 0;
}
.v-nav-title {
  display: block;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-height: calc(100dvh - var(--v-indent-0) * 2 - 40px - 16px);
  font-size: 18px; font-weight: 700;
  letter-spacing: 3px; color: var(--ink);
  transition: color 0.25s ease;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  transition: background-color 0.2s, color 0.2s, border-color 0.2s; white-space: nowrap;
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

.h-era {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--vermillion);
  color: var(--paper);
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
.h-controls { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.h-section-nav {
  display: flex;
  gap: 3px;
}
.h-sec-btn {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: none;
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-light);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
  letter-spacing: 0;
}
.h-sec-btn:hover {
  border-color: var(--vermillion);
  color: var(--vermillion);
}
.h-font-btns {
  display: flex;
  align-items: baseline;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 4px;
}
.h-font-btn {
  background: none;
  border: none;
  font-family: var(--serif);
  font-weight: 700;
  color: var(--ink-light);
  cursor: pointer;
  padding: 0 2px;
  transition: color 0.15s;
}
.h-font-btn:hover { color: var(--vermillion); }
.h-font-btn-lg { font-size: 15px; }
.h-font-btn:not(.h-font-btn-lg) { font-size: 11px; }
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
  border-radius: 6px;
  background: none;
  font-family: var(--sans);
  font-size: 16px;
  color: var(--ink-light);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
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
  transition: border-color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  background: linear-gradient(90deg, var(--vermillion), var(--gold));
  transform: scaleX(0);
  transition: transform 0.35s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}
.h-nav-btn:hover {
  border-color: var(--gold);
  box-shadow: 0 8px 32px rgba(var(--shadow-rgb), 0.1);
  transform: translateY(-3px);
}
.h-nav-btn:hover::after { transform: scaleX(1); }
.h-nav-btn:hover .h-nav-title { color: var(--vermillion); }
.h-nav-btn:active { transform: scale(0.98); }
.h-nav-btn.h-nav-next { text-align: right; }
.h-nav-label { font-size: 11px; color: var(--ink-faint); font-family: var(--sans); letter-spacing: 2px; margin-bottom: 4px; }
.h-nav-title { font-size: 16px; font-weight: 600; letter-spacing: 1px; color: var(--ink); transition: color 0.25s ease; }


/* ─── 觸控回饋 ─── */
.v-nav-btn:active { transform: scale(0.97); }
.h-back:active { transform: scale(0.97); }
.h-source-link:active { opacity: 1; }
.v-source-link:active { opacity: 1; }
.v-poem-author:active { color: var(--vermillion); }
.h-author-link:active { color: var(--vermillion); }

/* ─── 底部浮動段落導航列 ─── */
/* ─── 層級切換按鈕 ─── */
.v-layer-toggles {
  display: flex;
  flex-direction: row;
  gap: 4px;
}
.v-layer-btn {
  padding: 4px 10px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  background: none;
  color: var(--ink-faint);
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 3px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
  white-space: nowrap;
}
.v-layer-btn:hover { border-color: var(--vermillion); color: var(--vermillion); }
.v-layer-btn.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

/* ─── 底部浮動段落按鈕 ─── */
.v-section-bar {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(calc(-50% + var(--nav-width, 56px) / 2));
  display: flex;
  flex-direction: row-reverse;
  justify-content: center;
  gap: 8px;
  z-index: 150;
  writing-mode: horizontal-tb;
}
.v-sec-item {
  padding: 6px 14px;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(var(--shadow-rgb), 0.1);
  font-family: var(--serif);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-faint);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.v-sec-item:hover {
  border-color: var(--vermillion);
  color: var(--vermillion);
  background: var(--surface-warm);
}
.v-sec-item.active {
  border-color: var(--vermillion);
  color: var(--vermillion);
  background: color-mix(in srgb, var(--vermillion) 8%, var(--surface));
}

/* ─── 右側 TOC 條 ─── */
.v-toc-strip {
  position: fixed;
  top: 0;
  right: var(--nav-width, 56px);
  bottom: 0;
  width: 28px;
  background: var(--surface);
  border-left: 1px solid var(--border-light);
  z-index: 160;
  display: flex;
  flex-direction: row;
  align-items: center;
  writing-mode: vertical-rl;
  cursor: pointer;
  color: var(--ink-faint);
  transition: background 0.15s, color 0.15s;
}
.v-toc-strip:hover { background: var(--surface-warm); color: var(--ink-mid); }
.v-toc-strip.open { color: var(--vermillion); }
.v-toc-hamburger {
  width: 16px;
  height: 48px;
  flex-shrink: 0;
  margin-top: 8px;
  transition: color 0.2s ease;
}
.v-toc-breadcrumb {
  padding-top: 8px;
  font-family: var(--serif);
  font-size: 11px;
  letter-spacing: 3px;
  color: inherit;
  max-height: calc(100dvh - 72px);
  overflow: hidden;
}

/* ─── 目錄彈出面板（從右側展開） ─── */
.v-toc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(var(--shadow-rgb), 0.2);
  z-index: 155;
}
.v-toc-panel {
  position: absolute;
  top: 0;
  right: calc(var(--nav-width, 56px) + 28px);
  bottom: 0;
  background: var(--paper);
  border-right: 1px solid var(--border);
  box-shadow: -8px 0 32px rgba(var(--shadow-rgb), 0.12);
  display: flex;
  flex-direction: row-reverse;
  padding: 24px 16px;
  gap: 16px;
}
.v-toc-item {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  cursor: pointer;
  padding: 8px 4px;
  border-right: 1px solid var(--border-light);
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.v-toc-item:first-child { padding-left: 0; }
.v-toc-item:last-child { border-right: none; }
.v-toc-item:hover { color: var(--vermillion); }
.v-toc-item.active { border-right-color: var(--vermillion); color: var(--vermillion); }
.v-toc-l0 { }
.v-toc-l1 { padding-top: 24px; }
.v-toc-l2 { padding-top: 40px; }
.v-toc-label {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 3px;
  white-space: nowrap;
}
.v-toc-context {
  font-size: 11px;
  font-weight: 400;
  color: var(--ink-faint);
  letter-spacing: 1px;
  margin-bottom: 6px;
}
.toc-slide-enter-active { transition: opacity 0.2s ease; }
.toc-slide-enter-active .v-toc-panel { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toc-slide-leave-active { transition: opacity 0.15s ease; }
.toc-slide-leave-active .v-toc-panel { transition: transform 0.15s ease; }
.toc-slide-enter-from { opacity: 0; }
.toc-slide-enter-from .v-toc-panel { transform: translateX(20px); }
.toc-slide-leave-to { opacity: 0; }
.toc-slide-leave-to .v-toc-panel { transform: translateX(10px); }

/* ─── 注釋閃爍 ─── */
:deep(.ann-flash) {
  animation: ann-flash-anim 1.5s ease-out;
}

/* ═══════ 行動裝置適配 ═══════ */

@media (max-width: 768px) {
  /* ─── 直排模式 ─── */
  .v-page { --v-indent-0: 16px; --v-indent-1: 28px; --v-indent-2: 40px; --v-pad: 12px; margin-right: calc(var(--nav-width, 44px) + 28px + env(safe-area-inset-right, 0px)); }
  .v-poem-title { font-size: 28px; letter-spacing: 6px; padding-left: 12px; }
  .v-poem-author { font-size: 18px; letter-spacing: 4px; }
  .v-section-bar { transform: translateX(calc(-50% + var(--nav-width, 44px) / 2)); bottom: max(8px, env(safe-area-inset-bottom, 0px)); gap: 6px; }
  .v-sec-item { padding: 5px 10px; font-size: 12px; }
  .v-toc-strip { right: var(--nav-width, 44px); }
  .v-toc-panel { right: calc(var(--nav-width, 44px) + 28px); }
  .v-toc-label { font-size: 14px; letter-spacing: 2px; }
  .v-nav { gap: 20px; }
  .v-nav-btn { padding: 14px 10px; }
  .v-nav-title { font-size: 16px; letter-spacing: 2px; }

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
  .h-era { font-size: 10px; padding: 1px 6px; }
  .h-sep { margin: 0 4px; }
  .h-controls {
    margin-left: 0;
    gap: 4px;
    flex-wrap: wrap;
  }
  .h-section-nav {
    order: 10;
    width: 100%;
    justify-content: center;
  }
  .h-font-btns { display: none; }
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
  overscroll-behavior: contain;
    width: 100%;
    max-height: 85vh;
    height: auto;
    border-radius: 16px 16px 0 0;
    padding: 20px;
  }
  .overlay-enter-from .h-pane {
  overscroll-behavior: contain; transform: translateY(100%); }
  .overlay-leave-to .h-pane {
  overscroll-behavior: contain; transform: translateY(40px); }

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
