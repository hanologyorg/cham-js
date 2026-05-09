import { ref, watch } from 'vue'

export type Theme = 'light' | 'sepia' | 'dark' | 'oled'
export type LayoutMode = 'horizontal' | 'vertical'

export const THEMES: Theme[] = ['light', 'sepia', 'dark', 'oled']

export const THEME_LABELS: Record<Theme, string> = {
  light: '亮',
  sepia: '暖',
  dark: '暗',
  oled: '黑',
}

export const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32] as const
export type FontSize = typeof FONT_SIZES[number]

const theme = ref<Theme>('light')
const layout = ref<LayoutMode>('vertical')
const mainFontSize = ref<FontSize>(24)
const bodyFontSize = ref<FontSize>(16)

if (!import.meta.env.SSR) {
  const savedTheme = localStorage.getItem('theme') as Theme | null
  if (savedTheme && THEMES.includes(savedTheme)) theme.value = savedTheme

  const savedLayout = localStorage.getItem('layout') as LayoutMode | null
  if (savedLayout === 'vertical' || savedLayout === 'horizontal') layout.value = savedLayout

  const savedMain = parseInt(localStorage.getItem('mainFontSize') || '', 10)
  if (FONT_SIZES.includes(savedMain as any)) mainFontSize.value = savedMain as FontSize

  const savedBody = parseInt(localStorage.getItem('bodyFontSize') || '', 10)
  if (FONT_SIZES.includes(savedBody as any)) bodyFontSize.value = savedBody as FontSize

  watch(theme, t => {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('theme', t)
  }, { immediate: true })

  watch(layout, l => {
    document.documentElement.setAttribute('data-layout', l)
    localStorage.setItem('layout', l)
  }, { immediate: true })

  watch(mainFontSize, s => {
    document.documentElement.style.setProperty('--main-font-size', s + 'px')
    localStorage.setItem('mainFontSize', String(s))
  }, { immediate: true })

  watch(bodyFontSize, s => {
    document.documentElement.style.setProperty('--body-font-size', s + 'px')
    localStorage.setItem('bodyFontSize', String(s))
  }, { immediate: true })
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
  return { theme, layout, mainFontSize, bodyFontSize, setTheme, cycleTheme, setLayout, toggleLayout, setMainFontSize, setBodyFontSize }
}
