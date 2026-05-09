const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

export function toChineseNumber(n: number): string {
  if (n < 0) return '負' + toChineseNumber(-n)
  if (n === 0) return '零'
  if (n < 10) return DIGITS[n]

  if (n >= 10000) {
    const wan = Math.floor(n / 10000)
    const rest = n % 10000
    return (wan === 1 ? '' : toChineseNumber(wan)) + '萬' + (rest ? toChineseNumber(rest) : '')
  }
  if (n >= 1000) {
    const qian = Math.floor(n / 1000)
    const rest = n % 1000
    return (qian === 1 ? '' : DIGITS[qian]) + '千' + (rest ? formatUnder1000(rest) : '')
  }
  if (n >= 100) {
    const bai = Math.floor(n / 100)
    const rest = n % 100
    return (bai === 1 ? '' : DIGITS[bai]) + '百' + (rest ? formatTens(rest) : '')
  }
  return formatTens(n)
}

function formatTens(n: number): string {
  if (n < 10) return DIGITS[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  const T: Record<number, string> = { 1: '十', 2: '廿', 3: '卅', 4: '卌' }
  if (T[tens]) return T[tens] + (ones ? DIGITS[ones] : '')
  return DIGITS[tens] + (ones ? DIGITS[ones] : '十')
}

function formatUnder1000(n: number): string {
  if (n === 0) return ''
  if (n < 100) return formatTens(n)
  const bai = Math.floor(n / 100)
  const rest = n % 100
  return DIGITS[bai] + '百' + (rest ? formatTens(rest) : '')
}
