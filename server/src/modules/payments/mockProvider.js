import crypto from 'node:crypto';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pretends to be Stripe/PayPal. Never receives or stores a real card.
export async function charge({ cardNumber }) {
  await delay(300); // simulated network round trip
  const last4 = cardNumber.slice(-4);

  if (last4 === '0002') return { ok: false, last4, reason: 'Card declined' };
  if (last4 === '9995') return { ok: false, last4, reason: 'Insufficient funds' };

  return { ok: true, last4, providerRef: `mock_ch_${crypto.randomBytes(8).toString('hex')}` };
}

export async function refund() {
  await delay(300);
  return { ok: true, providerRef: `mock_re_${crypto.randomBytes(8).toString('hex')}` };
}