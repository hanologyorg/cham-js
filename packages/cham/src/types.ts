// ─── Genre & Roles ─────────────────────────────────────────────

export type Genre = 'poetry' | 'prose' | 'mixed' | 'drama'
export type Role = 'author' | 'editor' | 'annotator' | 'translator' | 'commentator'

// ─── Hierarchy ────────────────────────────────────────────────

export type HierarchyLevelName =
  | '部' | '卷' | '篇' | '章' | '節' | '段' | '句'
  | (string & {})

export interface HierarchyLevel {
  level: HierarchyLevelName
  index: number
  label?: string
  parent?: number | string
}

// ─── Commentary Nature ────────────────────────────────────────

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

// ─── Speaker ──────────────────────────────────────────────────

export type SpeakerRole =
  | 'emperor' | 'official' | 'scholar' | 'narrator' | 'character'
  | (string & {})

// ─── Text Block Role ──────────────────────────────────────────

export type TextBlockRole =
  | 'body' | 'attribution' | 'heading' | 'speaker'
  | (string & {})

// ─── Date Encoding ────────────────────────────────────────────

export interface HcnDate {
  type: 1 | 2 | 3 | 4
  dynasty?: string
  ruler?: string
  era?: string
  year?: number
  cycle?: string
}

// ─── Contributors & Dates ─────────────────────────────────────

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

// ─── Frontmatter (Discriminated Union) ────────────────────────

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

// ─── Piece Source ─────────────────────────────────────────────

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

// ─── Text Sections (within-piece hierarchy) ────────────────────

export interface TextSection {
  level: string
  label?: string
  index: number
  startBlock: number
  endBlock: number
}

// ─── Text Model ──────────────────────────────────────────────

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

// ─── Marker Model ────────────────────────────────────────────

export interface Marker {
  id: number
  sectionIndex: number
  blockIndex: number
  offset: number
  length: number
  text?: string
}

export type MarkerTable = Map<number, Marker>

// ─── Annotation Model ────────────────────────────────────────

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
  | { type: 'marker'; markerId: number }
  | { type: 'title' }
  | { type: 'full' }
  | { type: 'verse'; line: number; char: number; end?: number }

export interface AnnotationEntry {
  target: AnnotationTarget
  kind: AnnotationKind
  params: Record<string, string>
  headword?: string
  value: string
}

// ─── SKQS Variant Character ──────────────────────────────────

export interface SkqsVariant {
  imageFile?: string
  altText: string
  context?: string
  unicode?: string
  component?: string
}

// ─── Document Model ──────────────────────────────────────────

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

// ─── Book Config (book.yaml) ─────────────────────────────────

export type LibraryScale = 'single-piece' | 'single-book' | 'library'
export type BookGenre = 'poetry' | 'prose' | 'mixed' | 'drama'

export interface BookLayer {
  id: string
  label: string
  shortLabel?: string
  contributor: string
  role?: string
  nature?: string
  displayOrder?: number
  enabled?: boolean
}

export interface BookAnnotationDefaults {
  defaultLabel?: string
  defaultShortLabel?: string
}

export interface VolumeConfig {
  label: string
  pieces: string[]
}

export interface BookConfig {
  id: string
  title: string
  subtitle?: string
  titleEn?: string
  publisher?: string
  genre?: BookGenre
  contributors?: ChamContributor[]
  date?: ChamDate
  hero?: string[]
  layers?: BookLayer[]
  annotation?: BookAnnotationDefaults
  volumes?: VolumeConfig[]
  hierarchy?: HierarchyLevelName[]
}

export interface BookMeta {
  id: string
  title: string
  subtitle?: string
  titleEn?: string
  publisher?: string
  genre: BookGenre
  count: number
  hero?: string[]
  layers?: BookLayer[]
  annotation?: BookAnnotationDefaults
  volumes?: VolumeConfig[]
}

export interface CrossRef {
  focusedBookId: string
  focusedNum: number
  fullBookId: string
  fullNum?: number
  relation: 'section' | 'excerpt' | 'complete'
}

export interface LibraryIndex {
  scale: LibraryScale
  books: BookMeta[]
  crossRefs?: CrossRef[]
}

// ─── Output Types (pipeline → frontend) ───────────────────────

export interface OutputPart {
  num: number
  group?: string
  title?: string
  source?: PieceSource
  verses: { text: string }[]
  annotations: OutputAnnotation[]
  annotationText?: string
}

export interface OutputRange {
  type: 'range'
  scope: 'title' | 'verse'
  verseIndex?: number
  start: number
  end: number
}

export interface OutputAnnotation {
  id: string
  range: OutputRange
  kind: AnnotationKind
  lang?: string
  text: string
  source: string
}

export interface OutputAnnotationLayer {
  id: string
  label: string
  shortLabel: string
  contributor: string
  role: string
  nature: string
  displayOrder: number
  enabled: boolean
  annotations: OutputAnnotation[]
}

export interface OutputProseSection {
  key: string
  title: string
  filename: string
  body: string
  order: number
}

export interface OutputPiece {
  bookId: string
  num: number
  title: string
  author: string
  authorId: string
  dynasty: string
  era: string
  eraCode?: string
  genre: BookGenre
  verses: { text: string }[]
  sections: Record<string, string>
  structuredSections?: OutputProseSection[]
  annotations: OutputAnnotation[]
  layers?: Record<string, OutputAnnotation[]>
  annotationLayers?: OutputAnnotationLayer[]
  source?: PieceSource
  contributors?: PieceContributor[]
  parts?: OutputPart[]
}

export interface PieceContributor {
  id: string
  name: string
  role: string
  title?: string
}

export interface BookData {
  meta: BookMeta
  pieces: OutputPiece[]
}

// ─── Registry Types ────────────────────────────────────────────

export interface AuthorRecord {
  name: string
  dynasty?: string
  era?: string
  eraCode?: string
  bio?: string
  born?: string
  died?: string
  courtesyName?: string
  artName?: string
  wikidata?: string
  ctextId?: string
  wikipediaZh?: string
  wikipediaEn?: string
}

export interface DynastyRecord {
  id: string
  label: string
  start?: number
  end?: number
  gbCode?: string
}

export interface EraRecord {
  dynasty: string
  era: string
  eraCode?: string
  label: string
  start?: number
  end?: number
}

export interface SexagenaryRecord {
  stem: string
  branch: string
  label: string
}

export interface PlaceRecord {
  id: string
  label: string
  modern?: string
  lat?: number
  lon?: number
}

export interface EventRecord {
  id: string
  label: string
  dynasty?: string
  era?: string
  eraCode?: string
  year?: number
}

export interface LexiconEntry {
  char: string
  readings: Array<{ lang: string; value: string }>
}

export interface WorkRecord {
  id: string
  label: string
  altLabels?: string[]
  creator?: string
  indexedIn?: Array<{
    collection: string
    juan?: number
  }>
  genre?: string
  hierarchy?: HierarchyLevelName[]
  wikidata?: string
  ctextId?: string
  wikipediaZh?: string
}

export interface ChamRegistries {
  authors: Record<string, AuthorRecord>
  dynasties: DynastyRecord[]
  eras: EraRecord[]
  sexagenary: SexagenaryRecord[]
  places: Record<string, PlaceRecord>
  events: Record<string, EventRecord>
  lexicon: LexiconEntry[]
  works: Record<string, WorkRecord>
}

// ─── Validator Types ──────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  file?: string
  line?: number
  message: string
  detail?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

// ─── ePub Converter Types ─────────────────────────────────────

export interface EpubConversionOptions {
  epubPath: string
  outputDir: string
  bookConfig: Partial<BookConfig>
  contributor?: string
  layerContributor?: string
  layerId?: string
}

export interface EpubAnnotation {
  text: string
  kind: AnnotationKind
  headword?: string
  isCollation: boolean
  isFanqie: boolean
  skqsVariant?: SkqsVariant
}

export interface EpubSection {
  title: string
  num: number
  textParts: string[]
  annotations: EpubAnnotation[]
}

export interface EpubVolume {
  label: string
  sections: EpubSection[]
}
