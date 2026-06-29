// ─── Core Domain Types ─────────────────────────────────────────
// CHAM's fundamental domain model: enums, hierarchy, contributors,
// dates, text blocks, markers, annotations, and documents. Every
// other type subfile builds on these.

// ─── Enums ─────────────────────────────────────────────────────

export type Genre = 'poetry' | 'prose' | 'mixed' | 'drama'
export type Role = 'author' | 'editor' | 'annotator' | 'translator' | 'commentator'

export type HierarchyLevelName =
  | '部' | '卷' | '篇' | '章' | '節' | '段' | '句'
  | (string & {})

export interface HierarchyLevel {
  level: HierarchyLevelName
  index: number
  label?: string
  parent?: number | string
}

export type ClassicalNature =
  | 'zhuan' | 'gu' | 'zhu' | 'zhangju' | 'jian'
  | 'jijie' | 'jizhu' | 'shu' | 'zhengyi'
  | 'yinyi' | 'kaozheng' | 'pingdian'

export type GeneralNature =
  | 'commentary' | 'translation' | 'annotation' | 'exegesis' | 'notes'

export type AnnotationNature = ClassicalNature | GeneralNature

export const VALID_NATURES: ReadonlySet<string> = new Set<string>([
  'zhuan', 'gu', 'zhu', 'zhangju', 'jian', 'jijie', 'jizhu',
  'shu', 'zhengyi', 'yinyi', 'kaozheng', 'pingdian',
  'commentary', 'translation', 'annotation', 'exegesis', 'notes',
])

export type SpeakerRole =
  | 'emperor' | 'official' | 'scholar' | 'narrator' | 'character'
  | (string & {})

export type TextBlockRole =
  | 'body' | 'attribution' | 'heading' | 'speaker'
  | (string & {})

// ─── Date Encoding ─────────────────────────────────────────────

/**
 * CHAM date — supports two formats:
 *
 * 1. **Name-based** (CHAM's traditional form): `h-CN.1.周.武王.1`.
 *    Human-readable; dynasty, ruler, era, and cycle are Trad Chinese names.
 *
 * 2. **GB/T numeric** (the GB/T XXXXX standard): `h-CN.1.04.011.001`.
 *    Machine-readable; all segments are numeric codes.
 *
 * `parseEraDate` auto-detects the format. When the input is GB/T numeric,
 * the parser resolves Trad Chinese names via `@hanology/era` and populates
 * both the name fields and `gbt` (the structured GB/T code). When the input
 * is name-based, only the name fields are populated.
 *
 * `formatEraDate` round-trips: it emits the same format that was parsed.
 * GB/T codes are preserved exactly; name-based codes are emitted as-is.
 */
export interface EraDate {
  type: 1 | 2 | 3 | 4
  /** Dynasty name (Trad Chinese) — e.g. 周, 漢, 唐. */
  dynasty?: string
  /** Ruler name (Trad Chinese) — e.g. 武王, 玄宗. Populated for type 1 GB/T input. */
  ruler?: string
  /** Era name (Trad Chinese) — e.g. 開元, 建元. */
  era?: string
  /** Year — ordinal within reign (type 1), within era (type 2), or ROC year (type 3). */
  year?: number
  /** Ganzhi label (Trad Chinese, e.g. 甲子) or numeric CC.OO form. */
  cycle?: string
  /**
   * Structured GB/T code, populated when the input was GB/T numeric.
   * Use `formatEraDate` to round-trip; access directly when you need
   * the numeric codes.
   */
  gbt?: EraDateGbt
}

/**
 * Structured GB/T code fields. One variant per era type. Import `ParsedCode`
 * from `@hanology/era` for the canonical form; this interface is the
 * subset stored on `EraDate`.
 */
export type EraDateGbt =
  | { type: 1; dynastyCode: number; rulerCode: number; reignCount: number; yearOrdinal: number }
  | { type: 2; dynastyCode: number; rulerCode: number; reignCount: number; eraCode: number; eraInstance: number; eraYear: number }
  | { type: 3; rocYear: number }
  | { type: 4; ganzhiCode: number; occurrenceOrdinal: number }

// ─── Contributors & Dates ──────────────────────────────────────

export interface ChamContributor {
  ref: string
  role: Role
  title?: string
}

export interface ChamDate {
  dynasty?: string
  era?: string
  eraCode?: string
  era_year?: number
  sexagenary?: string
  iso?: number
  circa?: boolean
  iso_range?: [number, number]
}

// ─── Frontmatter (Discriminated Union) ─────────────────────────

export interface PrimaryMeta {
  type: 'primary'
  id: number | string
  title: string
  contributors?: ChamContributor[]
  date?: ChamDate
  genre?: Genre
  source?: PieceSource
  hierarchy?: HierarchyLevel[]
}

export interface SecondaryMeta {
  type: 'secondary'
  base: string
  contributor?: string
  role?: string
  dynasty?: string
  era?: string
  eraCode?: string
  era_year?: number
  iso?: number
  nature?: string
}

export interface PartMeta {
  type: 'part'
  part: number
  group?: string
  title?: string
  source?: PieceSource
}

export type ChamMeta = PrimaryMeta | SecondaryMeta | PartMeta

export function isSecondaryMeta(meta: ChamMeta): meta is SecondaryMeta {
  return meta.type === 'secondary'
}

export function isPartMeta(meta: ChamMeta): meta is PartMeta {
  return meta.type === 'part'
}

// ─── Piece Source ──────────────────────────────────────────────

export interface PieceSource {
  text?: string
  textRef?: string
  pieceRef?: number
  edition?: string
  publisher?: string
  page?: string
  relation: 'section' | 'excerpt' | 'complete' | 'standalone'
  range?: { start?: string; end?: string; chapter?: string; juan?: number; section?: string; [key: string]: string | number | undefined }
}

// ─── Text Sections ─────────────────────────────────────────────

export interface TextSection {
  level: string
  label?: string
  index: number
  startBlock: number
  endBlock: number
}

// ─── Text Model ────────────────────────────────────────────────

export interface TextBlock {
  sectionIndex: number
  blockIndexInSection: number
  text: string
  display: string
  source: string
  lineStart?: number
  lineEnd?: number
  role?: TextBlockRole
  textSectionIndex?: number
}

// ─── Marker Model ──────────────────────────────────────────────

export interface Marker {
  id: number
  sectionIndex: number
  blockIndex: number
  offset: number
  length: number
  text?: string
}

export type MarkerTable = Map<number, Marker>

// ─── Annotation Model ──────────────────────────────────────────

export interface SectionMeta {
  contributor?: string
  role?: string
  dynasty?: string
  era?: string
  eraCode?: string
  era_year?: number
  iso?: number
  nature?: string
}

export interface AnnotationSection {
  name: string
  meta: SectionMeta
  entries: AnnotationEntry[]
}

export type AnnotationKind =
  | 'fanqie' | 'zhiyin' | 'tone'       // classical phonetics
  | 'pinyin' | 'bpmf' | 'jyutping'     // modern phonetics
  | 'meaning' | 'commentary'            // semantic
  | 'person' | 'place' | 'event' | 'date' | 'allusion'
  | 'collation' | 'variant' | 'see-also' | 'translation'
  | 'speaker' | 'skqs-variant'
  | (string & {})

export type AnnotationTarget =
  // --- Inline marker reference ---
  // {N} in annotation; resolved via the primary document's marker table.
  | { type: 'marker'; markerId: number }

  // --- Direct position reference ---
  // @verse:N:C-E — explicit verse index and character range.
  | { type: 'verse'; line: number; char: number; end?: number }

  // --- Entire-verse reference ---
  // @v:N — the whole Nth text block.
  | { type: 'verse-all'; line: number }

  // --- External text-quote reference ---
  // @[quote] — search all verses for an exact match of `quote`.
  // @N[quote] — search only within verse N (disambiguation for repeated phrases).
  | { type: 'text'; quote: string; verseHint?: number }

  // --- Special targets ---
  | { type: 'title' }
  | { type: 'full' }

export interface AnnotationEntry {
  target: AnnotationTarget
  kind: AnnotationKind
  params: Record<string, string>
  headword?: string
  value: string
}

// ─── SKQS Variant Character ────────────────────────────────────

export interface SkqsVariant {
  imageFile?: string
  altText: string
  context?: string
  unicode?: string
  component?: string
}

// ─── Document Model ────────────────────────────────────────────

export interface ChamPart {
  meta: PartMeta
  textBlocks: TextBlock[]
  markers: MarkerTable
  sections: AnnotationSection[]
}

export interface ChamDocument {
  meta: ChamMeta
  textBlocks: TextBlock[]
  markers: MarkerTable
  textSections?: TextSection[]
  sections: AnnotationSection[]
  skqsVariants?: SkqsVariant[]
  parts?: ChamPart[]
}

export interface ChamProject {
  primary: ChamDocument
  secondary: ChamDocument[]
  prose: Map<string, string>
}
