import { computed } from 'vue'
import { useReadingMode } from './useReadingMode'
import type { Theme } from './useReadingMode'

const LOGO_LIGHT = import.meta.env.CHAM_LOGO_URL || undefined
const LOGO_DARK = import.meta.env.CHAM_LOGO_DARK_URL || undefined

const DARK_THEMES: Theme[] = ['dark', 'oled']

export interface SiteConfig {
  logoUrl: ReturnType<typeof computed<string | undefined>>
}

export function useSiteConfig(): SiteConfig {
  const { theme } = useReadingMode()
  const logoUrl = computed(() => {
    if (DARK_THEMES.includes(theme.value) && LOGO_DARK) return LOGO_DARK
    return LOGO_LIGHT
  })
  return { logoUrl }
}
