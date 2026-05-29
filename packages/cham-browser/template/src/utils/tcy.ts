export function tcy(n: number): string {
  const s = String(n)
  return s.length <= 2 ? `<span style="text-combine-upright:all">${s}</span>` : s
}
