import { describe, it, expect } from 'vitest'
import { LexiconApplier } from '../lexicon.js'
import { parse } from '../parser.js'
import type { LexiconEntry, OutputAnnotation } from '../types.js'

const SAMPLE_SOURCE = `---
id: 1
title: 測試
---
床前明月光

## 注釋

{1} meaning [明月]{月光}`

describe('LexiconApplier', () => {
  const entries: LexiconEntry[] = [
    { char: '明', readings: [{ lang: 'cmn', value: 'míng' }] },
    { char: '月', readings: [{ lang: 'cmn', value: 'yuè' }] },
    { char: '光', readings: [{ lang: 'cmn', value: 'guāng' }] },
  ]

  it('applies lexicon readings to uncovered positions', () => {
    const doc = parse(SAMPLE_SOURCE)
    const applier = new LexiconApplier({ entries })
    const existingAnnotations: OutputAnnotation[] = [{
      id: '1-1',
      range: { type: 'range', scope: 'verse', verseIndex: 0, start: 2, end: 4 },
      kind: 'semantic',
      text: '月光',
      source: 'cham',
    }]

    const annotations = applier.apply(doc, existingAnnotations)

    // "明" at offset 2 is covered by existing annotation (start=2, end=4)
    // "月" at offset 3 is covered
    // "光" at offset 4 is NOT covered → should get lexicon annotation
    const lightAnn = annotations.find(a => a.text === 'guāng')
    expect(lightAnn).toBeDefined()
    expect(lightAnn!.range.start).toBe(4)
  })

  it('skips positions already covered', () => {
    const doc = parse(SAMPLE_SOURCE)
    const applier = new LexiconApplier({ entries })
    const existingAnnotations: OutputAnnotation[] = [{
      id: '1-1',
      range: { type: 'range', scope: 'verse', verseIndex: 0, start: 0, end: 5 },
      kind: 'semantic',
      text: '全部',
      source: 'cham',
    }]

    const annotations = applier.apply(doc, existingAnnotations)
    expect(annotations).toHaveLength(0)
  })

  it('uses default language for readings', () => {
    const doc = parse(SAMPLE_SOURCE)
    const multiEntries: LexiconEntry[] = [
      {
        char: '床',
        readings: [
          { lang: 'cmn', value: 'chuáng' },
          { lang: 'yue', value: 'cong4' },
        ],
      },
    ]
    const applier = new LexiconApplier({ entries: multiEntries, defaultLang: 'yue' })
    const annotations = applier.apply(doc, [])
    expect(annotations[0]?.lang).toBe('yue')
    expect(annotations[0]?.text).toBe('cong4')
  })

  it('returns empty for no matching chars', () => {
    const doc = parse(SAMPLE_SOURCE)
    const applier = new LexiconApplier({ entries: [] })
    const annotations = applier.apply(doc, [])
    expect(annotations).toHaveLength(0)
  })
})
