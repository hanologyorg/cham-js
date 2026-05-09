import { ref, computed, watch } from 'vue'

export type Locale = 'zh-Hant' | 'zh-Hans' | 'en'

export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-Hant': '繁',
  'zh-Hans': '简',
  'en': 'EN',
}

const messages: Record<Locale, Record<string, string>> = {
  'zh-Hant': {
    'site.title': '古典詩文圖書館',
    'site.subtitle': 'Classical Chinese Text Library',
    'nav.back': '返回',
    'nav.home': '首頁',
    'settings.layout': '版面',
    'settings.vertical': '直排',
    'settings.horizontal': '橫排',
    'settings.theme': '主題',
    'settings.language': '語言',
    'settings.mainFontSize': '正文字號',
    'settings.bodyFontSize': '內文字號',
    'settings.reading': '閱讀設定',
    'settings.close': '關閉設定',
    'piece.stanzas': '段',
    'piece.notes': '注',
    'piece.noNotes': '無注',
    'piece.previous': '上一篇',
    'piece.next': '下一篇',
    'piece.enterLibrary': '進 入 文 庫',
    'piece.loading': '載入中…',
    'catalog.title': '篇 章 目 錄',
    'catalog.total': '共 {count} 篇',
    'catalog.search': '搜索詩題、作者…',
    'author.biography': '作者簡介',
    'author.collectedWorks': '收錄作品',
    'author.worksCount': '{count} 篇收錄作品',
    'author.unknownDynasty': '未知朝代',
    'annotation.pronunciation': '音',
    'annotation.semantic': '義',
    'annotation.notes': '注釋',
    'genre.poetry': '詩歌',
    'genre.prose': '散文',
    'genre.mixed': '綜合',
    'genre.drama': '戲曲',
    'genre.classicalText': '古典文本',
    'genre.fourTreasuries': '四庫全書',
    'genre.textbooks': '教材',
    'stat.books': '部',
    'stat.pieces': '篇',
    'stat.pieceCount': '{count} 篇',
    'stat.authorCount': '{count} 位作者',
    'stat.piecePoems': '篇詩文',
  },
  'zh-Hans': {
    'site.title': '古典诗文图书馆',
    'site.subtitle': 'Classical Chinese Text Library',
    'nav.back': '返回',
    'nav.home': '首页',
    'settings.layout': '版面',
    'settings.vertical': '直排',
    'settings.horizontal': '横排',
    'settings.theme': '主题',
    'settings.language': '语言',
    'settings.mainFontSize': '正文字号',
    'settings.bodyFontSize': '内文字号',
    'settings.reading': '阅读设定',
    'settings.close': '关闭设定',
    'piece.stanzas': '段',
    'piece.notes': '注',
    'piece.noNotes': '无注',
    'piece.previous': '上一篇',
    'piece.next': '下一篇',
    'piece.enterLibrary': '进 入 文 库',
    'piece.loading': '载入中…',
    'catalog.title': '篇 章 目 录',
    'catalog.total': '共 {count} 篇',
    'catalog.search': '搜索诗题、作者…',
    'author.biography': '作者简介',
    'author.collectedWorks': '收录作品',
    'author.worksCount': '{count} 篇收录作品',
    'author.unknownDynasty': '未知朝代',
    'annotation.pronunciation': '音',
    'annotation.semantic': '义',
    'annotation.notes': '注释',
    'genre.poetry': '诗歌',
    'genre.prose': '散文',
    'genre.mixed': '综合',
    'genre.drama': '戏曲',
    'genre.classicalText': '古典文本',
    'genre.fourTreasuries': '四库全书',
    'genre.textbooks': '教材',
    'stat.books': '部',
    'stat.pieces': '篇',
    'stat.pieceCount': '{count} 篇',
    'stat.authorCount': '{count} 位作者',
    'stat.piecePoems': '篇诗文',
  },
  'en': {
    'site.title': 'Classical Chinese Text Library',
    'site.subtitle': 'Classical Chinese Text Library',
    'nav.back': 'Back',
    'nav.home': 'Home',
    'settings.layout': 'Layout',
    'settings.vertical': 'Vertical',
    'settings.horizontal': 'Horizontal',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.mainFontSize': 'Main Size',
    'settings.bodyFontSize': 'Body Size',
    'settings.reading': 'Reading Settings',
    'settings.close': 'Close Settings',
    'piece.stanzas': 'stanzas',
    'piece.notes': 'notes',
    'piece.noNotes': 'No notes',
    'piece.previous': 'Previous',
    'piece.next': 'Next',
    'piece.enterLibrary': 'Enter Library',
    'piece.loading': 'Loading…',
    'catalog.title': 'Catalogue',
    'catalog.total': '{count} works',
    'catalog.search': 'Search titles, authors…',
    'author.biography': 'Biography',
    'author.collectedWorks': 'Collected Works',
    'author.worksCount': '{count} collected works',
    'author.unknownDynasty': 'Unknown dynasty',
    'annotation.pronunciation': 'Pron',
    'annotation.semantic': 'Def',
    'annotation.notes': 'Notes',
    'genre.poetry': 'Poetry',
    'genre.prose': 'Prose',
    'genre.mixed': 'Mixed',
    'genre.drama': 'Drama',
    'genre.classicalText': 'Classical Texts',
    'genre.fourTreasuries': 'Four Treasuries',
    'genre.textbooks': 'Textbooks',
    'stat.books': 'books',
    'stat.pieces': 'works',
    'stat.pieceCount': '{count} works',
    'stat.authorCount': '{count} authors',
    'stat.piecePoems': 'works',
  },
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
