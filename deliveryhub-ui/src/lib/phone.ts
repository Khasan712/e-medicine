/** Like the backend: 9 digits → +998…, 10–15 digits → +…; otherwise null. */
export function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, '')
  if (digits.length === 9) digits = `998${digits}`
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null
}

/** "+998901234567" → "+998 90 123 45 67"; anything else is returned as typed. */
export function formatPhone(value: string): string {
  const phone = normalizePhone(value)
  if (!phone) return value
  const parts = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone)
  return parts ? `+998 ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}` : phone
}
