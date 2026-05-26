import { describe, it, expect } from 'vitest'
import { ChamValidator } from '../validator.js'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

const TMP = join(import.meta.dirname, '__tmp_validator__')

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

const VALID_BOOK = {
  'book.yaml': [
    'id: test-book',
    'title: 測試詩集',
    'genre: poetry',
  ].join('\n'),
  'piece1/text.cham.md': [
    '---',
    'type: primary',
    'id: 1',
    'title: 第一首',
    '---',
    '',
    '床前{1}明月{/1}光，',
    '',
    '## 注釋',
    '',
    '{1} meaning [月光]{明亮的月光}',
  ].join('\n'),
}

const MISSING_ID_BOOK = {
  'book.yaml': [
    'id: no-id',
    'title: No ID',
  ].join('\n'),
  'piece1/text.cham.md': [
    '---',
    'type: primary',
    'title: 缺少ID',
    '---',
    '',
    '文本',
  ].join('\n'),
}

const INTERLEAVED_MARKERS = {
  'book.yaml': 'id: interleave\ntitle: Test',
  'p/text.cham.md': [
    '---',
    'type: primary',
    'id: 1',
    'title: Interleaved',
    '---',
    '',
    'A{1}B{2}C{/1}D{/2}',
  ].join('\n'),
}

const UNCLOSED_MARKER = {
  'book.yaml': 'id: unclosed\ntitle: Test',
  'p/text.cham.md': [
    '---',
    'type: primary',
    'id: 1',
    'title: Unclosed',
    '---',
    '',
    'A{1}B',
  ].join('\n'),
}

const SECONDARY_WITH_TEXT = {
  'book.yaml': 'id: sectext\ntitle: Test',
  'p/text.cham.md': [
    '---',
    'type: primary',
    'id: 1',
    'title: Primary',
    '---',
    '',
    'Text',
  ].join('\n'),
  'p/commentary.cham.md': [
    '---',
    'base: text.cham.md',
    'contributor: X',
    'role: commentator',
    '---',
    '',
    'Some text content here',
  ].join('\n'),
}

const DUPLICATE_SECTIONS = {
  'book.yaml': 'id: dupsect\ntitle: Test',
  'p/text.cham.md': [
    '---',
    'type: primary',
    'id: 1',
    'title: Primary',
    '---',
    '',
    'Text',
    '',
    '## 注釋',
    '',
    '{1} meaning [test]',
  ].join('\n'),
  'p/commentary.cham.md': [
    '---',
    'base: text.cham.md',
    'contributor: X',
    'role: commentator',
    '---',
    '',
    '## 注釋',
    '',
    '{1} commentary [dup]',
  ].join('\n'),
}

describe('ChamValidator', () => {
  const validator = new ChamValidator()

  describe('validateFile', () => {
    it('validates a correct file', () => {
      setupDir({ 'test.cham.md': VALID_BOOK['piece1/text.cham.md'] })
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      expect(result.valid).toBe(true)
      cleanup()
    })

    it('catches missing required id', () => {
      setupDir({ 'test.cham.md': MISSING_ID_BOOK['piece1/text.cham.md'] })
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      const idError = result.issues.find(i => i.message.includes('missing required field: id'))
      expect(idError).toBeDefined()
      cleanup()
    })

    it('catches missing pron params', () => {
      setupDir({
        'test.cham.md': [
          '---',
          'type: primary',
          'id: 1',
          'title: Test',
          '---',
          '',
          'A{1}B{/1}',
          '',
          '## Notes',
          '',
          '{1} pron [ㄅ]',
        ].join('\n'),
      })
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      const paramError = result.issues.find(i => i.message.includes('missing required param'))
      expect(paramError).toBeDefined()
      cleanup()
    })

    it('accepts valid pron params', () => {
      setupDir({
        'test.cham.md': [
          '---',
          'type: primary',
          'id: 1',
          'title: Test',
          '---',
          '',
          'A{1}B{/1}',
          '',
          '## Notes',
          '',
          '{1} pron type:bopomofo lang:cmn [ㄅ]',
        ].join('\n'),
      })
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      const paramError = result.issues.find(i => i.message.includes('missing required param'))
      expect(paramError).toBeUndefined()
      cleanup()
    })

    it('catches missing pron params', () => {
      setupDir({
        'test.cham.md': [
          '---',
          'type: primary',
          'id: 1',
          'title: Test',
          '---',
          '',
          'A{1}B{/1}',
          '',
          '## Notes',
          '',
          '{1} pron [ㄅ]',
        ].join('\n'),
      })
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      const paramError = result.issues.find(i => i.message.includes('missing required param'))
      expect(paramError).toBeDefined()
      cleanup()
    })

    it('accepts see-also kind', () => {
      setupDir({
        'test.cham.md': [
          '---',
          'type: primary',
          'id: 1',
          'title: Test',
          '---',
          '',
          'A{1}B{/1}',
          '',
          '## Notes',
          '',
          '{1} see-also [related text]',
        ].join('\n'),
      })
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      const kindError = result.issues.find(i => i.message.includes('Unknown annotation kind'))
      expect(kindError).toBeUndefined()
      cleanup()
    })

    it('accepts variant with action param', () => {
      setupDir({
        'test.cham.md': [
          '---',
          'type: primary',
          'id: 1',
          'title: Test',
          '---',
          '',
          'A{1}B{/1}',
          '',
          '## Notes',
          '',
          '{1} variant action:emend [「水」][據考證當作「冰」]',
        ].join('\n'),
      })
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      const paramError = result.issues.find(i => i.message.includes('missing required param'))
      expect(paramError).toBeUndefined()
      cleanup()
    })

    it('accepts allusion with source param', () => {
      setupDir({
        'test.cham.md': [
          '---',
          'type: primary',
          'id: 1',
          'title: Test',
          '---',
          '',
          'A{1}B{/1}',
          '',
          '## Notes',
          '',
          '{1} allusion source:詩經 [昔我往矣][出自詩經]',
        ].join('\n'),
      })
      const result = validator.validateFile(join(TMP, 'test.cham.md'))
      expect(result.valid).toBe(true)
      cleanup()
    })
  })

  describe('validateBook', () => {
    it('validates a correct book', () => {
      setupDir(VALID_BOOK)
      const result = validator.validateBook(TMP)
      expect(result.valid).toBe(true)
      cleanup()
    })

    it('catches missing book.yaml', () => {
      setupDir({ 'piece1/text.cham.md': VALID_BOOK['piece1/text.cham.md'] })
      const result = validator.validateBook(TMP)
      expect(result.valid).toBe(false)
      expect(result.issues.some(i => i.message.includes('Missing book.yaml'))).toBe(true)
      cleanup()
    })

    it('allows overlapping markers', () => {
      setupDir(INTERLEAVED_MARKERS)
      const result = validator.validateBook(TMP)
      expect(result.issues.some(i => i.severity === 'error')).toBe(false)
      cleanup()
    })

    it('catches unclosed markers', () => {
      setupDir(UNCLOSED_MARKER)
      const result = validator.validateBook(TMP)
      expect(result.issues.some(i => i.message.includes('Unclosed marker'))).toBe(true)
      cleanup()
    })

    it('catches secondary with text content', () => {
      setupDir(SECONDARY_WITH_TEXT)
      const result = validator.validateBook(TMP)
      const textError = result.issues.find(i => i.message.includes('must not contain text'))
      expect(textError).toBeDefined()
      cleanup()
    })

    it('catches duplicate section names', () => {
      setupDir(DUPLICATE_SECTIONS)
      const result = validator.validateBook(TMP)
      const dupError = result.issues.find(i => i.message.includes('Duplicate section name'))
      expect(dupError).toBeDefined()
      cleanup()
    })

    it('catches markers without annotations', () => {
      setupDir({
        'book.yaml': 'id: noann\ntitle: Test',
        'p/text.cham.md': [
          '---',
          'type: primary',
          'id: 1',
          'title: No Annotation',
          '---',
          '',
          'A{1}B{/1}C',
        ].join('\n'),
      })
      const result = validator.validateBook(TMP)
      expect(result.issues.some(i => i.message.includes('no annotation entry'))).toBe(true)
      cleanup()
    })

    it('catches missing primary fields', () => {
      setupDir(MISSING_ID_BOOK)
      const result = validator.validateBook(TMP)
      expect(result.issues.some(i => i.message.includes('missing required field'))).toBe(true)
      cleanup()
    })

    describe('text sections', () => {
      it('validates valid text sections without issues', () => {
        setupDir({
          'book.yaml': 'id: test\n\ntitle: Test\ngenre: prose\nhierarchy:\n  - 章',
          'piece1/text.cham.md': [
            '---',
            'id: 1',
            'title: Test',
            'genre: prose',
            '---',
            '',
            '### 章:第一章',
            '',
            'Text one.',
            '',
            '### 章:第二章',
            '',
            'Text two.',
            '',
            '## 注釋',
            '',
            '{1} meaning [test]',
          ].join('\n'),
        })
        const result = validator.validateBook(TMP)
        const sectionIssues = result.issues.filter(i => i.message.includes('Text section'))
        expect(sectionIssues).toEqual([])
        cleanup()
      })
    })
  })
})
