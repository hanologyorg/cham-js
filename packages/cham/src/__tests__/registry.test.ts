import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RegistryLoader } from '../registry.js'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

const TMP = join(import.meta.dirname, '__tmp_registry__')

function setup(): void {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

function cleanup(): void {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
}

describe('RegistryLoader', () => {
  beforeEach(setup)
  afterEach(cleanup)

  it('loads authors registry', () => {
    writeFileSync(join(TMP, 'authors.yaml'), [
      'authors:',
      '  - id: LBY',
      '    name: 李白',
      '    dynasty: 唐',
    ].join('\n'), 'utf-8')

    const loader = new RegistryLoader()
    const reg = loader.loadAll(TMP)
    expect(reg.authors.LBY).toBeDefined()
    expect(reg.authors.LBY.name).toBe('李白')
    expect(reg.authors.LBY.dynasty).toBe('唐')
  })

  it('loads dynasties registry', () => {
    writeFileSync(join(TMP, 'dynasties.yaml'), [
      'dynasties:',
      '  - id: tang',
      '    label: 唐',
      '    start: 618',
      '    end: 907',
    ].join('\n'), 'utf-8')

    const loader = new RegistryLoader()
    const reg = loader.loadAll(TMP)
    expect(reg.dynasties).toHaveLength(1)
    expect(reg.dynasties[0].label).toBe('唐')
  })

  it('loads lexicon with flat reading format', () => {
    writeFileSync(join(TMP, 'lexicon.yaml'), [
      'entries:',
      '  - char: 明',
      '    lang: cmn',
      '    value: míng',
    ].join('\n'), 'utf-8')

    const loader = new RegistryLoader()
    const reg = loader.loadAll(TMP)
    expect(reg.lexicon).toHaveLength(1)
    expect(reg.lexicon[0].char).toBe('明')
  })

  it('returns empty registries when files are missing', () => {
    const loader = new RegistryLoader()
    const reg = loader.loadAll(TMP)
    expect(Object.keys(reg.authors)).toHaveLength(0)
    expect(reg.dynasties).toHaveLength(0)
    expect(reg.lexicon).toHaveLength(0)
  })

  it('handles malformed registry gracefully', () => {
    writeFileSync(join(TMP, 'authors.yaml'), 'just a string', 'utf-8')
    const loader = new RegistryLoader()
    const reg = loader.loadAll(TMP)
    expect(Object.keys(reg.authors)).toHaveLength(0)
  })
})
