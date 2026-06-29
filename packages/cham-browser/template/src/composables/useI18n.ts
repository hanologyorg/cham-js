import { ref, watch } from 'vue'
import { parse as parseYaml } from 'yaml'
import zhHantYaml from './locales/zh-Hant.yaml?raw'
import zhHansYaml from './locales/zh-Hans.yaml?raw'
import enYaml from './locales/en.yaml?raw'

export type Locale = 'zh-Hant' | 'zh-Hans' | 'en'

export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-Hant': '繁',
  'zh-Hans': '简',
  'en': 'EN',
}

/**
 * UI strings live in YAML files under `./locales/`. Translators edit
 * those files directly; the composable loads them at build time via
 * vite's `?raw` import. zh-Hant is the fallback.
 */
const messages: Record<Locale, Record<string, string>> = {
  'zh-Hant': parseYaml(zhHantYaml) as Record<string, string>,
  'zh-Hans': parseYaml(zhHansYaml) as Record<string, string>,
  'en': parseYaml(enYaml) as Record<string, string>,
}

const AVAILABLE_LOCALES: Locale[] = ['zh-Hant', 'zh-Hans', 'en']

const locale = ref<Locale>('zh-Hant')

if (!import.meta.env.SSR) {
  const saved = localStorage.getItem('cham-locale') as Locale | null
  if (saved && AVAILABLE_LOCALES.includes(saved)) locale.value = saved

  watch(locale, l => {
    localStorage.setItem('cham-locale', l)
    document.documentElement.setAttribute('lang', l === 'zh-Hans' ? 'zh-Hans' : l === 'en' ? 'en' : 'zh-Hant')
  }, { immediate: true })
}

export function useI18n() {
  function t(key: string, params?: Record<string, string | number>): string {
    let msg = messages[locale.value]?.[key] || messages['zh-Hant']?.[key] || key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        msg = msg.replace(`{${k}}`, String(v))
      }
    }
    return msg
  }

  function setLocale(l: Locale) { locale.value = l }

  return { locale, t, setLocale, availableLocales: AVAILABLE_LOCALES, localeLabels: LOCALE_LABELS }
}
