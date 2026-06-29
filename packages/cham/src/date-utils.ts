import type { EraDate, EraDateGbt, EraRecord } from './types.js'
import {
  parseCode, generateCode, EraResolver, loadEraData,
  type ParsedCode,
} from '@hanology/era'

// Lazy singleton — the resolver builds four lookup maps from the bundled
// GB/T registry on first use. Subsequent calls are O(1) per lookup.
let _resolver: EraResolver | undefined
function resolver(): EraResolver {
  if (!_resolver) _resolver = new EraResolver(loadEraData())
  return _resolver
}

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/**
 * Strip trailing parenthetical annotations from a registry label.
 * The GB/T registry includes disambiguating annotations like `武王（姬發）`
 * or `玄宗（李隆基）`; for display we usually want just the canonical name.
 */
function displayLabel(label: string | undefined): string | undefined {
  if (label === undefined) return undefined
  return label.replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, '')
}

function isNumeric(s: string | undefined): boolean {
  return s !== undefined && s !== '' && /^\d+$/.test(s)
}

function ganzhiLabel(code: number): string {
  const idx = code - 1
  return TIANGAN[idx % 10] + DIZHI[idx % 12]
}

/**
 * Parse an `h-CN.*` date code into a typed {@link EraDate}.
 *
 * Accepts both formats:
 *
 * - **Name-based**: `h-CN.1.周.武王.1`, `h-CN.2.漢.建元.6`, `h-CN.4.甲子`.
 *   Trad Chinese names; year is a number.
 *
 * - **GB/T numeric**: `h-CN.1.04.011.001`, `h-CN.2.24.071.021.01`,
 *   `h-CN.4.01.50`. Numeric codes per GB/T XXXXX.
 *
 * Format is auto-detected by inspecting segment content and count.
 * For GB/T input, the parser resolves Trad Chinese names via the bundled
 * `@hanology/era` registry and populates both the name fields and
 * `gbt` (the structured code).
 *
 * Returns `null` for unparseable input.
 */
export function parseEraDate(code: string): EraDate | null {
  if (!code.startsWith('h-CN.')) return null
  const segments = code.slice(5).split('.')
  const type = parseInt(segments[0], 10) as 1 | 2 | 3 | 4
  if (![1, 2, 3, 4].includes(type)) return null
  const aux = segments.slice(1)

  switch (type) {
    case 1:
      return parseType1(aux, code)
    case 2:
      return parseType2(aux, code)
    case 3:
      return parseType3(aux)
    case 4:
      return parseType4(aux, code)
  }
}

function parseType1(aux: string[], code: string): EraDate | null {
  if (aux.length < 3) return null
  // GB/T numeric: DD.RRR.YYY — all three segments are digits.
  if (isNumeric(aux[0]) && isNumeric(aux[1]) && isNumeric(aux[2])) {
    const parsed = parseCode(code)
    if (!parsed || parsed.type !== 1) return null
    const r = resolver()
    const dynastyName = displayLabel(r.getDynasty(parsed.dynastyCode)?.label)
    const rulerName = displayLabel(r.getRuler(parsed.dynastyCode, parsed.rulerCode, parsed.reignCount)?.label)
    const gbt: EraDateGbt = {
      type: 1,
      dynastyCode: parsed.dynastyCode,
      rulerCode: parsed.rulerCode,
      reignCount: parsed.reignCount,
      yearOrdinal: parsed.yearOrdinal,
    }
    return {
      type: 1,
      dynasty: dynastyName ?? String(parsed.dynastyCode),
      ruler: rulerName,
      year: parsed.yearOrdinal,
      gbt,
    }
  }
  // Name-based: dynasty.ruler.year (year is numeric, dynasty/ruler are names).
  return {
    type: 1,
    dynasty: aux[0],
    ruler: aux[1],
    year: aux[2] ? parseInt(aux[2], 10) : undefined,
  }
}

function parseType2(aux: string[], code: string): EraDate | null {
  // GB/T numeric: DD.RRR.EER.YY — exactly 4 segments, all digits.
  if (
    aux.length === 4
    && isNumeric(aux[0]) && isNumeric(aux[1]) && isNumeric(aux[2]) && isNumeric(aux[3])
  ) {
    const parsed = parseCode(code)
    if (!parsed || parsed.type !== 2) return null
    const r = resolver()
    const dynastyName = displayLabel(r.getDynasty(parsed.dynastyCode)?.label)
    const rulerName = displayLabel(r.getRuler(parsed.dynastyCode, parsed.rulerCode, parsed.reignCount)?.label)
    const eraName = r.getErasForRuler(parsed.dynastyCode, parsed.rulerCode, parsed.reignCount)
      .find(e => e.eraCode === parsed.eraCode && e.eraInstance === parsed.eraInstance)?.label
    const eraDisplay = displayLabel(eraName)
    const gbt: EraDateGbt = {
      type: 2,
      dynastyCode: parsed.dynastyCode,
      rulerCode: parsed.rulerCode,
      reignCount: parsed.reignCount,
      eraCode: parsed.eraCode,
      eraInstance: parsed.eraInstance,
      eraYear: parsed.eraYear,
    }
    return {
      type: 2,
      dynasty: dynastyName ?? String(parsed.dynastyCode),
      ruler: rulerName,
      era: eraDisplay ?? `${parsed.eraCode}${parsed.eraInstance}`,
      year: parsed.eraYear,
      gbt,
    }
  }
  // Name-based: dynasty.era.year — 3 segments.
  if (aux.length < 3) return null
  return {
    type: 2,
    dynasty: aux[0],
    era: aux[1],
    year: aux[2] ? parseInt(aux[2], 10) : undefined,
  }
}

function parseType3(aux: string[]): EraDate | null {
  if (aux.length < 1 || !isNumeric(aux[0])) return null
  const rocYear = parseInt(aux[0], 10)
  return {
    type: 3,
    year: rocYear,
    gbt: { type: 3, rocYear },
  }
}

function parseType4(aux: string[], code: string): EraDate | null {
  // GB/T numeric: CC.OO — exactly 2 segments, both digits.
  if (aux.length === 2 && isNumeric(aux[0]) && isNumeric(aux[1])) {
    const parsed = parseCode(code)
    if (!parsed || parsed.type !== 4) return null
    const gbt: EraDateGbt = {
      type: 4,
      ganzhiCode: parsed.ganzhiCode,
      occurrenceOrdinal: parsed.occurrenceOrdinal,
    }
    return {
      type: 4,
      cycle: ganzhiLabel(parsed.ganzhiCode),
      gbt,
    }
  }
  // Name-based: single Chinese-character segment (e.g. 甲子).
  if (aux.length < 1) return null
  return { type: 4, cycle: aux[0] }
}

/**
 * Format an {@link EraDate} back into an `h-CN.*` string.
 *
 * Round-trips the parsed format: if the input was GB/T numeric, the output
 * is GB/T numeric (via `@hanology/era`'s `generateCode`); otherwise the
 * output is name-based Trad Chinese.
 *
 * For explicit format control, see {@link formatEraDateGbt} and
 * {@link formatEraDateName}.
 */
export function formatEraDate(date: EraDate): string {
  if (date.gbt) {
    return formatEraDateGbt(date)
  }
  return formatEraDateName(date)
}

/**
 * Format as a name-based Trad Chinese code. Uses the dynasty/ruler/era/cycle
 * name fields directly. Lossy if the date came from a GB/T code without
 * name resolution.
 */
export function formatEraDateName(date: EraDate): string {
  switch (date.type) {
    case 1: return `h-CN.1.${date.dynasty || ''}.${date.ruler || ''}.${date.year || ''}`
    case 2: return `h-CN.2.${date.dynasty || ''}.${date.era || ''}.${date.year || ''}`
    case 3: return `h-CN.3.${date.year || ''}`
    case 4: return `h-CN.4.${date.cycle || ''}`
  }
}

/**
 * Format as a GB/T numeric code. Requires `date.gbt` to be populated
 * (i.e. the date was parsed from a GB/T code or constructed with one).
 * Returns the name-based form as a fallback when `gbt` is absent.
 */
export function formatEraDateGbt(date: EraDate): string {
  if (!date.gbt) return formatEraDateName(date)
  const parsed = gbtToParsedCode(date.gbt)
  return generateCode(parsed)
}

function gbtToParsedCode(gbt: EraDateGbt): ParsedCode {
  switch (gbt.type) {
    case 1:
      return {
        calendarState: 'h', countryCode: 'CN', type: 1,
        dynastyCode: gbt.dynastyCode, rulerCode: gbt.rulerCode,
        reignCount: gbt.reignCount, yearOrdinal: gbt.yearOrdinal,
      }
    case 2:
      return {
        calendarState: 'h', countryCode: 'CN', type: 2,
        dynastyCode: gbt.dynastyCode, rulerCode: gbt.rulerCode,
        reignCount: gbt.reignCount, eraCode: gbt.eraCode,
        eraInstance: gbt.eraInstance, eraYear: gbt.eraYear,
      }
    case 3:
      return {
        calendarState: 'h', countryCode: 'CN', type: 3,
        rocYear: gbt.rocYear,
      }
    case 4:
      return {
        calendarState: 'h', countryCode: 'CN', type: 4,
        ganzhiCode: gbt.ganzhiCode, occurrenceOrdinal: gbt.occurrenceOrdinal,
      }
  }
}

/**
 * Resolve an era name + ordinal year to a Gregorian year, using the
 * project's local era registry (loaded from `eras.yaml`).
 *
 * Distinct from `@hanology/era`'s `EraResolver`, which resolves GB/T
 * numeric codes via the bundled GB/T registry. The local registry may
 * include era names not yet in GB/T; the canonical registry is
 * authoritative for code resolution.
 */
export function resolveEraToDate(era: string, eraYear: number, eras: EraRecord[]): number | undefined {
  const record = eras.find(e => e.era === era)
  if (!record?.start) return undefined
  return record.start + eraYear - 1
}

/** Normalize Han-character variants of common dynasty names to Trad Chinese. */
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

// Re-export `@hanology/era` for cham-js consumers that want strict GB/T
// code handling. Same API as the underlying package.
export {
  parseCode, isValidCode, generateCode,
  kinglyCode, imperialCode, rocCode, ganzhiCode,
  EraResolver, loadEraData,
} from '@hanology/era'
export type {
  CalendarState, EraType, EraData,
  DynastyEntry, RulerEntry, EraNameEntry, GanzhiEntry,
  ParsedCode, ResolvedCode,
  KinglyParsedCode, ImperialParsedCode, ROCParsedCode, GanzhiParsedCode,
} from '@hanology/era'
