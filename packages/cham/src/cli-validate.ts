#!/usr/bin/env node
import { resolve } from 'path'
import { ChamValidator } from './validator.js'

function printHelp(): void {
  console.log(`
@hanology/cham — CHAM Validator

Usage:
  cham-validate <content-dir> [options]
  cham-validate <file.cham.md> [options]

Options:
  --registry <dir>   Validate against registry data
  -h, --help         Show this help

Exit code:
  0 if no errors
  1 if any errors
`)
}

const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

if (args.length === 0) {
  console.error('Error: provide a content directory or .cham.md file. Use --help for usage.')
  process.exit(1)
}

const target = resolve(args[0])
const registryIdx = args.indexOf('--registry')
const registryDir = registryIdx !== -1 ? resolve(args[registryIdx + 1]) : undefined

const validator = new ChamValidator()

if (target.endsWith('.cham.md')) {
  const result = validator.validateFile(target)
  let errors = 0
  for (const issue of result.issues) {
    const sym = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : '✓'
    const loc = issue.file ? `${issue.file}` : ''
    console.log(`${sym} ${loc}${loc ? ': ' : ''}${issue.message}`)
    if (issue.severity === 'error') errors++
  }
  if (errors === 0 && result.issues.length === 0) {
    console.log(`✓ ${target}: all checks passed`)
  }
  process.exit(errors > 0 ? 1 : 0)
} else {
  let result
  if (registryDir) {
    result = validator.validateBookWithRegistries(target, registryDir)
  } else {
    result = validator.validateBook(target)
  }
  let errors = 0
  let warnings = 0
  for (const issue of result.issues) {
    const sym = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : '✓'
    const loc = issue.file ? `${issue.file}` : ''
    console.log(`${sym} ${loc}${loc ? ': ' : ''}${issue.message}`)
    if (issue.severity === 'error') errors++
    if (issue.severity === 'warning') warnings++
  }
  const total = result.issues.length
  if (total === 0) {
    console.log(`✓ ${target}: all checks passed`)
  } else {
    console.log(`\n${total} issue(s): ${errors} error(s), ${warnings} warning(s), ${total - errors - warnings} info`)
  }
  process.exit(errors > 0 ? 1 : 0)
}
