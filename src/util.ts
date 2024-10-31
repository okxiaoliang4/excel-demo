export function withDpr(value: number) {
  return value * window.devicePixelRatio
}
/**
 * excel column alpha
 */
export function getAlpha(num: number) {
  let n = num
  let result = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

/**
 * excel column alpha to number
 */
export function alphaToNum(alpha: string) {
  let result = 0
  for (let i = 0; i < alpha.length; i++) {
    result = result * 26 + (alpha.charCodeAt(i) - 64)
  }
  return result
}

/**
 * code to position
 * @param code A1,B2...ZZ1
 * @returns { columnIndex: number, rowIndex: number }
 */
export function codeToPosition(code: string) {
  const match = code.match(/([A-Za-z]+)(\d+)/)
  if (!match) {
    throw new Error(`Invalid cell code: ${code}`)
  }
  const [, columnAlpha, rowIndex] = match
  return { columnIndex: alphaToNum(columnAlpha), rowIndex: Number(rowIndex) }
}
