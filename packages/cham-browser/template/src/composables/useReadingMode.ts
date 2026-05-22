import { ref, watch, nextTick } from 'vue'

export type Theme = 'light' | 'sepia' | 'dark' | 'oled'
export type LayoutMode = 'horizontal' | 'vertical'

export const THEMES: Theme[] = ['light', 'sepia', 'dark', 'oled']

export const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32] as const
export type FontSize = typeof FONT_SIZES[number]

const theme = ref<Theme>('light')
const layout = ref<LayoutMode>('vertical')
const mainFontSize = ref<FontSize>(24)
const bodyFontSize = ref<FontSize>(16)
const annotationsVisible = ref(true)
const annotationPane = ref(false)

if (!import.meta.env.SSR) {
  // Theme and font sizes only affect CSS, safe to apply before hydration
  const savedTheme = localStorage.getItem('theme') as Theme | null
  if (savedTheme && THEMES.includes(savedTheme)) theme.value = savedTheme

  const savedMain = parseInt(localStorage.getItem('mainFontSize') || '', 10)
  if (FONT_SIZES.includes(savedMain as any)) mainFontSize.value = savedMain as FontSize

  const savedBody = parseInt(localStorage.getItem('bodyFontSize') || '', 10)
  if (FONT_SIZES.includes(savedBody as any)) bodyFontSize.value = savedBody as FontSize

  const savedAnnVis = localStorage.getItem('annotationsVisible')
  if (savedAnnVis === 'false') annotationsVisible.value = false

  const savedAnnPane = localStorage.getItem('annotationPane')
  if (savedAnnPane === 'true') annotationPane.value = true

  // Layout controls v-if/v-else DOM structure — must defer to after hydration
  // to avoid SSR/client mismatch (SSR always renders vertical)
  nextTick(() => {
    const savedLayout = localStorage.getItem('layout') as LayoutMode | null
    if (savedLayout === 'vertical' || savedLayout === 'horizontal') layout.value = savedLayout
  })

  watch(theme, t => {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('theme', t)
  }, { immediate: true })

  // Layout watch must NOT be immediate — it would overwrite localStorage
  // with the default 'vertical' before nextTick restores the saved value
  watch(layout, l => {
    document.documentElement.setAttribute('data-layout', l)
    localStorage.setItem('layout', l)
  })

  watch(mainFontSize, s => {
    document.documentElement.style.setProperty('--main-font-size', s + 'px')
    localStorage.setItem('mainFontSize', String(s))
  }, { immediate: true })

  watch(bodyFontSize, s => {
    document.documentElement.style.setProperty('--body-font-size', s + 'px')
    localStorage.setItem('bodyFontSize', String(s))
  }, { immediate: true })

  watch(annotationsVisible, v => {
    localStorage.setItem('annotationsVisible', String(v))
  })

  watch(annotationPane, v => {
    localStorage.setItem('annotationPane', String(v))
  })
}

export function useReadingMode() {
  function setTheme(t: Theme) { theme.value = t }
  function cycleTheme() {
    const idx = THEMES.indexOf(theme.value)
    theme.value = THEMES[(idx + 1) % THEMES.length]
  }
  function setLayout(l: LayoutMode) { layout.value = l }
  function toggleLayout() {
    layout.value = layout.value === 'horizontal' ? 'vertical' : 'horizontal'
  }
  function setMainFontSize(s: FontSize) { mainFontSize.value = s }
  function setBodyFontSize(s: FontSize) { bodyFontSize.value = s }
  function setAnnotationsVisible(v: boolean) { annotationsVisible.value = v }
  function toggleAnnotationsVisible() { annotationsVisible.value = !annotationsVisible.value }
  function setAnnotationPane(v: boolean) { annotationPane.value = v }
  function toggleAnnotationPane() { annotationPane.value = !annotationPane.value }
  return { theme, layout, mainFontSize, bodyFontSize, annotationsVisible, annotationPane, setTheme, cycleTheme, setLayout, toggleLayout, setMainFontSize, setBodyFontSize, setAnnotationsVisible, toggleAnnotationsVisible, setAnnotationPane, toggleAnnotationPane }
}
