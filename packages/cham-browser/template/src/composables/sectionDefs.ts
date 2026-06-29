// ─── Section Definitions Registry ─────────────────────────────
// Data-driven section type definitions. Adding a new prose section
// type = adding an entry here, not editing PieceView.
//
// Open/closed: PieceView consumes this registry; new section types
// are registered here without modifying the view.

export interface SectionDef {
  /** Section key used in piece.sections and piece.structuredSections. */
  readonly key: string
  /** i18n key prefix (e.g. "section.background"). */
  readonly i18nKey: string
  /** Whether this section requires special rendering (interactive, not prose). */
  readonly special: boolean
  /** Display order for nav items. Lower = earlier. */
  readonly order: number
}

/**
 * Built-in prose section types. Books with custom section types
 * (via `custom-*.md` files) are handled dynamically — their metadata
 * comes from the structuredSections data, not from this registry.
 */
export const SECTION_REGISTRY: readonly SectionDef[] = [
  { key: 'author_bio', i18nKey: 'section.author_bio', special: false, order: 1 },
  { key: 'background', i18nKey: 'section.background', special: false, order: 2 },
  { key: 'analysis', i18nKey: 'section.analysis', special: false, order: 3 },
  { key: 'follow_up', i18nKey: 'section.follow_up', special: true, order: 4 },
  { key: 'think_questions', i18nKey: 'section.think_questions', special: true, order: 5 },
  { key: 'preparation', i18nKey: 'section.preparation', special: true, order: 6 },
]

const SECTION_MAP = new Map(SECTION_REGISTRY.map(s => [s.key, s]))

/**
 * Look up a section definition by key. Returns the SectionDef if
 * known, or a default (non-special, order 99) for custom sections.
 */
export function getSectionDef(key: string): SectionDef {
  return SECTION_MAP.get(key) ?? { key, i18nKey: `section.${key}`, special: false, order: 99 }
}

/** Whether a section key is "special" (interactive, not prose). */
export function isSpecialSection(key: string): boolean {
  return getSectionDef(key).special
}
