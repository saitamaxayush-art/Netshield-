/** Clamp a typed number into its allowed range, with a note saying what was done. Non numbers stay refused. */
export function clampInput(value: number, min: number, max: number, integer = false): { value: number; note: string | null } {
  if (!Number.isFinite(value)) return { value, note: null }
  let v = integer ? Math.round(value) : value
  let note: string | null = integer && v !== value ? `Rounded to ${v}, a whole number.` : null
  if (v < min) {
    v = min
    note = `Set to ${min}, the smallest allowed value.`
  } else if (v > max) {
    v = max
    note = `Set to ${max}, the largest allowed value.`
  }
  return { value: v, note }
}
