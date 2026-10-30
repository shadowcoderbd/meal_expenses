export function money(n: number, currency: string): string {
  const v = Math.round(n * 100) / 100
  const sign = v < 0 ? '-' : ''
  return `${sign}${currency}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/** Always two decimals, e.g. 4,268.89 and 210.00 (matches the bill sheet). */
export function fixed2(n: number): string {
  const v = Math.round(n * 100) / 100 || 0 // `|| 0` turns -0 into 0 so it doesn't print as "-0.00"
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function num(n: number, digits = 2): string {
  return (Math.round(n * 10 ** digits) / 10 ** digits).toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function prettyDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts)
}

export function weekday(iso: string): string {
  return prettyDate(iso, { weekday: 'short' })
}
