import { readFileSync, existsSync } from 'fs'

export function parseYamlValue(val: string): unknown {
  if (val === 'true') return true
  if (val === 'false') return false
  if (val === 'null' || val === '~') return null
  if (/^-?\d+$/.test(val)) return parseInt(val, 10)
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val)
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    return val.slice(1, -1)
  if (val.startsWith('[') && val.endsWith(']'))
    return val.slice(1, -1).split(',').map(s => parseYamlValue(s.trim()))
  return val
}

const ARRAY_KEYS = new Set(['contributors', 'layers', 'volumes', 'hero'])
const OBJECT_KEYS = new Set(['date', 'source', 'range'])

interface YamlContext {
  result: Record<string, unknown>
  nestingKey: string
  inArray: boolean
  arrayItems: unknown[]
  currentObj: Record<string, unknown> | null
}

function handleIndented(ctx: YamlContext, trimmed: string): void {
  if (ctx.inArray && trimmed.startsWith('- ')) {
    const val = trimmed.slice(2).trim()
    if (val.includes(':')) {
      const obj: Record<string, unknown> = {}
      const ci = val.indexOf(':')
      obj[val.slice(0, ci).trim()] = parseYamlValue(val.slice(ci + 1).trim())
      ctx.arrayItems.push(obj)
      ctx.currentObj = obj
    } else {
      ctx.arrayItems.push(parseYamlValue(val))
      ctx.currentObj = null
    }
    return
  }

  if (ctx.inArray && ctx.currentObj && trimmed.includes(':') && !trimmed.startsWith('-')) {
    const ci = trimmed.indexOf(':')
    ctx.currentObj[trimmed.slice(0, ci).trim()] = parseYamlValue(trimmed.slice(ci + 1).trim())
    return
  }

  if (trimmed.includes(':')) {
    const ci = trimmed.indexOf(':')
    const subKey = trimmed.slice(0, ci).trim()
    const subVal = trimmed.slice(ci + 1).trim()
    const parent = ctx.result[ctx.nestingKey]
    if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
      ;(parent as Record<string, unknown>)[subKey] = parseYamlValue(subVal)
    }
  }
}

function handleTopLevel(ctx: YamlContext, trimmed: string): void {
  const ci = trimmed.indexOf(':')
  if (ci === -1) return

  const key = trimmed.slice(0, ci).trim()
  const val = trimmed.slice(ci + 1).trim()

  if (val === '') {
    if (ARRAY_KEYS.has(key)) {
      ctx.inArray = true
      ctx.nestingKey = key
      ctx.arrayItems = []
    } else if (OBJECT_KEYS.has(key)) {
      ctx.result[key] = {}
      ctx.nestingKey = key
    }
    return
  }

  if (key.includes('.')) {
    const parts = key.split('.')
    let target: Record<string, unknown> = ctx.result
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {}
      target = target[parts[i]] as Record<string, unknown>
    }
    target[parts[parts.length - 1]] = parseYamlValue(val)
  } else {
    ctx.result[key] = parseYamlValue(val)
  }
}

function closeNesting(ctx: YamlContext): void {
  if (!ctx.nestingKey) return
  if (ctx.inArray) ctx.result[ctx.nestingKey] = ctx.arrayItems
  ctx.inArray = false
  ctx.arrayItems = []
  ctx.currentObj = null
  ctx.nestingKey = ''
}

export function parseYaml(text: string): Record<string, unknown> {
  const ctx: YamlContext = {
    result: {},
    nestingKey: '',
    inArray: false,
    arrayItems: [],
    currentObj: null,
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (line.length - line.trimStart().length > 0 && ctx.nestingKey) {
      handleIndented(ctx, trimmed)
      continue
    }

    closeNesting(ctx)
    handleTopLevel(ctx, trimmed)
  }

  closeNesting(ctx)
  return ctx.result
}

export function loadYaml(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {}
  const src = readFileSync(path, 'utf-8')
  return parseYaml(src)
}
