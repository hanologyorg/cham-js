import type { HcnDate, EraRecord } from './types.js'

export function parseHcnDate(code: string): HcnDate | null {
  if (!code.startsWith('h-CN.')) return null
  const parts = code.slice(5).split('.')
  const type = parseInt(parts[0], 10) as 1 | 2 | 3 | 4
  if (![1, 2, 3, 4].includes(type)) return null

  switch (type) {
    case 1: // h-CN.1.{dynasty}.{ruler}.{year}
      return { type, dynasty: parts[1], ruler: parts[2], year: parts[3] ? parseInt(parts[3], 10) : undefined }
    case 2: // h-CN.2.{dynasty}.{era}.{year}
      return { type, dynasty: parts[1], era: parts[2], year: parts[3] ? parseInt(parts[3], 10) : undefined }
    case 3: // h-CN.3.{year}
      return { type, year: parts[1] ? parseInt(parts[1], 10) : undefined }
    case 4: // h-CN.4.{cycle}
      return { type, cycle: parts[1] }
  }
}

export function formatHcnDate(date: HcnDate): string {
  switch (date.type) {
    case 1: return `h-CN.1.${date.dynasty || ''}.${date.ruler || ''}.${date.year || ''}`
    case 2: return `h-CN.2.${date.dynasty || ''}.${date.era || ''}.${date.year || ''}`
    case 3: return `h-CN.3.${date.year || ''}`
    case 4: return `h-CN.4.${date.cycle || ''}`
  }
}

export function resolveEraToDate(era: string, eraYear: number, eras: EraRecord[]): number | undefined {
  const record = eras.find(e => e.era === era)
  if (!record?.start) return undefined
  return record.start + eraYear - 1
}

export function normalizeDynasty(dynasty: string): string {
  return dynasty
    .replace('西汉', '西漢').replace('东汉', '东漢').replace('西漢', '西漢')
    .replace('東汉', '東漢').replace('東漢', '東漢')
    .replace('北宋', '北宋').replace('南宋', '南宋')
    .replace('中华民国', '中華民國').replace('中華民国', '中華民國')
    .replace('西晋', '西晉').replace('东晋', '東晉')
    .replace('西魏', '西魏').replace('东魏', '東魏')
    .replace('北魏', '北魏').replace('北齐', '北齊').replace('北周', '北周')
    .replace('南朝 宋', '南朝宋').replace('南朝宋', '南朝宋')
}
