// "19.99" → 1999.  Parses the text directly, so no float is ever involved.
export function toCents(amount) {
  const [whole, fraction = ''] = String(amount).split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

// 5997 → "59.97"
export function fromCents(cents) {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}