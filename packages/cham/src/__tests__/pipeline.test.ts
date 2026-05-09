import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import {
  mapKind, entryToRange, buildAnnotations, buildAnnotationsFromLayer,
  getHeadword, buildAnnotationsText, buildAnnotationLayers,
  cleanHardWraps, splitMdFrontmatter, parseProseSections, parseCommentaryLayers,
  buildPieceFromCham, buildBookMeta, buildBookData, detectScale,
  buildCrossRefs, buildLibraryIndex, buildAuthorsJson, buildDynastiesJson,
} from '../pipeline.js'
import type { OutputAnnotation, BookConfig, AuthorRecord } from '../types.js'

// ─── Fixtures ──────────────────────────────────────────────────

const CHAM_SOURCE = `---
id: 1
title: 靜夜思
contributors:
  - ref: LBY
    role: author
date:
  dynasty: 唐
genre: poetry
---
床前{1}明月{/1}光，疑是地上霜。舉頭望{2}明月{/2}，低頭思故鄉。

## 注釋
{1} meaning [明月][明亮的月光]
{2} meaning [望][抬頭看]`

const BOOK_CONFIG: BookConfig = {
  id: 'test-book',
  title: '測試詩集',
  genre: 'poetry',
  contributors: [{ ref: 'LBY', role: 'author' }],
}

const AUTHORS: Record<string, AuthorRecord> = {
  LBY: { name: '李白', dynasty: '唐' },
}

// ─── Kind Mapping ──────────────────────────────────────────────

describe('mapKind', () => {
  it('maps pron to pronunciation', () => {
    expect(mapKind('pron')).toBe('pronunciation')
  })

  it('maps meaning to semantic', () => {
    expect(mapKind('meaning')).toBe('semantic')
  })

  it('passes through other kinds', () => {
    expect(mapKind('commentary')).toBe('commentary')
    expect(mapKind('fanqie')).toBe('fanqie')
  })
})

// ─── Entry to Range ────────────────────────────────────────────

describe('entryToRange', () => {
  it('maps title target to title range', () => {
    const doc = parse(CHAM_SOURCE)
    const entry = doc.sections[0].entries[0]
    // Manually set target type for testing
    const titleEntry = { ...entry, target: { type: 'title' as const } }
    const range = entryToRange(titleEntry, doc)
    expect(range).toEqual({ type: 'range', scope: 'title', start: 0, end: 1 })
  })

  it('maps full target to full range', () => {
    const doc = parse(CHAM_SOURCE)
    const entry = doc.sections[0].entries[0]
    const fullEntry = { ...entry, target: { type: 'full' as const } }
    const range = entryToRange(fullEntry, doc)
    expect(range).toEqual({ type: 'range', scope: 'title', start: 0, end: 0 })
  })

  it('maps marker target to verse range', () => {
    const doc = parse(CHAM_SOURCE)
    const entry = doc.sections[0].entries[0]
    const range = entryToRange(entry, doc)
    expect(range!.scope).toBe('verse')
    expect(range!.start).toBe(2)
    expect(range!.end).toBe(4)
  })

  it('maps verse target to verse range', () => {
    const doc = parse(CHAM_SOURCE)
    const verseEntry = {
      target: { type: 'verse' as const, line: 0, char: 3 },
      kind: 'meaning' as const,
      params: {},
      value: 'test',
    }
    const range = entryToRange(verseEntry, doc)
    expect(range).toEqual({ type: 'range', scope: 'verse', verseIndex: 0, start: 3, end: 3 })
  })

  it('returns fallback for missing marker', () => {
    const doc = parse(CHAM_SOURCE)
    const entry = {
      target: { type: 'marker' as const, markerId: 999 },
      kind: 'meaning' as const,
      params: {},
      value: 'test',
    }
    const range = entryToRange(entry, doc)
    expect(range).toEqual({ type: 'range', scope: 'title', start: 0, end: 1 })
  })
})

// ─── Annotation Building ───────────────────────────────────────

describe('buildAnnotations', () => {
  it('builds annotations from document', () => {
    const doc = parse(CHAM_SOURCE)
    const annotations = buildAnnotations(doc, 1)
    expect(annotations).toHaveLength(2)
    expect(annotations[0].id).toBe('1-1')
    expect(annotations[0].kind).toBe('semantic')
    expect(annotations[0].text).toBe('明亮的月光')
  })

  it('uses piece ID in annotation IDs', () => {
    const doc = parse(CHAM_SOURCE)
    const annotations = buildAnnotations(doc, 42)
    expect(annotations[0].id).toBe('42-1')
  })

  it('trims annotation values', () => {
    const source = `---
id: 1
title: T
---
Text

## Notes
{1} meaning [  padded  ]`
    const doc = parse(source)
    const annotations = buildAnnotations(doc, 1)
    expect(annotations[0].text).toBe('padded')
  })
})

describe('buildAnnotationsFromLayer', () => {
  it('builds layer annotations with primary doc markers', () => {
    const primary = parse(CHAM_SOURCE)
    const layerSource = `---
base: text.cham.md
contributor: 王弼
role: commentator
---
## 注釋
{1} commentary [此句極寫月光之明]`
    const layer = parse(layerSource)
    const annotations = buildAnnotationsFromLayer(layer, primary, 'wangbi')
    expect(annotations).toHaveLength(1)
    expect(annotations[0].id).toBe('wangbi-1')
    expect(annotations[0].kind).toBe('commentary')
  })
})

// ─── Headword ──────────────────────────────────────────────────

describe('getHeadword', () => {
  it('extracts headword from verse range', () => {
    const doc = parse(CHAM_SOURCE)
    const ann: OutputAnnotation = {
      id: '1-1',
      range: { type: 'range', scope: 'verse', verseIndex: 0, start: 2, end: 4 },
      kind: 'semantic', text: '月光', source: 'cham',
    }
    expect(getHeadword(doc, ann)).toBe('明月')
  })

  it('returns empty for out-of-range verse', () => {
    const doc = parse(CHAM_SOURCE)
    const ann: OutputAnnotation = {
      id: '1-1',
      range: { type: 'range', scope: 'verse', verseIndex: 99, start: 0, end: 1 },
      kind: 'semantic', text: 'x', source: 'cham',
    }
    expect(getHeadword(doc, ann)).toBe('')
  })
})

// ─── Annotations Text ──────────────────────────────────────────

describe('buildAnnotationsText', () => {
  it('groups pronunciations and meanings by position', () => {
    const doc = parse(CHAM_SOURCE)
    const annotations = buildAnnotations(doc, 1)
    const text = buildAnnotationsText(doc, annotations)
    expect(text).toContain('明月')
    expect(text).toContain('明亮的月光')
  })

  it('returns empty for no annotations', () => {
    const doc = parse(CHAM_SOURCE)
    expect(buildAnnotationsText(doc, [])).toBe('')
  })
})

// ─── Annotation Layers ─────────────────────────────────────────

describe('buildAnnotationLayers', () => {
  it('returns empty when no layers configured and no annotations', () => {
    expect(buildAnnotationLayers({}, BOOK_CONFIG)).toHaveLength(0)
  })

  it('creates default layer when book has layers configured', () => {
    const config: BookConfig = {
      ...BOOK_CONFIG,
      layers: [{ id: 'commentary', label: '注', contributor: 'WB' }],
    }
    const layers = buildAnnotationLayers({}, config)
    expect(layers).toHaveLength(2)
    expect(layers[0].id).toBe('default')
    expect(layers[1].id).toBe('commentary')
  })

  it('assigns annotations to matching layers', () => {
    const config: BookConfig = {
      ...BOOK_CONFIG,
      layers: [{ id: 'wangbi', label: '王注', contributor: 'WB' }],
    }
    const layerAnns: Record<string, OutputAnnotation[]> = {
      wangbi: [{ id: 'w1', range: { type: 'range' as const, scope: 'title', start: 0, end: 1 }, kind: 'commentary', text: 'note', source: 'cham' }],
    }
    const layers = buildAnnotationLayers(layerAnns, config)
    expect(layers[1].annotations).toHaveLength(1)
  })
})

// ─── Markdown Helpers ──────────────────────────────────────────

describe('cleanHardWraps', () => {
  it('removes hard wraps within paragraphs', () => {
    expect(cleanHardWraps('line1\nline2\n\npara2')).toBe('line1line2\n\npara2')
  })
})

describe('splitMdFrontmatter', () => {
  it('extracts frontmatter and body', () => {
    const { frontmatter, body } = splitMdFrontmatter('---\ntitle: Test\n---\nBody text')
    expect(frontmatter?.title).toBe('Test')
    expect(body).toBe('Body text')
  })

  it('returns null frontmatter when no delimiters', () => {
    const { frontmatter, body } = splitMdFrontmatter('just body')
    expect(frontmatter).toBeNull()
    expect(body).toBe('just body')
  })

  it('strips BOM', () => {
    const { frontmatter } = splitMdFrontmatter('﻿---\ntitle: T\n---\nbody')
    expect(frontmatter?.title).toBe('T')
  })
})

// ─── Prose Sections ────────────────────────────────────────────

describe('parseProseSections', () => {
  it('parses builtin prose files', () => {
    const files = new Map<string, string>()
    files.set('author-brief.md', 'Author bio content')
    files.set('background.md', 'Background content')

    const { sections, structuredSections } = parseProseSections(files)
    expect(sections.author_bio).toBe('Author bio content')
    expect(sections.background).toBe('Background content')
    expect(structuredSections).toHaveLength(2)
    expect(structuredSections[0].key).toBe('author_bio')
    expect(structuredSections[1].key).toBe('background')
  })

  it('parses custom prose files', () => {
    const files = new Map<string, string>()
    files.set('custom-activity.md', '---\ntitle: 活動\norder: 3\n---\nContent')

    const { sections, structuredSections } = parseProseSections(files)
    expect(sections.custom_activity).toBe('Content')
    expect(structuredSections[0].title).toBe('活動')
  })

  it('skips cham files and underscored files', () => {
    const files = new Map<string, string>()
    files.set('text.cham.md', 'cham content')
    files.set('_draft.md', 'draft')
    files.set('random.md', 'not builtin')

    const { sections } = parseProseSections(files)
    expect(Object.keys(sections)).toHaveLength(0)
  })

  it('sorts by order', () => {
    const files = new Map<string, string>()
    files.set('analysis.md', '---\norder: 3\n---\nA')
    files.set('author-brief.md', 'B')

    const { structuredSections } = parseProseSections(files)
    expect(structuredSections[0].key).toBe('author_bio')
    expect(structuredSections[1].key).toBe('analysis')
  })

  it('cleans hard wraps in prose body', () => {
    const files = new Map<string, string>()
    files.set('analysis.md', 'Line1\nLine2\n\nPara2')

    const { sections } = parseProseSections(files)
    expect(sections.analysis).toBe('Line1Line2\n\nPara2')
  })
})

// ─── Commentary Layers ─────────────────────────────────────────

describe('parseCommentaryLayers', () => {
  it('parses layer files into annotations', () => {
    const primary = parse(CHAM_SOURCE)
    const layerFiles = new Map<string, string>()
    layerFiles.set('wangbi.cham.md', `---
base: text.cham.md
contributor: 王弼
role: commentator
---
## 注釋
{1} commentary [此句極寫月光之明]`)

    const layers = parseCommentaryLayers(layerFiles, primary)
    expect(layers.wangbi).toHaveLength(1)
    expect(layers.wangbi[0].text).toBe('此句極寫月光之明')
  })

  it('skips non-secondary files', () => {
    const primary = parse(CHAM_SOURCE)
    const files = new Map<string, string>()
    files.set('text.cham.md', CHAM_SOURCE)

    const layers = parseCommentaryLayers(files, primary)
    expect(Object.keys(layers)).toHaveLength(0)
  })
})

// ─── buildPieceFromCham ────────────────────────────────────────

describe('buildPieceFromCham', () => {
  it('builds a complete output piece', () => {
    const proseFiles = new Map<string, string>()
    proseFiles.set('author-brief.md', '李白，唐代詩人。')
    const layerFiles = new Map<string, string>()

    const piece = buildPieceFromCham(CHAM_SOURCE, BOOK_CONFIG, AUTHORS, 'test-book', proseFiles, layerFiles)

    expect(piece).not.toBeNull()
    expect(piece!.bookId).toBe('test-book')
    expect(piece!.num).toBe(1)
    expect(piece!.title).toBe('靜夜思')
    expect(piece!.author).toBe('李白')
    expect(piece!.authorId).toBe('LBY')
    expect(piece!.dynasty).toBe('唐')
    expect(piece!.verses).toHaveLength(1)
    expect(piece!.annotations).toHaveLength(2)
    expect(piece!.sections.author_bio).toBe('李白，唐代詩人。')
  })

  it('returns null for secondary documents', () => {
    const secondary = `---
base: text.cham.md
---
## Notes
{1} meaning [test]`
    const piece = buildPieceFromCham(secondary, BOOK_CONFIG, AUTHORS, 'x', new Map(), new Map())
    expect(piece).toBeNull()
  })

  it('falls back to book config contributors', () => {
    const source = `---
id: 2
title: No Author
---
Text`
    const piece = buildPieceFromCham(source, BOOK_CONFIG, AUTHORS, 'test', new Map(), new Map())
    expect(piece!.authorId).toBe('LBY')
  })

  it('falls back to book config genre', () => {
    const source = `---
id: 3
title: No Genre
---
Text`
    const piece = buildPieceFromCham(source, BOOK_CONFIG, AUTHORS, 'test', new Map(), new Map())
    expect(piece!.genre).toBe('poetry')
  })

  it('includes layers when present', () => {
    const layerFiles = new Map<string, string>()
    layerFiles.set('wangbi.cham.md', `---
base: text.cham.md
contributor: 王弼
role: commentator
---
## 注釋
{1} commentary [note]`)

    const config: BookConfig = {
      ...BOOK_CONFIG,
      layers: [{ id: 'wangbi', label: '王注', contributor: 'WB' }],
    }
    const piece = buildPieceFromCham(CHAM_SOURCE, config, AUTHORS, 'test', new Map(), layerFiles)
    expect(piece!.layers).toBeDefined()
    expect(piece!.layers!.wangbi).toHaveLength(1)
    expect(piece!.annotationLayers).toHaveLength(2)
  })
})

// ─── Book & Library ────────────────────────────────────────────

describe('buildBookMeta', () => {
  it('builds book metadata', () => {
    const meta = buildBookMeta(BOOK_CONFIG, 10)
    expect(meta.id).toBe('test-book')
    expect(meta.title).toBe('測試詩集')
    expect(meta.count).toBe(10)
  })
})

describe('buildBookData', () => {
  it('combines meta and pieces', () => {
    const pieces = [{ bookId: 'x', num: 1, title: 'T', author: 'A', authorId: 'a', dynasty: '', genre: 'poetry', verses: [], sections: {}, annotations: [] }]
    const data = buildBookData(BOOK_CONFIG, pieces as any)
    expect(data.meta.count).toBe(1)
    expect(data.pieces).toHaveLength(1)
  })
})

describe('detectScale', () => {
  it('detects single-piece', () => {
    expect(detectScale(0)).toBe('single-piece')
    expect(detectScale(1, 1)).toBe('single-piece')
  })

  it('detects single-book', () => {
    expect(detectScale(1, 5)).toBe('single-book')
  })

  it('detects library', () => {
    expect(detectScale(3)).toBe('library')
  })
})

describe('buildCrossRefs', () => {
  it('builds cross refs from pieces with sources', () => {
    const pieces = [{
      bookId: 'focused', num: 1, title: '', author: '', authorId: '', dynasty: '',
      genre: 'poetry', verses: [], sections: {}, annotations: [],
      source: { textRef: 'full', pieceRef: 5, relation: 'excerpt' },
    }]
    const refs = buildCrossRefs(pieces as any)
    expect(refs).toHaveLength(1)
    expect(refs[0].focusedBookId).toBe('focused')
    expect(refs[0].fullBookId).toBe('full')
  })

  it('skips standalone and missing textRef', () => {
    const pieces = [
      { source: { relation: 'standalone' } },
      { source: { relation: 'excerpt' } },
      {},
    ]
    expect(buildCrossRefs(pieces as any)).toHaveLength(0)
  })
})

describe('buildLibraryIndex', () => {
  it('builds a library index', () => {
    const meta = buildBookMeta(BOOK_CONFIG, 2)
    const pieces = [
      { bookId: 'test-book', num: 1, title: '', author: '', authorId: '', dynasty: '', genre: 'poetry', verses: [], sections: {}, annotations: [] },
      { bookId: 'test-book', num: 2, title: '', author: '', authorId: '', dynasty: '', genre: 'poetry', verses: [], sections: {}, annotations: [] },
    ]
    const index = buildLibraryIndex([meta], pieces as any)
    expect(index.books).toHaveLength(1)
    expect(index.crossRefs).toHaveLength(0)
  })
})

describe('buildAuthorsJson', () => {
  it('builds author JSON-LD', () => {
    const authors: Record<string, AuthorRecord> = {
      LBY: { name: '李白', dynasty: '唐' },
    }
    const pieces = [{ authorId: 'LBY' }]
    const json = buildAuthorsJson(authors, pieces as any)
    expect(json).toHaveLength(1)
    expect(json[0].name).toBe('李白')
    expect(json[0].poemCount).toBe(1)
  })
})

describe('buildDynastiesJson', () => {
  it('builds dynasty JSON-LD from pieces', () => {
    const pieces = [
      { dynasty: '唐', author: '李白', bookId: 'x', num: 1, title: '', authorId: '', genre: 'poetry', verses: [], sections: {}, annotations: [] },
      { dynasty: '唐', author: '杜甫', bookId: 'x', num: 2, title: '', authorId: '', genre: 'poetry', verses: [], sections: {}, annotations: [] },
    ]
    const json = buildDynastiesJson(pieces as any)
    expect(json['唐']).toBeDefined()
    expect(json['唐'].poemCount).toBe(2)
    expect(json['唐'].authors).toEqual(['李白', '杜甫'])
  })
})
