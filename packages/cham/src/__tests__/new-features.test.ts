import { describe, it, expect } from 'vitest'
import { parse, splitFrontmatter, parseAnnotationEntry } from '../parser.js'
import { serialize } from '../serializer.js'
import { parseYaml } from '../yaml.js'
import { parseHcnDate, formatHcnDate, resolveEraToDate } from '../date-utils.js'

// ─── Hierarchy ────────────────────────────────────────────────

describe('hierarchy parsing', () => {
  it('parses hierarchy array from frontmatter', () => {
    const source = `---
id: 4
title: 夲議第一
hierarchy:
  - level: 篇
    index: 1
    label: 夲議第一
    parent: 3
date:
  dynasty: 漢
genre: prose
---

Some text

## 注釋

{1} meaning [test]`
    const doc = parse(source)
    const meta = doc.meta as any
    expect(meta.hierarchy).toBeDefined()
    expect(meta.hierarchy).toHaveLength(1)
    expect(meta.hierarchy[0].level).toBe('篇')
    expect(meta.hierarchy[0].index).toBe(1)
    expect(meta.hierarchy[0].label).toBe('夲議第一')
    expect(meta.hierarchy[0].parent).toBe(3)
  })

  it('round-trips hierarchy data', () => {
    const source = `---
id: 4
title: 夲議第一
hierarchy:
  - level: 篇
    index: 1
    parent: 3
genre: prose
---

Text

## 注釋

{1} meaning [test]`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)
    const m1 = doc1.meta as any
    const m2 = doc2.meta as any
    expect(m2.hierarchy).toEqual(m1.hierarchy)
  })

  it('handles document without hierarchy', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

Text`
    const doc = parse(source)
    const meta = doc.meta as any
    expect(meta.hierarchy).toBeUndefined()
  })
})

// ─── Speaker Annotations ──────────────────────────────────────

describe('speaker annotation parsing', () => {
  it('parses speaker annotation', () => {
    const entry = parseAnnotationEntry('{1} speaker role:official [大夫]')
    expect(entry).not.toBeNull()
    expect(entry!.kind).toBe('speaker')
    expect(entry!.value).toBe('大夫')
    expect(entry!.params.role).toBe('official')
  })

  it('parses speaker with ref', () => {
    const entry = parseAnnotationEntry('{3} speaker ref:A050 role:scholar [文學]')
    expect(entry).not.toBeNull()
    expect(entry!.kind).toBe('speaker')
    expect(entry!.params.ref).toBe('A050')
  })

  it('round-trips speaker annotations', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

{1}大夫曰{/1} some text

## 注釋

{1} speaker role:official [大夫]`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)
    expect(doc2.sections[0].entries[0].kind).toBe('speaker')
    expect(doc2.sections[0].entries[0].value).toBe('大夫')
    expect(doc2.sections[0].entries[0].params.role).toBe('official')
  })
})

// ─── SKQS Variant Annotations ─────────────────────────────────

describe('skqs-variant annotation parsing', () => {
  it('parses skqs-variant annotation', () => {
    const entry = parseAnnotationEntry('{1} skqs-variant image:skqs/char-01.png unicode:U+8F38 [譖]')
    expect(entry).not.toBeNull()
    expect(entry!.kind).toBe('skqs-variant')
    expect(entry!.params.image).toBe('skqs/char-01.png')
    expect(entry!.params.unicode).toBe('U+8F38')
    expect(entry!.value).toBe('譖')
  })
})

// ─── Date Utilities ───────────────────────────────────────────

describe('h-CN date parsing', () => {
  it('parses type 2 date code (era name year)', () => {
    const result = parseHcnDate('h-CN.2.漢.建元.6')
    expect(result).not.toBeNull()
    expect(result!.type).toBe(2)
    expect(result!.dynasty).toBe('漢')
    expect(result!.era).toBe('建元')
    expect(result!.year).toBe(6)
  })

  it('parses type 4 date code (sexagenary)', () => {
    const result = parseHcnDate('h-CN.4.甲子')
    expect(result).not.toBeNull()
    expect(result!.type).toBe(4)
    expect(result!.cycle).toBe('甲子')
  })

  it('parses type 1 date code (regnal year)', () => {
    const result = parseHcnDate('h-CN.1.周.武王.1')
    expect(result).not.toBeNull()
    expect(result!.type).toBe(1)
    expect(result!.dynasty).toBe('周')
    expect(result!.ruler).toBe('武王')
    expect(result!.year).toBe(1)
  })

  it('parses type 3 date code (ROC year)', () => {
    const result = parseHcnDate('h-CN.3.15')
    expect(result).not.toBeNull()
    expect(result!.type).toBe(3)
    expect(result!.year).toBe(15)
  })

  it('returns null for invalid prefix', () => {
    expect(parseHcnDate('invalid')).toBeNull()
    expect(parseHcnDate('')).toBeNull()
  })

  it('round-trips h-CN date codes', () => {
    const code = 'h-CN.2.漢.建元.6'
    const parsed = parseHcnDate(code)
    expect(formatHcnDate(parsed!)).toBe(code)
  })
})

describe('era resolution', () => {
  it('resolves era year to ISO date', () => {
    const eras = [
      { dynasty: '漢', era: '建元', label: '建元', start: -140 },
      { dynasty: '唐', era: '開元', label: '開元', start: 713 },
    ]
    expect(resolveEraToDate('建元', 6, eras)).toBe(-135)
    expect(resolveEraToDate('開元', 15, eras)).toBe(727)
  })

  it('returns undefined for unknown era', () => {
    expect(resolveEraToDate('nonexistent', 1, [])).toBeUndefined()
  })
})

// ─── Extended PieceSource ─────────────────────────────────────

describe('extended source with juan and section', () => {
  it('parses source.range with juan and section', () => {
    const source = `---
id: 1
title: Test
genre: prose
source:
  textRef: yantielun
  relation: section
  range:
    chapter: 夲議第一
    juan: 1
    section: 第一
---

Text`
    const doc = parse(source)
    const meta = doc.meta as any
    expect(meta.source.range.juan).toBe(1)
    expect(meta.source.range.section).toBe('第一')
    expect(meta.source.range.chapter).toBe('夲議第一')
  })
})

// ─── YAML Deep Nesting ────────────────────────────────────────

describe('YAML deep nesting support', () => {
  it('parses hierarchy array of objects', () => {
    const yaml = `hierarchy:
  - level: 篇
    index: 1
    label: 夲議第一
    parent: 3
  - level: 篇
    index: 2
    label: 力耕第二
    parent: 3`
    const result = parseYaml(yaml)
    expect(result.hierarchy).toBeDefined()
    const arr = result.hierarchy as any[]
    expect(arr).toHaveLength(2)
    expect(arr[0].level).toBe('篇')
    expect(arr[0].index).toBe(1)
    expect(arr[0].label).toBe('夲議第一')
    expect(arr[0].parent).toBe(3)
    expect(arr[1].level).toBe('篇')
    expect(arr[1].index).toBe(2)
  })

  it('parses nested source.range objects', () => {
    const yaml = `source:
  textRef: lunyu
  relation: excerpt
  range:
    chapter: 里仁第四
    juan: 4`
    const result = parseYaml(yaml)
    const src = result.source as any
    expect(src.textRef).toBe('lunyu')
    expect(src.range).toBeDefined()
    expect(src.range.chapter).toBe('里仁第四')
    expect(src.range.juan).toBe(4)
  })
})

// ─── Text Block Line Numbers ──────────────────────────────────

describe('text block line numbers', () => {
  it('tracks line numbers in text blocks', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

Line one

Line two

Line three`
    const doc = parse(source)
    expect(doc.textBlocks.length).toBe(3)
    expect(doc.textBlocks[0].lineStart).toBeDefined()
    expect(doc.textBlocks[0].lineEnd).toBeDefined()
  })
})

// ─── Commentary Nature Values ─────────────────────────────────

describe('commentary nature values', () => {
  it('parses classical nature in section meta', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

Text

## 王弼註
@contributor: A010
@role: annotator
@nature: zhu

{1} commentary [test]`
    const doc = parse(source)
    expect(doc.sections[0].meta.nature).toBe('zhu')
  })

  it('parses zhengyi nature', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

Text

## 注疏
@nature: zhengyi

{1} commentary [test]`
    const doc = parse(source)
    expect(doc.sections[0].meta.nature).toBe('zhengyi')
  })
})

// ─── Text Sections (within-piece hierarchy) ───────────────────

describe('text section parsing', () => {
  it('parses ### section headers in text body', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

### 章:第一章

Text of chapter one.

### 章:第二章

Text of chapter two.

## 注釋

{1} meaning [test]`
    const doc = parse(source)
    expect(doc.textSections).toBeDefined()
    expect(doc.textSections!.length).toBe(2)
    expect(doc.textSections![0].level).toBe('章')
    expect(doc.textSections![0].label).toBe('第一章')
    expect(doc.textSections![0].index).toBe(1)
    expect(doc.textSections![1].level).toBe('章')
    expect(doc.textSections![1].label).toBe('第二章')
    expect(doc.textSections![1].index).toBe(2)
  })

  it('assigns textSectionIndex to text blocks', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

Intro text.

### 章:成均圖

Chapter text.

More chapter text.

## 注釋

{1} meaning [test]`
    const doc = parse(source)
    const blocks = doc.textBlocks
    expect(blocks.length).toBe(3)
    expect(blocks[0].textSectionIndex).toBeUndefined()
    expect(blocks[1].textSectionIndex).toBe(0)
    expect(blocks[2].textSectionIndex).toBe(0)
  })

  it('sets correct startBlock and endBlock', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

### 章:A

Block A1.

Block A2.

### 章:B

Block B1.

## 注釋

{1} meaning [test]`
    const doc = parse(source)
    const sections = doc.textSections!
    expect(sections[0].startBlock).toBe(0)
    expect(sections[0].endBlock).toBe(2)
    expect(sections[1].startBlock).toBe(2)
    expect(sections[1].endBlock).toBe(3)
  })

  it('parses section header with full-width colon', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

### 章：第一章

Text.

## 注釋

{1} meaning [test]`
    const doc = parse(source)
    expect(doc.textSections![0].label).toBe('第一章')
  })

  it('parses section header without label', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

### 章

Text.

## 注釋

{1} meaning [test]`
    const doc = parse(source)
    expect(doc.textSections![0].level).toBe('章')
    expect(doc.textSections![0].label).toBeUndefined()
  })

  it('returns empty array when no text sections', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

Just text.

## 注釋

{1} meaning [test]`
    const doc = parse(source)
    expect(doc.textSections).toEqual([])
  })

  it('round-trips text sections', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

### 章:成均圖

Chapter text.

### 章:明堂

More text.

## 注釋

{1} meaning [test]`
    const doc1 = parse(source)
    const serialized = serialize(doc1)
    const doc2 = parse(serialized)

    expect(doc2.textSections!.length).toBe(2)
    expect(doc2.textSections![0].level).toBe('章')
    expect(doc2.textSections![0].label).toBe('成均圖')
    expect(doc2.textSections![1].level).toBe('章')
    expect(doc2.textSections![1].label).toBe('明堂')
    expect(doc2.textBlocks.length).toBe(doc1.textBlocks.length)
    expect(doc2.textBlocks[0].text).toBe(doc1.textBlocks[0].text)
    expect(doc2.textBlocks[1].text).toBe(doc1.textBlocks[1].text)
  })

  it('preserves markers within text sections', () => {
    const source = `---
id: 1
title: Test
genre: prose
---

### 章:第一章

{1}Marked text{/1} here.

## 注釋

{1} meaning [test]`
    const doc = parse(source)
    expect(doc.markers.has(1)).toBe(true)
    expect(doc.markers.get(1)!.text).toBe('Marked text')
    expect(doc.textSections!.length).toBe(1)
  })
})
