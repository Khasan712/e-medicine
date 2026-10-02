// Without look-alike characters (0/O, 1/l/I) so a password can be dictated or copied by hand.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** A random password for a new staff member (crypto-strong). */
export function generatePassword(length = 12): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join('')
}
