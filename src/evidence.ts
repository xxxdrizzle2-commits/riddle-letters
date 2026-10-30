/** Deterministic synthetic digest for the adult demo. It is explicitly not a
 * cryptographic hash and must never be presented as one. */
export function syntheticDigest(value: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    h1 = (h1 ^ code) * 0x01000193
    h2 = (h2 + code * (index + 1)) * 0x85ebca6b
    h1 >>>= 0; h2 >>>= 0
  }
  return `synthetic-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}
