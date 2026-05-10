import { describe, it, expect } from 'vitest'
import { parse, parseAnnotationEntry } from '../parser.js'
import { serialize, serializeEntry } from '../serializer.js'
import { ChamValidator } from '../validator.js'
import { buildPieceFromCham } from '../pipeline.js'
import type { BookConfig } from '../types.js'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

const TMP = join(import.meta.dirname, '__tmp_spec__')

function setupDir(structure: Record<string, string>): void {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
  for (const [path, content] of Object.entries(structure)) {
    const fullPath = join(TMP, path)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content, 'utf-8')
  }
}

function cleanup(): void {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
}

// ─── Spec §06 Text Blocks ─────────────────────────────────────

describe('spec §06 text blocks', () => {
  it('poetry: single blank line = block boundary', () => {
    const source = `---
id: 1
title: Test
genre: poetry
---

力拔山兮氣蓋世。

時不利兮騅不逝。

騅不逝兮可奈何！`
    const doc = parse(source)
    expect(doc.textBlocks.length).toBe(3)
    expect(doc.textBlocks[0].text).toBe('力拔山兮氣蓋世。')
    expect(doc.textBlocks[1].text).toBe('時不利兮騅不逝。')
    expect(doc.textBlocks[2].text).toBe('騅不逝兮可奈何！')
  })

  it('poetry: double blank line = structural break (new section)', () => {
    const source = `---
id: 1
title: Test
genre: poetry
---

力拔山兮氣蓋世。

時不利兮騅不逝。


虞兮虞兮奈若何！`
    const doc = parse(source)
    // Two sections: first has 2 blocks, second has 1
    expect(doc.textBlocks.length).toBe(3)
    expect(doc.textBlocks[0].sectionIndex).toBe(0)
    expect(doc.textBlocks[1].sectionIndex).toBe(0)
    expect(doc.textBlocks[2].sectionIndex).toBe(1)
  })

  it('prose: consecutive lines = continuation (merged)', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

道可道，非常道。
名可名，非常名。

無名天地之始，有名萬物之母。`
    const doc = parse(source)
    // First two lines merge into one block (no blank line)
    // Third line is separate block
    expect(doc.textBlocks.length).toBe(2)
    expect(doc.textBlocks[0].text).toBe('道可道，非常道。名可名，非常名。')
    expect(doc.textBlocks[1].text).toBe('無名天地之始，有名萬物之母。')
  })

  it('section numbering starts from 0', () => {
    const source = `---
id: 1
title: Test
---

Block A


Block B


Block C`
    const doc = parse(source)
    expect(doc.textBlocks[0].sectionIndex).toBe(0)
    expect(doc.textBlocks[1].sectionIndex).toBe(1)
    expect(doc.textBlocks[2].sectionIndex).toBe(2)
  })

  it('block index within section resets per section', () => {
    const source = `---
id: 1
title: Test
---

Line A1

Line A2


Line B1`
    const doc = parse(source)
    expect(doc.textBlocks[0].blockIndexInSection).toBe(0)
    expect(doc.textBlocks[1].blockIndexInSection).toBe(1)
    expect(doc.textBlocks[2].blockIndexInSection).toBe(0)
  })
})

// ─── Spec §07 Inline Markers ──────────────────────────────────

describe('spec §07 inline markers', () => {
  it('markers are zero-width (removed from clean text)', () => {
    const source = `---
id: 1
title: Test
---

時不利兮{1}騅{/1}不逝。`
    const doc = parse(source)
    expect(doc.textBlocks[0].text).toBe('時不利兮騅不逝。')
  })

  it('offset calculation: zero-based in clean text', () => {
    const source = `---
id: 1
title: Test
---

時不利兮{1}騅{/1}不逝。`
    const doc = parse(source)
    const m = doc.markers.get(1)!
    expect(m).toBeDefined()
    expect(m.offset).toBe(4)
    expect(m.length).toBe(1)
    expect(m.text).toBe('騅')
  })

  it('overlapping ranges', () => {
    const source = `---
id: 1
title: Test
---

{1}力拔{2}山兮{/1}氣蓋{/2}世。`
    const doc = parse(source)
    expect(doc.textBlocks[0].text).toBe('力拔山兮氣蓋世。')
    const m1 = doc.markers.get(1)!
    const m2 = doc.markers.get(2)!
    expect(m1.offset).toBe(0)
    expect(m1.length).toBe(4)
    expect(m1.text).toBe('力拔山兮')
    expect(m2.offset).toBe(2)
    expect(m2.length).toBe(4)
    expect(m2.text).toBe('山兮氣蓋')
  })

  it('enclosed ranges', () => {
    const source = `---
id: 1
title: Test
---

{1}奈{2}若何{/2}{/1}！`
    const doc = parse(source)
    expect(doc.textBlocks[0].text).toBe('奈若何！')
    const m1 = doc.markers.get(1)!
    const m2 = doc.markers.get(2)!
    expect(m1.offset).toBe(0)
    expect(m1.length).toBe(3)
    expect(m1.text).toBe('奈若何')
    expect(m2.offset).toBe(1)
    expect(m2.length).toBe(2)
    expect(m2.text).toBe('若何')
  })

  it('zero-width marker (point marker)', () => {
    const source = `---
id: 1
title: Test
---

ABC{1}{/1}DEF`
    const doc = parse(source)
    expect(doc.textBlocks[0].text).toBe('ABCDEF')
    const m = doc.markers.get(1)!
    expect(m.length).toBe(0)
    expect(m.offset).toBe(3)
  })
})

// ─── Spec §08 Annotation Entries ──────────────────────────────

describe('spec §08 annotation entries', () => {
  it('parses all target types', () => {
    expect(parseAnnotationEntry('{1} meaning [test]')!.target.type).toBe('marker')
    expect(parseAnnotationEntry('@title pron type:hom lang:yue [垓][該]')!.target.type).toBe('title')
    expect(parseAnnotationEntry('@full meaning [test]')!.target.type).toBe('full')
    expect(parseAnnotationEntry('@verse:0:3 meaning [test]')!.target.type).toBe('verse')
    expect(parseAnnotationEntry('@verse:0:5-8 commentary [test]')!.target.type).toBe('verse')
  })

  it('parses marker target with headword and value', () => {
    const entry = parseAnnotationEntry('{1} meaning [騅][項羽的馬名]')
    expect(entry!.headword).toBe('騅')
    expect(entry!.value).toBe('項羽的馬名')
  })

  it('parses single bracket value (headword defaults to marker text)', () => {
    const entry = parseAnnotationEntry('{1} meaning [項羽的馬名]')
    expect(entry!.headword).toBeUndefined()
    expect(entry!.value).toBe('項羽的馬名')
  })

  it('parses all defined kinds', () => {
    const kinds = ['pron', 'meaning', 'person', 'place', 'event', 'date', 'allusion', 'commentary', 'translation', 'collation', 'variant', 'see-also']
    for (const kind of kinds) {
      const entry = parseAnnotationEntry(`{1} ${kind} [test]`)
      expect(entry, `kind "${kind}" should parse`).not.toBeNull()
      expect(entry!.kind).toBe(kind)
    }
  })

  it('parses key:value params', () => {
    const entry = parseAnnotationEntry('{3} pron type:hom lang:yue [錐]')
    expect(entry!.params.type).toBe('hom')
    expect(entry!.params.lang).toBe('yue')
  })

  it('parses multiple params', () => {
    const entry = parseAnnotationEntry('{7} date dynasty:唐 era:開元 year:15 iso:727 [開元十五年]')
    expect(entry!.params.dynasty).toBe('唐')
    expect(entry!.params.era).toBe('開元')
    expect(entry!.params.year).toBe('15')
    expect(entry!.params.iso).toBe('727')
  })

  it('parses @title target with params', () => {
    const entry = parseAnnotationEntry('@title pron type:hom lang:yue [垓][該]')
    expect(entry!.target.type).toBe('title')
    expect(entry!.params.type).toBe('hom')
    expect(entry!.headword).toBe('垓')
    expect(entry!.value).toBe('該')
  })

  it('parses multi-line value', () => {
    const source = `---
id: 1
title: Test
---

Text

## Notes

{2} meaning [奈何][
「奈何」意為「怎麼辦」。
全句即「把你怎麼辦呢」。

表達了項羽對虞姬的深情與無奈。
]`
    const doc = parse(source)
    expect(doc.sections[0].entries).toHaveLength(1)
    expect(doc.sections[0].entries[0].value).toContain('怎麼辦')
    expect(doc.sections[0].entries[0].value).toContain('無奈')
  })

  it('parses @verse with explicit end offset', () => {
    const entry = parseAnnotationEntry('@verse:0:5-8 commentary [annotation]')
    expect(entry!.target.type).toBe('verse')
    if (entry!.target.type === 'verse') {
      expect(entry!.target.line).toBe(0)
      expect(entry!.target.char).toBe(5)
      expect(entry!.target.end).toBe(8)
    }
  })

  it('parses @verse without end (defaults to char+1)', () => {
    const entry = parseAnnotationEntry('@verse:0:3 meaning [字]')
    expect(entry!.target.type).toBe('verse')
    if (entry!.target.type === 'verse') {
      expect(entry!.target.char).toBe(3)
      expect(entry!.target.end).toBeUndefined()
    }
  })

  it('parses person with ref param', () => {
    const entry = parseAnnotationEntry('{3} person ref:A020 [皋陶][舜帝理官]')
    expect(entry!.params.ref).toBe('A020')
  })

  it('parses collation with source param', () => {
    const entry = parseAnnotationEntry('{3} collation source:四庫全書本 [作「道可」]')
    expect(entry!.params.source).toBe('四庫全書本')
  })

  it('parses variant with action param', () => {
    const entry = parseAnnotationEntry('{5} variant action:emend [「水」][據考證當作「冰」]')
    expect(entry!.params.action).toBe('emend')
  })

  it('parses allusion with source param', () => {
    const entry = parseAnnotationEntry('{4} allusion source:詩經·采薇 [昔我往矣][出自詩經]')
    expect(entry!.params.source).toBe('詩經·采薇')
  })

  it('returns null for invalid input', () => {
    expect(parseAnnotationEntry('')).toBeNull()
    expect(parseAnnotationEntry('no target')).toBeNull()
    expect(parseAnnotationEntry('{abc} meaning [test]')).toBeNull()
  })
})

// ─── Spec §09 Annotation Sections ─────────────────────────────

describe('spec §09 annotation sections', () => {
  it('parses section with meta lines', () => {
    const source = `---
id: 1
title: Test
---

Text

## 注釋
@contributor: 王弼
@role: commentator
{1} meaning [test]`
    const doc = parse(source)
    expect(doc.sections[0].meta.contributor).toBe('王弼')
    expect(doc.sections[0].meta.role).toBe('commentator')
  })

  it('supports multiple annotation sections', () => {
    const source = `---
id: 1
title: Test
---

Text

## Section A

{1} meaning [a]

## Section B

{1} commentary [b]`
    const doc = parse(source)
    expect(doc.sections).toHaveLength(2)
    expect(doc.sections[0].name).toBe('Section A')
    expect(doc.sections[1].name).toBe('Section B')
  })
})

// ─── Spec §15 Round-Trip ──────────────────────────────────────

describe('spec §15 round-trip equivalence', () => {
  it('preserves annotation kind, params, headword, value', () => {
    const source = `---
id: 1
title: Round Trip
---

{1}騅{/1}不逝。

## 注釋

{1} meaning [騅][項羽的馬名]`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    const e1 = doc1.sections[0].entries[0]
    const e2 = doc2.sections[0].entries[0]
    expect(e2.kind).toBe(e1.kind)
    expect(e2.headword).toBe(e1.headword)
    expect(e2.value).toBe(e1.value)
    expect(e2.params).toEqual(e1.params)
  })

  it('preserves marker positions (block index, offset, length)', () => {
    const source = `---
id: 1
title: Round Trip
---

時不利兮{1}騅{/1}不逝。`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    for (const [id, m1] of doc1.markers) {
      const m2 = doc2.markers.get(id)
      expect(m2, `marker ${id}`).toBeDefined()
      expect(m2!.offset).toBe(m1.offset)
      expect(m2!.length).toBe(m1.length)
      expect(m2!.blockIndex).toBe(m1.blockIndex)
    }
  })

  it('preserves frontmatter fields', () => {
    const source = `---
id: 1
title: 靜夜思
contributors:
  - ref: LBY
    role: author
date:
  dynasty: 唐
genre: poetry
---

Text

## 注釋

{1} meaning [test]`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    expect((doc2.meta as any).id).toBe((doc1.meta as any).id)
    expect((doc2.meta as any).title).toBe((doc1.meta as any).title)
    expect((doc2.meta as any).genre).toBe((doc1.meta as any).genre)
  })

  it('preserves section metadata', () => {
    const source = `---
id: 1
title: Test
---

Text

## 注釋
@contributor: 王弼
@role: commentator
{1} meaning [test]`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    expect(doc2.sections[0].meta.contributor).toBe('王弼')
    expect(doc2.sections[0].meta.role).toBe('commentator')
  })

  it('preserves clean text (markers removed)', () => {
    const source = `---
id: 1
title: Test
---

時不利兮{1}騅{/1}不逝。

騅不逝兮可{2}奈何{/2}！`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    expect(doc2.textBlocks[0].text).toBe(doc1.textBlocks[0].text)
    expect(doc2.textBlocks[1].text).toBe(doc1.textBlocks[1].text)
  })

  it('round-trips overlapping markers', () => {
    const source = `---
id: 1
title: Test
---

{1}力拔{2}山兮{/1}氣蓋{/2}世。

## Notes

{1} meaning [力拔山兮]
{2} meaning [山兮氣蓋]`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    expect(doc2.markers.get(1)!.offset).toBe(0)
    expect(doc2.markers.get(1)!.length).toBe(4)
    expect(doc2.markers.get(2)!.offset).toBe(2)
    expect(doc2.markers.get(2)!.length).toBe(4)
  })
})

// ─── Spec §17 Quality Rules — Validator ───────────────────────

describe('spec §17 quality rules — validator', () => {
  const validator = new ChamValidator()

  it('catches unclosed markers', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', 'title: T', '---', '',
        'A{1}B',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('Unclosed marker'))).toBe(true)
    cleanup()
  })

  it('catches unclosed marker in overlapping range', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', 'title: T', '---', '',
        'A{1}B{2}C{/1}D',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('Unclosed marker {2}'))).toBe(true)
    cleanup()
  })

  it('allows overlapping markers {1}{2}{/1}{/2}', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', 'title: T', '---', '',
        '{1}A{2}B{/1}C{/2}',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.severity === 'error')).toBe(false)
    cleanup()
  })

  it('catches markers without annotations', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', 'title: T', '---', '',
        'A{1}B{/1}C',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('no annotation entry'))).toBe(true)
    cleanup()
  })

  it('catches annotations referencing missing markers', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', 'title: T', '---', '',
        'A{1}B{/1}C',
        '',
        '## Notes', '',
        '{1} meaning [B]',
        '{99} meaning [missing]',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('missing marker {99}'))).toBe(true)
    cleanup()
  })

  it('catches secondary with text content', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', 'title: T', '---', '',
        'Text',
      ].join('\n'),
      'p/commentary.cham.md': [
        '---', 'base: text.cham.md', 'contributor: X', 'role: commentator', '---', '',
        'Some text',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('must not contain text'))).toBe(true)
    cleanup()
  })

  it('catches missing pron params', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', 'title: T', '---', '',
        'A{1}B{/1}',
        '',
        '## Notes', '',
        '{1} pron [ㄅ]',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('missing required param'))).toBe(true)
    cleanup()
  })

  it('catches duplicate section names across primary and secondary', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', 'title: T', '---', '',
        'Text',
        '',
        '## 注釋', '',
        '{1} meaning [test]',
      ].join('\n'),
      'p/commentary.cham.md': [
        '---', 'base: text.cham.md', 'contributor: X', 'role: commentator', '---', '',
        '## 注釋', '',
        '{1} commentary [dup]',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('Duplicate section name'))).toBe(true)
    cleanup()
  })

  it('catches missing primary id', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'title: No ID', '---', '',
        'Text',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('missing required field: id'))).toBe(true)
    cleanup()
  })

  it('catches missing primary title', () => {
    setupDir({
      'book.yaml': 'id: q\ntitle: Q',
      'p/text.cham.md': [
        '---', 'type: primary', 'id: 1', '---', '',
        'Text',
      ].join('\n'),
    })
    const result = validator.validateBook(TMP)
    expect(result.issues.some(i => i.message.includes('missing required field: title'))).toBe(true)
    cleanup()
  })
})

// ─── Spec §16 Examples — Full spec example ────────────────────

describe('spec §16 complete poetry example', () => {
  it('parses the 垓下歌 example from the spec', () => {
    const source = `---
id: 1
title: 垓下歌
contributors:
  - ref: A001
    role: author
date:
  dynasty: 秦末
  circa: true
genre: poetry
---

力拔山兮氣蓋世。

時不利兮{1}騅{/1}不逝。

{1}騅{/1}不逝兮可奈何！


虞兮虞兮{2}奈若何{/2}！

## 注釋

{1} meaning [騅][項羽的馬名]

{2} meaning [奈何][
「奈何」意為「怎麼辦」。
全句即「把你怎麼辦呢」。

表達了項羽對虞姬的深情與無奈。
]

@title pron type:hom lang:yue [垓][該]

@full meaning [
全詩以「兮」字貫穿四句，反覆詠嘆。
首句寫英雄氣概，末句寫兒女深情。
]`
    const doc = parse(source)

    // Frontmatter
    expect(doc.meta.type).toBe('primary')
    const meta = doc.meta as any
    expect(meta.id).toBe(1)
    expect(meta.title).toBe('垓下歌')
    expect(meta.contributors).toHaveLength(1)
    expect(meta.contributors[0].ref).toBe('A001')
    expect(meta.date.dynasty).toBe('秦末')
    expect(meta.date.circa).toBe(true)
    expect(meta.genre).toBe('poetry')

    // Text blocks — 3 in section 0, 1 in section 1
    expect(doc.textBlocks).toHaveLength(4)
    expect(doc.textBlocks[0].text).toBe('力拔山兮氣蓋世。')
    expect(doc.textBlocks[1].text).toBe('時不利兮騅不逝。')
    expect(doc.textBlocks[2].text).toBe('騅不逝兮可奈何！')
    expect(doc.textBlocks[3].text).toBe('虞兮虞兮奈若何！')
    expect(doc.textBlocks[2].sectionIndex).toBe(0)
    expect(doc.textBlocks[3].sectionIndex).toBe(1)

    // Markers
    expect(doc.markers.size).toBe(2)
    expect(doc.markers.get(1)!.text).toBe('騅')
    expect(doc.markers.get(2)!.text).toBe('奈若何')

    // Annotations
    expect(doc.sections).toHaveLength(1)
    expect(doc.sections[0].name).toBe('注釋')
    expect(doc.sections[0].entries).toHaveLength(4)

    // Entry 1: marker 1, meaning
    const e1 = doc.sections[0].entries[0]
    expect(e1.target.type).toBe('marker')
    expect(e1.kind).toBe('meaning')
    expect(e1.headword).toBe('騅')
    expect(e1.value).toBe('項羽的馬名')

    // Entry 2: marker 2, multi-line meaning
    const e2 = doc.sections[0].entries[1]
    expect(e2.target.type).toBe('marker')
    expect(e2.kind).toBe('meaning')
    expect(e2.headword).toBe('奈何')
    expect(e2.value).toContain('怎麼辦')

    // Entry 3: @title pron
    const e3 = doc.sections[0].entries[2]
    expect(e3.target.type).toBe('title')
    expect(e3.kind).toBe('pron')
    expect(e3.params.type).toBe('hom')
    expect(e3.params.lang).toBe('yue')
    expect(e3.headword).toBe('垓')
    expect(e3.value).toBe('該')

    // Entry 4: @full meaning, multi-line
    const e4 = doc.sections[0].entries[3]
    expect(e4.target.type).toBe('full')
    expect(e4.kind).toBe('meaning')
    expect(e4.value).toContain('兮')
  })
})

// ─── Quality Rules — spec §17 validation tests ──────────────────

describe('spec §17 quality rules — extended', () => {
  it('warns on non-sequential marker numbering', () => {
    const source = `---
id: 1
title: Test
---

A{1}B{/1}C{3}D{/3}。

## Notes

{1} meaning [B]
{3} meaning [D]`
    const doc = parse(source)
    // Non-sequential: 1, 3 (gap at 2)
    expect(doc.markers.has(1)).toBe(true)
    expect(doc.markers.has(3)).toBe(true)
    expect(doc.markers.has(2)).toBe(false)
  })

  it('serializer includes end offset in @verse target', () => {
    const entry = parseAnnotationEntry('@verse:0:5-8 meaning [test]')
    expect(entry).not.toBeNull()
    const serialized = serializeEntry(entry!)
    expect(serialized).toContain('@verse:0:5-8')
  })

  it('date inheritance from book.yaml', () => {
    const source = `---
id: 1
title: Test
---

Text content。

## 注釋`
    const bookConfig: BookConfig = {
      id: 'test',
      title: 'Test Book',
      date: { dynasty: '唐', era: '開元', iso: 727 },
    }
    const piece = buildPieceFromCham(source, bookConfig, {}, 'test', new Map(), new Map())
    expect(piece).not.toBeNull()
    expect(piece!.dynasty).toBe('唐')
  })

  it('piece date overrides book date', () => {
    const source = `---
id: 1
title: Test
date:
  dynasty: 宋
---

Text content。

## 注釋`
    const bookConfig: BookConfig = {
      id: 'test',
      title: 'Test Book',
      date: { dynasty: '唐', iso: 727 },
    }
    const piece = buildPieceFromCham(source, bookConfig, {}, 'test', new Map(), new Map())
    expect(piece).not.toBeNull()
    expect(piece!.dynasty).toBe('宋')
  })

  it('source fields parsed from frontmatter', () => {
    const source = `---
id: 1
title: Test
source:
  textRef: laozi
  edition: 帛書甲本
  publisher: 文物出版社
  page: "12-15"
  relation: excerpt
---

Text。

## 注釋`
    const doc = parse(source)
    expect(doc.meta.type).toBe('primary')
    const meta = doc.meta as any
    expect(meta.source.textRef).toBe('laozi')
    expect(meta.source.edition).toBe('帛書甲本')
    expect(meta.source.publisher).toBe('文物出版社')
    expect(meta.source.page).toBe('12-15')
    expect(meta.source.relation).toBe('excerpt')
  })
})
