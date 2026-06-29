// ─── EpubConverter ────────────────────────────────────────────
// Orchestrates ePub → CHAM conversion: extract the zip, discover
// XHTML files, parse each into ParsedFile, then build CHAM documents
// (primary + commentary) per section and write them to disk.
//
// This is the only module in epub/ that performs I/O. Parsing and
// annotation-splitting are pure and live in their sibling modules.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
import { join, basename } from 'path'
import { unzipSync } from 'fflate'
import type {
  BookConfig, AnnotationEntry, ChamDocument,
} from '../types.js'
import { ChamSerializer } from '../serializer.js'
import { padNum } from './utils.js'
import {
  parseXhtmlFile,
  type ParsedFile, type ParsedSection, type ParseContext,
} from './xhtml-parser.js'
import { splitAnnotationContent } from './annotation-splitter.js'

export interface EpubConvertOptions {
  epubPath?: string
  extractedDir?: string
  outputDir: string
  bookConfig: Partial<BookConfig>
  layerContributor?: string
}

export class EpubConverter {
  private serializer = new ChamSerializer()
  private bookTitle = ''

  convert(opts: EpubConvertOptions): void {
    const workDir = opts.extractedDir || this.extractEpub(opts.epubPath!)
    if (!workDir) throw new Error('No epub path or extracted directory provided')

    this.bookTitle = opts.bookConfig.title || ''

    const ctx: ParseContext = {
      bookTitle: this.bookTitle,
      contributorNames: opts.bookConfig.contributors?.map(c => c.ref),
    }

    const opfDir = this.findOpsDir(workDir)
    const xhtmlFiles = this.discoverXhtmlFiles(opfDir)

    const volumeMap = new Map<string, string>()
    for (const f of xhtmlFiles) {
      const vol = this.detectVolume(basename(f))
      if (vol) volumeMap.set(f, vol)
    }

    mkdirSync(opts.outputDir, { recursive: true })

    const allParsed: ParsedFile[] = []
    for (const xhtmlPath of xhtmlFiles) {
      const xhtml = readFileSync(xhtmlPath, 'utf-8')
      const volLabel = volumeMap.get(xhtmlPath) || ''
      const parsed = parseXhtmlFile(xhtml, volLabel, ctx)
      parsed.filename = basename(xhtmlPath)
      allParsed.push(parsed)
    }

    let pieceNum = 0
    const pieceDirs: string[] = []

    for (const pf of allParsed) {
      if (pf.headerLines.length > 0 && pf.sections.length === 0) {
        pieceNum++
        const title = this.detectHeaderTitle(pf)
        const section: ParsedSection = {
          title,
          num: pieceNum,
          volumeLabel: pf.volumeLabel,
          lines: pf.headerLines,
        }
        this.writePiece(opts.outputDir, pieceNum, section, opts.bookConfig, opts.layerContributor)
        pieceDirs.push(`${padNum(pieceNum)}_${title}`)
      }

      for (const section of pf.sections) {
        pieceNum++
        this.writePiece(opts.outputDir, pieceNum, section, opts.bookConfig, opts.layerContributor)
        const safeTitle = section.title.replace(/[·\/\\]/g, '·')
        pieceDirs.push(`${padNum(pieceNum)}_${safeTitle}`)
      }
    }

    this.writeBookYaml(opts.outputDir, opts.bookConfig, pieceDirs)
    console.log(`Converted ${pieceNum} pieces to ${opts.outputDir}`)
  }

  private writePiece(
    outputDir: string, num: number, section: ParsedSection,
    bookConfig: Partial<BookConfig>, layerContributor?: string,
  ): void {
    const safeTitle = section.title.replace(/[·\/\\]/g, '·')
    const dirName = `${padNum(num)}_${safeTitle}`
    const pieceDir = join(outputDir, dirName)
    mkdirSync(pieceDir, { recursive: true })

    const primaryDoc = this.buildPrimaryDoc(section, num, bookConfig)
    writeFileSync(join(pieceDir, 'text.cham.md'), this.serializer.serialize(primaryDoc), 'utf-8')

    if (layerContributor && section.lines.some(l => l.annotations.length > 0)) {
      const commentaryDoc = this.buildCommentaryDoc(section, layerContributor)
      writeFileSync(join(pieceDir, 'commentary.cham.md'), this.serializer.serialize(commentaryDoc), 'utf-8')
    }
  }

  private buildPrimaryDoc(
    section: ParsedSection, num: number, bookConfig: Partial<BookConfig>,
  ): ChamDocument {
    const textBlocks: ChamDocument['textBlocks'] = []
    const markers: ChamDocument['markers'] = new Map()
    let blockIdx = 0
    let globalMarkerId = 0

    for (const line of section.lines) {
      if (line.type !== 'header' && line.type !== 'body') continue

      const parts: string[] = []
      const lineAnnotations = line.annotations
      const clean = line.cleanText

      let cumulativeText = ''

      for (const ann of lineAnnotations) {
        globalMarkerId++
        const preceding = ann.precedingText

        if (preceding) {
          parts.push(preceding)
          const startOff = cumulativeText.length
          cumulativeText += preceding

          markers.set(globalMarkerId, {
            id: globalMarkerId,
            sectionIndex: 0,
            blockIndex: blockIdx,
            offset: startOff,
            length: preceding.length,
            text: preceding,
          })
          parts.push(`{${globalMarkerId}}${preceding}{/${globalMarkerId}}`)
        } else {
          markers.set(globalMarkerId, {
            id: globalMarkerId,
            sectionIndex: 0,
            blockIndex: blockIdx,
            offset: cumulativeText.length,
            length: 0,
          })
          parts.push(`{${globalMarkerId}}`)
        }
      }

      textBlocks.push({
        sectionIndex: 0,
        blockIndexInSection: textBlocks.length,
        text: clean,
        display: clean,
        source: line.markedText,
      })
      blockIdx++
    }

    return {
      meta: {
        type: 'primary',
        id: num,
        title: section.title,
        contributors: bookConfig.contributors,
        date: bookConfig.date,
        genre: bookConfig.genre || 'prose',
      },
      textBlocks,
      markers,
      sections: [],
    }
  }

  private buildCommentaryDoc(section: ParsedSection, contributor: string): ChamDocument {
    const entries: AnnotationEntry[] = []
    let markerId = 0

    for (const line of section.lines) {
      for (const ann of line.annotations) {
        markerId++
        const baseParams: Record<string, string> = {}
        if (ann.skqsImages.length > 0) {
          baseParams.skqs = ann.skqsImages.map(s => s.altText).join(',')
        }

        const split = splitAnnotationContent(ann.content, ann.skqsImages.length > 0, ann.hasFanqie)

        if (split.length === 0) continue

        if (split.length === 1) {
          const s = split[0]
          entries.push({
            target: { type: 'marker', markerId },
            kind: s.kind,
            params: { ...baseParams, ...s.params },
            headword: s.headword,
            value: s.value,
          })
        } else {
          for (let i = 0; i < split.length; i++) {
            const s = split[i]
            entries.push({
              target: { type: 'marker', markerId },
              kind: s.kind,
              params: { ...baseParams, ...s.params },
              headword: s.headword,
              value: s.value,
            })
          }
        }
      }
    }

    return {
      meta: {
        type: 'secondary',
        base: 'text.cham.md',
        contributor,
        role: 'commentator',
        nature: 'commentary',
      },
      textBlocks: [],
      markers: new Map(),
      sections: entries.length > 0
        ? [{ name: '注釋', meta: {}, entries }]
        : [],
    }
  }

  private writeBookYaml(
    outputDir: string, config: Partial<BookConfig>, pieceDirs: string[],
  ): void {
    const lines: string[] = [
      `id: ${config.id || 'unknown'}`,
      `title: ${config.title || ''}`,
    ]
    if (config.subtitle) lines.push(`subtitle: ${config.subtitle}`)
    if (config['title-en']) lines.push(`title-en: ${config['title-en']}`)
    if (config.publisher) lines.push(`publisher: ${config.publisher}`)
    lines.push(`genre: ${config.genre || 'prose'}`)

    if (config.contributors?.length) {
      lines.push('contributors:')
      for (const c of config.contributors) {
        lines.push(`  - ref: ${c.ref}`)
        lines.push(`    role: ${c.role}`)
      }
    }

    if (config.date) {
      lines.push('date:')
      if (config.date.dynasty) lines.push(`  dynasty: ${config.date.dynasty}`)
      if (config.date.era) lines.push(`  era: ${config.date.era}`)
      if (config.date.era_year !== undefined) lines.push(`  era_year: ${config.date.era_year}`)
    }

    if (config.layers?.length) {
      lines.push('layers:')
      for (const l of config.layers) {
        lines.push(`  - id: ${l.id}`)
        lines.push(`    label: ${l.label}`)
        lines.push(`    contributor: ${l.contributor}`)
      }
    }

    writeFileSync(join(outputDir, 'book.yaml'), lines.join('\n') + '\n', 'utf-8')
  }

  // ─── ePub zip helpers ─────────────────────────────────────

  private extractEpub(epubPath: string): string {
    const data = readFileSync(epubPath)
    const unzipped = unzipSync(new Uint8Array(data))
    const epubBasename = basename(epubPath, '.epub')
    const tmpDir = join(epubPath, '..', `.epub_extracted_${epubBasename}`)
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
    mkdirSync(tmpDir, { recursive: true })

    for (const [fpath, content] of Object.entries(unzipped)) {
      const filePath = join(tmpDir, fpath)
      mkdirSync(join(filePath, '..'), { recursive: true })
      writeFileSync(filePath, Buffer.from(content))
    }

    return tmpDir
  }

  private findOpsDir(workDir: string): string {
    if (existsSync(join(workDir, 'OPS'))) return join(workDir, 'OPS')
    return workDir
  }

  private discoverXhtmlFiles(dir: string): string[] {
    const files: string[] = []
    const skipPatterns = ['quan_lan', '_index', 'about', 'nav', 'title', 'toc']
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.xhtml')) continue
      if (skipPatterns.some(p => entry.includes(p))) continue
      if (entry.startsWith('c')) {
        files.push(join(dir, entry))
      }
    }
    files.sort((a, b) => {
      const numA = parseInt(basename(a).match(/^c(\d+)/)?.[1] || '0', 10)
      const numB = parseInt(basename(b).match(/^c(\d+)/)?.[1] || '0', 10)
      return numA - numB
    })
    if (files.length === 0) {
      for (const entry of readdirSync(dir).sort()) {
        if (!entry.endsWith('.xhtml')) continue
        if (skipPatterns.some(p => entry.includes(p))) continue
        files.push(join(dir, entry))
      }
    }
    return files
  }

  private detectVolume(filename: string): string | null {
    if (filename.startsWith('c0_')) return '序'
    const m = filename.match(/juan(\d+)/)
    if (m) return '卷' + this.numToChinese(parseInt(m[1], 10))
    return null
  }

  private numToChinese(n: number): string {
    const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    if (n <= 0) return ''
    if (n < 10) return digits[n]
    if (n < 20) return '十' + (n % 10 ? digits[n % 10] : '')
    if (n < 100) return digits[Math.floor(n / 10)] + '十' + (n % 10 ? digits[n % 10] : '')
    return String(n)
  }

  private detectHeaderTitle(pf: ParsedFile): string {
    for (const line of pf.headerLines) {
      const t = line.cleanText.trim()
      if (t.length <= 10 && t.includes('提要')) return '提要'
      if (t.length <= 10 && t.includes('序')) return this.bookTitle ? `${this.bookTitle}序` : '序'
      if (/^提要/.test(t)) return '提要'
      if (/^序/.test(t)) return this.bookTitle ? `${this.bookTitle}序` : '序'
    }
    if (pf.volumeLabel) return pf.volumeLabel
    return '外序'
  }
}