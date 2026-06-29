// ─── Prose Parser & Markdown Helpers ───────────────────────────
// Parses non-CHAM prose files (e.g., author-brief.md, analysis.md)
// into structured sections for the output pipeline.

import type { OutputProseSection } from '../types.js'
import { parseYaml } from '../yaml.js'

// ─── Markdown Helpers ──────────────────────────────────────────

/**
 * Removes single newlines within paragraphs (hard wraps) while preserving
 * paragraph breaks (double newlines).
 */
export function cleanHardWraps(text: string): string {
  return text
    .split('\n\n')
    .map(seg => seg.replace(/\n/g, ''))
    .join('\n\n')
}

/**
 * Splits a markdown source into frontmatter (YAML) and body.
 * Strips a leading BOM. Returns null frontmatter when no delimiters present.
 */
export function splitMdFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null
  body: string
} {
  const trimmed = content.replace(/^﻿/, '')
  if (!trimmed.startsWith('---')) return { frontmatter: null, body: trimmed }
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: null, body: trimmed }
  try {
    const fm = parseYaml(trimmed.slice(3, end))
    const body = trimmed.slice(end + 4)
    return { frontmatter: fm, body: body.startsWith('\n') ? body.slice(1) : body }
  } catch {
    return { frontmatter: null, body: trimmed.slice(end + 4) }
  }
}

// ─── Prose Section Parsing ─────────────────────────────────────

/**
 * Built-in prose file → section key/title/order mapping.
 * Files matching these names are recognized as standard prose sections.
 */
const BUILTIN_PROSE_FILES: Record<string, { key: string; title: string; order: number }> = {
  'author-brief.md': { key: 'author_bio', title: '作者簡介', order: 1 },
  'background.md': { key: 'background', title: '背景資料', order: 2 },
  'analysis.md': { key: 'analysis', title: '賞析', order: 3 },
  'follow-up.md': { key: 'follow_up', title: '延伸活動', order: 4 },
  'think-questions.md': { key: 'think_questions', title: '思考問題', order: 5 },
  'preparation.md': { key: 'preparation', title: '教學準備', order: 6 },
}

/**
 * Parses prose files into structured sections.
 *
 * Recognized files:
 *   - Built-in (`author-brief.md`, `analysis.md`, etc.)
 *   - Custom (`custom-*.md`) — key derived from filename
 *
 * All other `.md` files are ignored.
 */
export function parseProseSections(
  files: ReadonlyMap<string, string>,
): {
  sections: Record<string, string>
  structuredSections: OutputProseSection[]
} {
  const sections: Record<string, string> = {}
  const structured: OutputProseSection[] = []

  for (const [filename, content] of files) {
    if (!filename.endsWith('.md') || filename.endsWith('.cham.md')) continue
    if (filename.startsWith('_')) continue

    const { frontmatter, body } = splitMdFrontmatter(content)
    const builtin = BUILTIN_PROSE_FILES[filename]
    let key: string, title: string, order: number

    if (builtin) {
      key = builtin.key
      title = (frontmatter?.title as string) || builtin.title
      order = (frontmatter?.order as number) ?? builtin.order
    } else if (filename.startsWith('custom-')) {
      const stem = filename.slice(7, -3)
      key = `custom_${stem}`
      title = (frontmatter?.title as string) || stem
      order = (frontmatter?.order as number) ?? 99
    } else {
      continue
    }

    const cleanedBody = cleanHardWraps(body.trim())
    sections[key] = cleanedBody
    structured.push({ key, title, filename, body: cleanedBody, order })
  }

  structured.sort((a, b) => a.order - b.order)
  return { sections, structuredSections: structured }
}
