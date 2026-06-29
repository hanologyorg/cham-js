import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import { serialize } from '../serializer.js'

// ─── Fixtures ──────────────────────────────────────────────────

const OVERLAPPING_MARKERS = `---
id: 1
title: 垓下歌
contributors:
  - ref: A001
    role: author
date:
  dynasty: 秦末
genre: poetry
---

力拔山兮氣蓋世。

時不利兮{1}騅{/1}不逝。

騅不逝兮可奈何！


虞兮虞兮{2}奈若何{/2}！

## 注釋

{1} meaning [騅][項羽的馬名]

{2} meaning [奈何][
「奈何」意為「怎麼辦」。
全句即「把你怎麼辦呢」。

表達了項羽對虞姬的深情與無奈。
]`

const ENCLOSED_MARKERS = `---
id: 2
title: 奈若何
---
{1}奈{2}若何{/2}{/1}！

## 注釋

{1} meaning [奈若何][怎麼辦呢]

{2} meaning [若][你]`

const PROSE_CONTINUATION = `---
id: 3
title: 道德經第一章
genre: prose
---

{1}道{/1}可道，非常{2}道{/2}。
{3}名{/3}可名，非常{4}名{/4}。

無名天地之始，有名萬物之母。
故常無欲，以觀其妙；
常有欲，以觀其徼。

## 注釋

{1} meaning [道][宇宙的本源和根本規律]

{3} meaning [名][名字、概念]`

const MULTI_SECTION_FILE = `---
id: 4
title: 多層注釋
---
文本內容

## 注釋
@contributor: A050
@role: annotator
@nature: annotation

{1} meaning [test]

## 王弼註
@contributor: A010
@role: annotator
@dynasty: 三國（魏）
@nature: commentary

{1} commentary [古注內容]`

const PARAMS_ANNOTATION = `---
id: 5
title: 注音測試
---
{1}騅{/1}不逝

## 注釋

{1} pron type:hom lang:yue [錐]

{1} pron type:jyut lang:yue [zeoi1]

{1} pron type:pinyin lang:cmn [zhuī]

{1} meaning [騅][項羽的馬名]`

const ALL_TARGETS = `---
id: 6
title: 全面測試
---
文本內容

## Notes

@title pron type:pinyin lang:cmn [cè]

@full meaning [整體評論]

{1} meaning [test]

@verse:0:3 meaning [字]`

// ─── Round-Trip Tests ──────────────────────────────────────────

describe('round-trip: overlapping markers', () => {
  it('preserves marker positions through round-trip', () => {
    const doc = parse(OVERLAPPING_MARKERS)
    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    expect(doc2.markers.size).toBe(doc.markers.size)
    for (const [id, m1] of doc.markers) {
      const m2 = doc2.markers.get(id)
      expect(m2).toBeDefined()
      expect(m2!.offset).toBe(m1.offset)
      expect(m2!.length).toBe(m1.length)
      expect(m2!.text).toBe(m1.text)
    }
  })

  it('preserves multi-section text (stanzas)', () => {
    const doc = parse(OVERLAPPING_MARKERS)
    expect(doc.textBlocks.length).toBe(4)
    const serialized = serialize(doc)
    const doc2 = parse(serialized)
    expect(doc2.textBlocks.length).toBe(4)
  })
})

describe('round-trip: enclosed markers', () => {
  it('preserves enclosed marker ranges', () => {
    const doc = parse(ENCLOSED_MARKERS)
    expect(doc.markers.get(1)!.text).toBe('奈若何')
    expect(doc.markers.get(2)!.text).toBe('若何')

    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    expect(doc2.markers.get(1)!.text).toBe('奈若何')
    expect(doc2.markers.get(2)!.text).toBe('若何')
    expect(doc2.markers.get(1)!.offset).toBe(doc.markers.get(1)!.offset)
    expect(doc2.markers.get(2)!.offset).toBe(doc.markers.get(2)!.offset)
  })
})

describe('round-trip: prose continuation lines', () => {
  it('merges continuation lines into single block', () => {
    const doc = parse(PROSE_CONTINUATION)
    // First 2 lines = 1 block, next 3 lines = 1 block
    expect(doc.textBlocks.length).toBe(2)
    expect(doc.textBlocks[0].text).toBe('道可道，非常道。名可名，非常名。')
    expect(doc.textBlocks[1].text).toBe('無名天地之始，有名萬物之母。故常無欲，以觀其妙；常有欲，以觀其徼。')
  })

  it('preserves marker offsets across continuation round-trip', () => {
    const doc = parse(PROSE_CONTINUATION)
    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    for (const [id, m1] of doc.markers) {
      const m2 = doc2.markers.get(id)
      expect(m2).toBeDefined()
      expect(m2!.offset).toBe(m1.offset)
      expect(m2!.length).toBe(m1.length)
    }
  })
})

describe('round-trip: multi-line annotation values', () => {
  it('preserves multi-line value content', () => {
    const doc = parse(OVERLAPPING_MARKERS)
    const mlEntry = doc.sections[0].entries.find(e => e.value.includes('怎麼辦'))
    expect(mlEntry).toBeDefined()
    expect(mlEntry!.value).toContain('全句即「把你怎麼辦呢」')

    const serialized = serialize(doc)
    const doc2 = parse(serialized)
    const mlEntry2 = doc2.sections[0].entries.find(e => e.value.includes('怎麼辦'))
    expect(mlEntry2).toBeDefined()
    expect(mlEntry2!.value).toBe(mlEntry!.value)
  })
})

describe('round-trip: section metadata', () => {
  it('preserves section meta across round-trip', () => {
    const doc = parse(MULTI_SECTION_FILE)
    expect(doc.sections.length).toBe(2)
    expect(doc.sections[0].meta.contributor).toBe('A050')
    expect(doc.sections[1].meta.contributor).toBe('A010')
    expect(doc.sections[1].meta.dynasty).toBe('三國（魏）')
    expect(doc.sections[1].meta.nature).toBe('commentary')

    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    expect(doc2.sections.length).toBe(2)
    expect(doc2.sections[0].meta.contributor).toBe('A050')
    expect(doc2.sections[1].meta.contributor).toBe('A010')
    expect(doc2.sections[1].meta.dynasty).toBe('三國（魏）')
    expect(doc2.sections[1].meta.nature).toBe('commentary')
  })

  it('preserves annotation entries across sections', () => {
    const doc = parse(MULTI_SECTION_FILE)
    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    expect(doc2.sections[0].entries.length).toBe(doc.sections[0].entries.length)
    expect(doc2.sections[1].entries.length).toBe(doc.sections[1].entries.length)
    expect(doc2.sections[1].entries[0].kind).toBe('commentary')
    expect(doc2.sections[1].entries[0].value).toBe('古注內容')
  })
})

describe('round-trip: annotation params', () => {
  it('preserves multiple annotations for same marker', () => {
    const doc = parse(PARAMS_ANNOTATION)
    expect(doc.sections[0].entries.length).toBe(4) // 3 pron + 1 meaning

    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    expect(doc2.sections[0].entries.length).toBe(4)
    const pronEntries = doc2.sections[0].entries.filter(e => e.kind === 'pron')
    expect(pronEntries.length).toBe(3)
    expect(pronEntries[0].params.type).toBe('hom')
    expect(pronEntries[0].params.lang).toBe('yue')
    expect(pronEntries[1].params.type).toBe('jyut')
    expect(pronEntries[2].params.type).toBe('pinyin')
  })
})

describe('round-trip: all target types', () => {
  it('preserves @title, @full, marker, and @verse targets', () => {
    const doc = parse(ALL_TARGETS)
    expect(doc.sections[0].entries.length).toBe(4)
    expect(doc.sections[0].entries[0].target.type).toBe('title')
    expect(doc.sections[0].entries[1].target.type).toBe('full')
    expect(doc.sections[0].entries[2].target.type).toBe('marker')
    expect(doc.sections[0].entries[3].target.type).toBe('verse')

    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    expect(doc2.sections[0].entries.length).toBe(4)
    // Canonical order: @title, @verse:0:3, {1}, @full
    expect(doc2.sections[0].entries[0].target.type).toBe('title')
    expect(doc2.sections[0].entries[1].target.type).toBe('verse')
    expect(doc2.sections[0].entries[2].target.type).toBe('marker')
    expect(doc2.sections[0].entries[3].target.type).toBe('full')
    if (doc2.sections[0].entries[1].target.type === 'verse') {
      expect(doc2.sections[0].entries[1].target.line).toBe(0)
      expect(doc2.sections[0].entries[1].target.char).toBe(3)
    }
  })
})

// ─── Canonical Ordering Tests ──────────────────────────────────

const CANONICAL_ORDER_SRC = `---
id: 7
title: Canonical Order Test
---
{1}道{/1}可道

## 注釋

{1} meaning [釋義]

{1} fanqie upper:徒 lower:耗 [道][徒耗切]

{1} tone [道][上聲]

{1} commentary [古注]

{1} person ref:A001 [老子]

{1} zhiyin [道][導]`

describe('serializer canonical ordering', () => {
  it('orders entries by kind priority within same marker', () => {
    const doc = parse(CANONICAL_ORDER_SRC)
    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    const kinds = doc2.sections[0].entries.map(e => e.kind)
    // Canonical: fanqie(2), zhiyin(3), tone(4), meaning(5), person(6), commentary(8)
    expect(kinds).toEqual(['fanqie', 'zhiyin', 'tone', 'meaning', 'person', 'commentary'])
  })

  it('groups entries by marker id', () => {
    const multiMarker = `---
id: 8
title: Multi-Marker Order
---
{2}B{/2}{1}A{/1}

## 注釋

{2} meaning [B的釋義]

{1} commentary [A的古注]

{1} meaning [A的釋義]

{2} fanqie upper:彼 lower:萌 [B][彼萌切]`

    const doc = parse(multiMarker)
    const serialized = serialize(doc)
    const doc2 = parse(serialized)

    const entries = doc2.sections[0].entries
    // {1} entries first (marker 1), then {2} entries (marker 2)
    const markerOrder = entries.map(e => e.target.type === 'marker' ? e.target.markerId : -1)
    expect(markerOrder).toEqual([1, 1, 2, 2])
    // Within {1}: commentary after meaning; within {2}: fanqie before meaning
    expect(entries[0].kind).toBe('meaning')
    expect(entries[1].kind).toBe('commentary')
    expect(entries[2].kind).toBe('fanqie')
    expect(entries[3].kind).toBe('meaning')
  })

  // Locks in the canonical kind ordering for ALL built-in kinds, so any
  // future divergence between serializer and AnnotationKindRegistry's
  // displayOrder is caught. The expected order mirrors the registry's
  // BUILTIN_SPECS displayOrder values (stable sort within same order).
  it('orders all built-in kinds by registry displayOrder', () => {
    // Source order is intentionally scrambled; after sort, kinds must
    // appear in displayOrder groups (1, 2, 3, ..., 12), preserving source
    // order within each group.
    const allKindsSrc = `---
id: 9
title: All Kinds Order
---
{1}道{/1}

## 注釋

{1} speaker ref:A001 role:emperor [s]
{1} variant action:emend [v]
{1} zhiyin [道][導]
{1} see-also ref:x/1 [s]
{1} skqs-variant unicode:𫝆 [s]
{1} date dynasty:Han [c]
{1} collation [c]
{1} commentary [c]
{1} bpmf [ㄉㄠ]
{1} allusion source:Classic [a]
{1} tone [上聲]
{1} translation [t]
{1} place ref:P001 [p]
{1} pinyin [dao]
{1} meaning [m]
{1} jyutping [zeoi1]
{1} fanqie upper:徒 lower:耗 [道][徒耗切]
{1} event ref:E1 [c]
{1} person ref:A001 [p]
{1} pron type:pinyin lang:cmn [dao]`

    const doc = parse(allKindsSrc)
    const doc2 = parse(serialize(doc))
    const kinds = doc2.sections[0].entries.map(e => e.kind)

    // Source-order-within-group:
    //   order 1: pron(20), pinyin(16), bpmf(9), jyutping(17)
    //   order 2: fanqie(18)
    //   order 3: zhiyin(3)
    //   order 4: tone(12)
    //   order 5: meaning(15)
    //   order 6: date(8), place(14), event(19), person(20)
    //     Source positions: date=8, event=19, person=20, place=14
    //     → date, place, event, person
    //   order 7: allusion(10)
    //   order 8: commentary(7)
    //   order 9: translation(13)
    //   order 10: variant(2), skqs-variant(5), collation(6)
    //     Source positions: collation=6, skqs-variant=5, variant=2
    //     → variant, skqs-variant, collation
    //   order 11: see-also(4)
    //   order 12: speaker(1)
    expect(kinds).toEqual([
      'bpmf', 'pinyin', 'jyutping', 'pron',  // 1 (pronunciation family; stable by source order)
      'fanqie',                                // 2
      'zhiyin',                                // 3
      'tone',                                  // 4
      'meaning',                               // 5
      'date', 'place', 'event', 'person',      // 6 (named-entity family)
      'allusion',                              // 7
      'commentary',                            // 8
      'translation',                           // 9
      'variant', 'skqs-variant', 'collation',  // 10 (textual criticism)
      'see-also',                              // 11
      'speaker',                               // 12
    ])
  })
})

// ─── Serializer Output Format Tests ───────────────────────────

describe('serializer output format', () => {
  it('produces valid CHAM with frontmatter delimiters', () => {
    const doc = parse(OVERLAPPING_MARKERS)
    const result = serialize(doc)
    expect(result.startsWith('---\n')).toBe(true)
    const fmEnd = result.indexOf('\n---', 3)
    expect(fmEnd).toBeGreaterThan(0)
  })

  it('separates frontmatter, text, and annotation sections', () => {
    const doc = parse(OVERLAPPING_MARKERS)
    const result = serialize(doc)
    const parts = result.split('\n\n## ')
    expect(parts.length).toBeGreaterThanOrEqual(2)
  })

  it('serializes multi-line values with ] on its own line', () => {
    const doc = parse(OVERLAPPING_MARKERS)
    const mlEntry = doc.sections[0].entries.find(e => e.value.includes('\n'))
    expect(mlEntry).toBeDefined()

    const result = serialize(doc)
    expect(result).toMatch(/\n]$/)
  })
})
