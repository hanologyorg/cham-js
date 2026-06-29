import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import { serialize } from '../serializer.js'
import { buildAnnotations, buildAnnotationsFromLayer } from '../pipeline.js'

// ─── Text-Quote Annotations End-to-End ─────────────────────────
// These specs verify that the new external text-quote reference syntax
// (@[quote] and @N[quote]) works across parser, serializer, and pipeline.

const TEXT_QUOTE_SOURCE = `---
id: 10
title: 山海經南山經（節選）
genre: prose
---

南山經之首曰䧿山其首曰招揺之山

臨于西海之上

多桂多金玉有草焉其狀如韭而青華其名曰祝餘食之不饑

又東三百里曰堂庭之山

又東三百里曰猨翼之山

## 注釋

@[臨于西海之上] commentary [郭曰在蜀伏山山南之西頭濵西海也]

@[多桂] commentary [郭曰桂葉似枇杷長二尺餘廣數寸味辛白花叢生山峰冬夏常青間無雜木]

@v:0 commentary [此為南山經之首總起]

@4[又東三百里] commentary [此句重出故以卷數別之]`

describe('text-quote annotation parsing', () => {
  it('parses @[quote] target type', () => {
    const doc = parse(TEXT_QUOTE_SOURCE)
    const entry = doc.sections[0].entries[0]
    expect(entry.target.type).toBe('text')
    if (entry.target.type === 'text') {
      expect(entry.target.quote).toBe('臨于西海之上')
      expect(entry.target.verseHint).toBeUndefined()
    }
  })

  it('parses @[quote] with unique match', () => {
    const doc = parse(TEXT_QUOTE_SOURCE)
    const entry = doc.sections[0].entries[1]
    expect(entry.target.type).toBe('text')
    if (entry.target.type === 'text') {
      expect(entry.target.quote).toBe('多桂')
    }
  })

  it('parses @v:N verse-all target', () => {
    const doc = parse(TEXT_QUOTE_SOURCE)
    const entry = doc.sections[0].entries[2]
    expect(entry.target.type).toBe('verse-all')
    if (entry.target.type === 'verse-all') {
      expect(entry.target.line).toBe(0)
    }
  })

  it('parses @N[quote] with verse hint', () => {
    const doc = parse(TEXT_QUOTE_SOURCE)
    const entry = doc.sections[0].entries[3]
    expect(entry.target.type).toBe('text')
    if (entry.target.type === 'text') {
      expect(entry.target.quote).toBe('又東三百里')
      expect(entry.target.verseHint).toBe(4)
    }
  })
})

describe('text-quote annotation serialization', () => {
  it('round-trips text-quote annotations', () => {
    const doc1 = parse(TEXT_QUOTE_SOURCE)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    expect(doc2.sections[0].entries.length).toBe(doc1.sections[0].entries.length)

    // Serializer reorders entries by display order; find by content.
    const entries2 = doc2.sections[0].entries

    // @[quote] without hint — find the entry with quote '臨于西海之上'
    const e0 = entries2.find(e => e.target.type === 'text' && 'quote' in e.target && e.target.quote === '臨于西海之上')!
    expect(e0).toBeDefined()
    expect(e0.target.type).toBe('text')
    expect(serialized).toContain('@[臨于西海之上]')

    // @[quote] with hint
    const e3 = entries2.find(e => e.target.type === 'text' && 'quote' in e.target && e.target.quote === '又東三百里')!
    expect(e3).toBeDefined()
    expect(e3.target.type).toBe('text')
    if (e3.target.type === 'text') {
      expect(e3.target.verseHint).toBe(4)
    }
    expect(serialized).toContain('@4[又東三百里]')

    // @v:N
    const e2 = entries2.find(e => e.target.type === 'verse-all')!
    expect(e2).toBeDefined()
    expect(serialized).toContain('@v:0')
  })
})

describe('text-quote annotation in pipeline', () => {
  it('resolves text-quote to verse ranges', () => {
    const doc = parse(TEXT_QUOTE_SOURCE)
    const annotations = buildAnnotations(doc, 10)

    // @[臨于西海之上] → verse 1 (second text block)
    const ann0 = annotations.find(a => a.id === '10-1')!
    expect(ann0).toBeDefined()
    expect(ann0.range.scope).toBe('verse')
    if (ann0.range.scope === 'verse') {
      expect(ann0.range.verseIndex).toBe(1)
    }
    // The headword text at that range should be "臨于西海之上"
    const block = doc.textBlocks[1]
    expect(block.text.slice(ann0.range.start, ann0.range.end)).toBe('臨于西海之上')
  })

  it('resolves @v:N to entire verse', () => {
    const doc = parse(TEXT_QUOTE_SOURCE)
    const annotations = buildAnnotations(doc, 10)

    // @v:0 → verse 0 (first text block), entire range
    const verseAllAnn = annotations.find(a => a.id === '10-3')!
    expect(verseAllAnn).toBeDefined()
    if (verseAllAnn.range.scope === 'verse') {
      expect(verseAllAnn.range.verseIndex).toBe(0)
      expect(verseAllAnn.range.start).toBe(0)
      expect(verseAllAnn.range.end).toBe(doc.textBlocks[0].text.length)
    }
  })

  it('resolves @N[quote] with verse hint to correct verse', () => {
    const doc = parse(TEXT_QUOTE_SOURCE)
    const annotations = buildAnnotations(doc, 10)

    // @4[又東三百里] → verse 4 (5th text block)
    const hintAnn = annotations.find(a => a.id === '10-4')!
    expect(hintAnn).toBeDefined()
    if (hintAnn.range.scope === 'verse') {
      expect(hintAnn.range.verseIndex).toBe(4)
    }
  })

  it('preserves annotation value text', () => {
    const doc = parse(TEXT_QUOTE_SOURCE)
    const annotations = buildAnnotations(doc, 10)

    const ann0 = annotations.find(a => a.id === '10-1')!
    expect(ann0.text).toBe('郭曰在蜀伏山山南之西頭濵西海也')
  })
})

describe('text-quote in secondary files (commentary layers)', () => {
  it('resolves text-quote targets against primary text', () => {
    const primary = parse(TEXT_QUOTE_SOURCE)
    const commentarySource = `---
base: text.cham.md
contributor: C020
role: annotator
nature: zhu
---

## 注釋

@[多桂] commentary [桂葉似枇杷長二尺餘]

@[臨于西海之上] commentary [在蜀伏山山南之西頭濱西海也]`

    const layerDoc = parse(commentarySource)
    const annotations = buildAnnotationsFromLayer(layerDoc, primary, 'guopu')

    expect(annotations).toHaveLength(2)
    // First: @[多桂] → verse 2
    expect(annotations[0].range.scope).toBe('verse')
    // Should have contributor propagated from file-level
    expect(annotations[0].contributor).toBe('C020')
  })
})

describe('per-annotation contributor propagation', () => {
  it('propagates section-level contributor to annotations', () => {
    const source = `---
id: 1
title: Test
---

南山經之首曰䧿山

## 注釋
@contributor: C020
@nature: zhu

@[南山經之首曰䧿山] commentary [郭曰在蜀伏山...]`
    const doc = parse(source)
    const annotations = buildAnnotations(doc, 1)
    expect(annotations[0].contributor).toBe('C020')
  })

  it('does not set contributor when section has none', () => {
    const source = `---
id: 1
title: Test
---

南山經之首曰䧿山

## 注釋

@[南山經之首曰䧿山] commentary [note]`
    const doc = parse(source)
    const annotations = buildAnnotations(doc, 1)
    expect(annotations[0].contributor).toBeUndefined()
  })
})
