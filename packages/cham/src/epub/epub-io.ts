// ─── ePub I/O Helpers ──────────────────────────────────────────
// Filesystem operations for extracting and discovering ePub contents.
// Separated from EpubConverter so the converter can be tested with
// mock filesystems.

import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { unzipSync } from 'fflate'

/**
 * Extracts an ePub zip to a sibling directory and returns the path.
 * The directory is removed first if it already exists.
 *
 * Output path: `<epubDir>/.epub_extracted_<epubBasename>/`
 */
export function extractEpub(epubPath: string): string {
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

/**
 * Finds the OPS directory inside an extracted ePub, if present.
 * Returns `workDir` unchanged if there's no OPS subdir.
 */
export function findOpsDir(workDir: string): string {
  if (existsSync(join(workDir, 'OPS'))) return join(workDir, 'OPS')
  return workDir
}

/**
 * Discovers XHTML content files in the OPS directory.
 *
 * Filters out index/nav/title/toc files and accepts only files
 * starting with `c` (the SKQS naming convention for content files).
 */
export function discoverXhtmlFiles(dir: string): string[] {
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
    const fa = basename(a)
    const fb = basename(b)
    return fa.localeCompare(fb, 'en', { numeric: true })
  })
  return files
}
