// ─── Shared filesystem walker for scripts ──────────────────────
// One place to walk a CHAM content directory. Each script used to
// carry its own copy with slightly different predicates; this is
// the canonical helper.

import { readdirSync } from 'fs'
import { join } from 'path'

export type FileFilter = (fileName: string) => boolean

/** Match all `*.cham.md` files (including `text.cham.md`). */
export const allChamFiles: FileFilter = f => f.endsWith('.cham.md')

/** Match only primary text files. */
export const primaryTextFiles: FileFilter = f => f === 'text.cham.md'

/** Match `book.yaml` and `*.cham.md`. */
export const bookYamlAndCham: FileFilter = f => f.endsWith('.cham.md') || f === 'book.yaml'

/**
 * Walks `dir` recursively and returns the full paths of all files for which
 * `filter` returns true. Directories are recursed; symlinks are not followed.
 */
export function walkFiles(dir: string, filter: FileFilter): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, filter))
    } else if (filter(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}
