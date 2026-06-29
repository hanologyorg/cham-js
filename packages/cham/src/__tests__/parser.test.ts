import { describe, it, expect } from 'vitest'
import { ChamParser, parse, splitFrontmatter, parseAnnotationEntry } from '../parser.js'
import { ChamSerializer, serialize } from '../serializer.js'

// ─── Fixtures ──────────────────────────────────────────────────

// Single-newline = continuation within same block, double-newline = block boundary
const PRIMARY_SOURCE = `---
id: 1
title: 靜夜思
contributors:
  - ref: LBY
    role: author
date:
  dynasty: 唐
genre: poetry
---

床前{1}明月{/1}光，
疑是地上霜。

舉頭望{2}明月{/2}，
低頭思故鄉。

## 注釋

{1} meaning [明月][明亮的月光]
{2} meaning [望][抬頭看]`

const SECONDARY_SOURCE = `---
base: text.cham.md
contributor: 王弼
role: commentator
---

## 注釋

{1} commentary [此句極寫月光之明]`

// ─── Parser Tests ──────────────────────────────────────────────

describe('splitFrontmatter', () => {
  it('splits frontmatter from body', () => {
    const { meta, body } = splitFrontmatter(PRIMARY_SOURCE)
    expect(meta).toContain('id: 1')
    expect(body).toContain('床前')
    expect(body).toContain('## 注釋')
  })

  it('handles no frontmatter', () => {
    const { meta, body } = splitFrontmatter('just text')
    expect(meta).toBe('')
    expect(body).toBe('just text')
  })

  it('strips BOM', () => {
    const { meta, body } = splitFrontmatter('﻿' + PRIMARY_SOURCE)
    expect(meta).toContain('id: 1')
  })
})

describe('parse', () => {
  it('parses a primary document', () => {
    const doc = parse(PRIMARY_SOURCE)
    expect(doc.meta.type).toBe('primary')
    expect((doc.meta as any).id).toBe(1)
    expect((doc.meta as any).title).toBe('靜夜思')
  })

  it('parses text blocks — double-newline separates blocks', () => {
    const doc = parse(PRIMARY_SOURCE)
    // Two blocks: first 2 lines joined, second 2 lines joined
    expect(doc.textBlocks.length).toBe(2)
    expect(doc.textBlocks[0].text).toBe('床前明月光，疑是地上霜。')
    expect(doc.textBlocks[1].text).toBe('舉頭望明月，低頭思故鄉。')
  })

  it('builds marker table', () => {
    const doc = parse(PRIMARY_SOURCE)
    expect(doc.markers.size).toBe(2)
    expect(doc.markers.get(1)).toBeDefined()
    expect(doc.markers.get(1)!.text).toBe('明月')
    expect(doc.markers.get(2)!.text).toBe('明月')
  })

  it('parses annotation sections', () => {
    const doc = parse(PRIMARY_SOURCE)
    expect(doc.sections.length).toBe(1)
    expect(doc.sections[0].name).toBe('注釋')
    expect(doc.sections[0].entries.length).toBe(2)
  })

  it('parses marker annotations with headword', () => {
    const doc = parse(PRIMARY_SOURCE)
    const entry = doc.sections[0].entries[0]
    expect(entry.target.type).toBe('marker')
    if (entry.target.type === 'marker') expect(entry.target.markerId).toBe(1)
    expect(entry.kind).toBe('meaning')
    expect(entry.headword).toBe('明月')
    expect(entry.value).toBe('明亮的月光')
  })

  it('parses secondary document', () => {
    const doc = parse(SECONDARY_SOURCE)
    expect(doc.meta.type).toBe('secondary')
    expect((doc.meta as any).base).toBe('text.cham.md')
    expect((doc.meta as any).contributor).toBe('王弼')
  })

  it('parses @title target', () => {
    const source = `---
id: 2
title: Test
---

Text block

## Notes

@title pron type:bopomofo lang:cmn [ㄐㄧㄥˋ]`
    const doc = parse(source)
    expect(doc.sections[0].entries.length).toBe(1)
    expect(doc.sections[0].entries[0].target.type).toBe('title')
  })

  it('parses @full target', () => {
    const source = `---
id: 3
title: Test
---

Text block

## Notes

@full commentary [整體評論]`
    const doc = parse(source)
    expect(doc.sections[0].entries.length).toBe(1)
    expect(doc.sections[0].entries[0].target.type).toBe('full')
  })

  it('parses @verse target', () => {
    const source = `---
id: 4
title: Test
---

Text block

## Notes

@verse:0:3 meaning [字]`
    const doc = parse(source)
    expect(doc.sections[0].entries.length).toBe(1)
    const t = doc.sections[0].entries[0].target
    expect(t.type).toBe('verse')
    if (t.type === 'verse') {
      expect(t.line).toBe(0)
      expect(t.char).toBe(3)
      expect(t.end).toBeUndefined()
    }
  })

  it('parses @verse range target', () => {
    const source = `---
id: 4
title: Test
---

Text block

## Notes

@verse:0:2-5 commentary [annotation text]`
    const doc = parse(source)
    expect(doc.sections[0].entries.length).toBe(1)
    const t = doc.sections[0].entries[0].target
    expect(t.type).toBe('verse')
    if (t.type === 'verse') {
      expect(t.line).toBe(0)
      expect(t.char).toBe(2)
      expect(t.end).toBe(5)
    }
  })

  it('parses @position as alias for @verse', () => {
    const source = `---
id: 4
title: Test
---

Text block

## Notes

@position:0:3 meaning [字]`
    const doc = parse(source)
    expect(doc.sections[0].entries.length).toBe(1)
    const t = doc.sections[0].entries[0].target
    expect(t.type).toBe('verse')
    if (t.type === 'verse') {
      expect(t.line).toBe(0)
      expect(t.char).toBe(3)
      expect(t.end).toBeUndefined()
    }
  })

  it('parses annotation params', () => {
    const source = `---
id: 5
title: Test
---

Text block

## Notes

{1} pron type:bopomofo lang:yue [粵拼]`
    const doc = parse(source)
    const entry = doc.sections[0].entries[0]
    expect(entry.params.type).toBe('bopomofo')
    expect(entry.params.lang).toBe('yue')
  })

  it('handles zero-width markers', () => {
    const source = `---
id: 6
title: Test
---

ABC{1}{/1}DEF

## Notes

{1} meaning [test]`
    const doc = parse(source)
    const m = doc.markers.get(1)
    expect(m).toBeDefined()
    expect(m!.length).toBe(0)
  })

  it('handles multi-section documents', () => {
    const source = `---
id: 7
title: Test
---

Line1

Line2

## Section A

{1} meaning [a]

## Section B

{1} commentary [b]`
    const doc = parse(source)
    expect(doc.sections.length).toBe(2)
    expect(doc.sections[0].name).toBe('Section A')
    expect(doc.sections[1].name).toBe('Section B')
  })

  it('handles section meta lines', () => {
    const source = `---
id: 8
title: Test
---

Text block

## 注釋
@contributor: 王弼
@role: commentator
{1} meaning [test]`
    const doc = parse(source)
    expect(doc.sections[0].meta.contributor).toBe('王弼')
    expect(doc.sections[0].meta.role).toBe('commentator')
  })

  it('parses contributors from frontmatter', () => {
    const doc = parse(PRIMARY_SOURCE)
    const meta = doc.meta as any
    expect(meta.contributors).toHaveLength(1)
    expect(meta.contributors[0].ref).toBe('LBY')
    expect(meta.contributors[0].role).toBe('author')
  })

  it('parses date from frontmatter', () => {
    const doc = parse(PRIMARY_SOURCE)
    const meta = doc.meta as any
    expect(meta.date).toBeDefined()
    expect(meta.date.dynasty).toBe('唐')
  })

  it('handles single-line text blocks', () => {
    const source = `---
id: 9
title: Test
---

Line 1

Line 2

Line 3`
    const doc = parse(source)
    expect(doc.textBlocks.length).toBe(3)
    expect(doc.textBlocks[0].text).toBe('Line 1')
    expect(doc.textBlocks[1].text).toBe('Line 2')
    expect(doc.textBlocks[2].text).toBe('Line 3')
  })
})

describe('parseAnnotationEntry', () => {
  it('parses a marker annotation', () => {
    const entry = parseAnnotationEntry('{1} meaning [test]')
    expect(entry).not.toBeNull()
    expect(entry!.target.type).toBe('marker')
    expect(entry!.kind).toBe('meaning')
    expect(entry!.value).toBe('test')
  })

  it('parses annotation with headword', () => {
    const entry = parseAnnotationEntry('{1} meaning [明月][月光]')
    expect(entry).not.toBeNull()
    expect(entry!.headword).toBe('明月')
    expect(entry!.value).toBe('月光')
  })

  it('returns null for invalid input', () => {
    expect(parseAnnotationEntry('')).toBeNull()
    expect(parseAnnotationEntry('no target')).toBeNull()
  })
})

// ─── Serializer Tests ──────────────────────────────────────────

describe('serialize', () => {
  it('serializes a parsed document', () => {
    const doc = parse(PRIMARY_SOURCE)
    const result = serialize(doc)
    expect(result).toContain('---')
    expect(result).toContain('id: 1')
    expect(result).toContain('title: 靜夜思')
  })

  it('produces valid frontmatter', () => {
    const doc = parse(PRIMARY_SOURCE)
    const result = serialize(doc)
    expect(result.startsWith('---')).toBe(true)
    const fmEnd = result.indexOf('\n---')
    expect(fmEnd).toBeGreaterThan(0)
  })
})

describe('round-trip equivalence', () => {
  it('parse → serialize → parse produces same data', () => {
    const doc1 = parse(PRIMARY_SOURCE)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    expect(doc2.meta.type).toBe(doc1.meta.type)
    expect((doc2.meta as any).id).toBe((doc1.meta as any).id)
    expect((doc2.meta as any).title).toBe((doc1.meta as any).title)
    expect(doc2.textBlocks.length).toBe(doc1.textBlocks.length)
    expect(doc2.markers.size).toBe(doc1.markers.size)
    expect(doc2.sections.length).toBe(doc1.sections.length)
  })

  it('preserves marker offsets across round-trip', () => {
    const doc1 = parse(PRIMARY_SOURCE)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    for (const [id, marker1] of doc1.markers) {
      const marker2 = doc2.markers.get(id)
      expect(marker2).toBeDefined()
      expect(marker2!.offset).toBe(marker1.offset)
      expect(marker2!.length).toBe(marker1.length)
    }
  })

  it('preserves annotation entries across round-trip', () => {
    const doc1 = parse(PRIMARY_SOURCE)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    for (let si = 0; si < doc1.sections.length; si++) {
      const s1 = doc1.sections[si]
      const s2 = doc2.sections[si]
      expect(s2.name).toBe(s1.name)
      expect(s2.entries.length).toBe(s1.entries.length)

      for (let ei = 0; ei < s1.entries.length; ei++) {
        const e1 = s1.entries[ei]
        const e2 = s2.entries[ei]
        expect(e2.target.type).toBe(e1.target.type)
        expect(e2.kind).toBe(e1.kind)
        expect(e2.value).toBe(e1.value)
      }
    }
  })

  it('round-trips secondary documents', () => {
    const doc1 = parse(SECONDARY_SOURCE)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    expect(doc2.meta.type).toBe('secondary')
    expect((doc2.meta as any).base).toBe('text.cham.md')
    expect((doc2.meta as any).contributor).toBe('王弼')
    expect(doc2.sections[0].entries.length).toBe(doc1.sections[0].entries.length)
  })
})

// ─── ChamParser / ChamSerializer classes ───────────────────────

describe('ChamParser', () => {
  it('can be instantiated and used', () => {
    const parser = new ChamParser()
    const doc = parser.parse(PRIMARY_SOURCE)
    expect(doc.meta.type).toBe('primary')
  })
})

describe('ChamSerializer', () => {
  it('can be instantiated and used', () => {
    const doc = parse(PRIMARY_SOURCE)
    const serializer = new ChamSerializer()
    const result = serializer.serialize(doc)
    expect(result).toContain('靜夜思')
  })
})

// ─── buildMeta YAML Boundary Validation ───────────────────────
// buildMeta sits at the YAML → typed-model boundary. Malformed input
// must produce a clear ChamParseError, not silently coerce.

import { buildMeta, ChamParseError } from '../parser/frontmatter-parser.js'

describe('buildMeta boundary validation', () => {
  it('rejects non-record YAML', () => {
    expect(() => buildMeta(42)).toThrow(ChamParseError)
    expect(() => buildMeta(null)).toThrow(ChamParseError)
    expect(() => buildMeta([1, 2, 3])).toThrow(ChamParseError)
  })

  it('rejects primary meta missing title', () => {
    expect(() => buildMeta({ id: 1 })).toThrow(/title/)
  })

  it('rejects contributor with no ref', () => {
    expect(() => buildMeta({
      id: 1, title: 'T',
      contributors: [{ role: 'author' }],
    })).toThrow(/ref/)
  })

  it('rejects contributor with no role', () => {
    expect(() => buildMeta({
      id: 1, title: 'T',
      contributors: [{ ref: 'A001' }],
    })).toThrow(/role/)
  })

  it('rejects hierarchy entry missing level', () => {
    expect(() => buildMeta({
      id: 1, title: 'T',
      hierarchy: [{ index: 0 }],
    })).toThrow(/level/)
  })

  it('accepts well-formed primary meta', () => {
    const meta = buildMeta({ id: 1, title: 'T' })
    expect(meta.type).toBe('primary')
  })

  it('accepts well-formed secondary meta', () => {
    const meta = buildMeta({ base: 'text.cham.md', contributor: 'C020', role: 'annotator' })
    expect(meta.type).toBe('secondary')
  })

  it('accepts well-formed part meta', () => {
    const meta = buildMeta({ part: 1, group: 'g', title: 'pt' })
    expect(meta.type).toBe('part')
  })
})

// ─── All Annotation Kinds Round-Trip ─────────────────────────────

describe('all annotation kinds round-trip', () => {
  const allKindsSource = `---
id: 99
title: All Kinds Test
---
{1}齕{/1}{2}宓{/1}{3}處{/3}{4}B{/4}{5}騅{/5}{6}殷紂{/6}{7}垓下{/7}{8}亂臣{/8}{9}開元{/9}{10}周書{/10}{11}道可道{/11}{12}水{/12}{13}老子{/13}{14}可道{/14}

## 注釋

{1} fanqie upper:恨 lower:沒 [齕][恨沒切]

{2} zhiyin [宓][伏]

{3} tone [處][上聲]

{4} pron type:pinyin lang:cmn [zhuī]

{5} meaning [騅][毛色青白相雜的馬]

{6} person ref:A213 [殷紂][商紂王]

{7} place ref:P001 [垓下][今安徽靈璧]

{8} event ref:E010 [亂臣十人][周武王十位輔臣]

{9} date dynasty:唐 era:開元 year:15 iso:727 [開元十五年]

{10} allusion source:shangshu [周書稱殷紂有億兆夷人]

{11} collation source:帛書甲本 [作「道可道也」]

{12} variant action:emend [水][冰]

{13} see-also ref:laozi/1 [老子第一章]

{14} commentary [可道之道可名之名]`

  it('parses all annotation kinds', () => {
    const doc = parse(allKindsSource)
    const section = doc.sections[0]
    expect(section.entries.length).toBe(14)

    const kinds = section.entries.map(e => e.kind)
    expect(kinds).toEqual([
      'fanqie', 'zhiyin', 'tone', 'pron', 'meaning',
      'person', 'place', 'event', 'date', 'allusion',
      'collation', 'variant', 'see-also', 'commentary',
    ])
  })

  it('round-trips all annotation kinds', () => {
    const doc1 = parse(allKindsSource)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    const kinds1 = doc1.sections[0].entries.map(e => e.kind)
    const kinds2 = doc2.sections[0].entries.map(e => e.kind)
    expect(kinds2).toEqual(kinds1)

    const params1 = doc1.sections[0].entries.map(e => ({ ...e.params }))
    const params2 = doc2.sections[0].entries.map(e => ({ ...e.params }))
    expect(params2).toEqual(params1)

    const values1 = doc1.sections[0].entries.map(e => e.value)
    const values2 = doc2.sections[0].entries.map(e => e.value)
    expect(values2).toEqual(values1)
  })

  it('preserves fanqie upper and lower params', () => {
    const doc = parse(allKindsSource)
    const entry = doc.sections[0].entries[0]
    expect(entry.kind).toBe('fanqie')
    expect(entry.params.upper).toBe('恨')
    expect(entry.params.lower).toBe('沒')
    expect(entry.value).toBe('恨沒切')
  })

  it('preserves tone value', () => {
    const doc = parse(allKindsSource)
    const toneEntry = doc.sections[0].entries.find(e => e.kind === 'tone')!
    expect(toneEntry.value).toBe('上聲')
  })
})
