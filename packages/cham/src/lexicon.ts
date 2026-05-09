import type { LexiconEntry, OutputAnnotation, ChamDocument, PrimaryMeta } from './types.js'

export interface LexiconOptions {
  entries: LexiconEntry[]
  defaultLang?: string
}

interface CharPosition {
  char: string
  offset: number
  verseIndex: number
}

function buildLookup(entries: LexiconEntry[]): Map<string, LexiconEntry> {
  const map = new Map<string, LexiconEntry>()
  for (const entry of entries) {
    map.set(entry.char, entry)
  }
  return map
}

function scanText(text: string, verseIndex: number): CharPosition[] {
  const positions: CharPosition[] = []
  for (let i = 0; i < text.length; i++) {
    positions.push({ char: text[i], offset: i, verseIndex })
  }
  return positions
}

function isCovered(offset: number, verseIndex: number, existing: OutputAnnotation[]): boolean {
  for (const ann of existing) {
    if (ann.range.scope === 'verse' && ann.range.verseIndex === verseIndex) {
      if (offset >= ann.range.start && offset < ann.range.end) return true
    }
  }
  return false
}

export class LexiconApplier {
  private lookup: Map<string, LexiconEntry>
  private defaultLang: string

  constructor(opts: LexiconOptions) {
    this.lookup = buildLookup(opts.entries)
    this.defaultLang = opts.defaultLang || 'cmn'
  }

  apply(doc: ChamDocument, existingAnnotations: OutputAnnotation[]): OutputAnnotation[] {
    const annotations: OutputAnnotation[] = []
    let annId = existingAnnotations.length + 1
    const pmeta = doc.meta as PrimaryMeta

    for (let vi = 0; vi < doc.textBlocks.length; vi++) {
      const block = doc.textBlocks[vi]
      const positions = scanText(block.text, vi)

      for (const pos of positions) {
        if (isCovered(pos.offset, vi, existingAnnotations)) continue

        const entry = this.lookup.get(pos.char)
        if (!entry) continue

        const reading = entry.readings.find(r => r.lang === this.defaultLang) || entry.readings[0]
        if (!reading) continue

        annotations.push({
          id: `lex-${pmeta.id}-${annId++}`,
          range: {
            type: 'range',
            scope: 'verse',
            verseIndex: vi,
            start: pos.offset,
            end: pos.offset + pos.char.length,
          },
          kind: 'pronunciation',
          lang: reading.lang,
          text: reading.value,
          source: 'lexicon',
        })
      }
    }

    return annotations
  }
}
