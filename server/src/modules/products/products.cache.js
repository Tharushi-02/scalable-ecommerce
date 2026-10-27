import { redis } from '../../db/redis.js';

const LIST_VERSION_KEY = 'products:list:version';
const VERSION_MEMO_MS = 1000; // remember the version for 1 second

// In-memory copy of the version, so most requests skip one Redis round trip
let memo = { version: null, expiresAt: 0 };

// products:item:5
export const itemKey = (id) => `products:item:${id}`;

// products:list:v7:
export async function listKeyPrefix() {
  const now = Date.now();
  if (memo.version !== null && now < memo.expiresAt) {
    return `products:list:v${memo.version}:`;
  }

  let version = '0';
  try {
    version = (await redis.get(LIST_VERSION_KEY)) ?? '0';
    memo = { version, expiresAt: now + VERSION_MEMO_MS };
  } catch {
    // Redis down: any prefix is fine, nothing will be cached anyway
  }
  return `products:list:v${version}:`;
}

// Call AFTER the database change is saved.
// Deletes the given products' own keys, and (unless lists: false)
// bumps the list version so every cached list becomes stale at once.
export async function invalidateProducts(productIds = [], { lists = true } = {}) {
  if (productIds.length === 0 && !lists) return;

  // This server forgets its remembered version immediately (no 1-second wait here)
  if (lists) memo = { version: null, expiresAt: 0 };

  try {
    const tx = redis.multi();
    if (lists) tx.incr(LIST_VERSION_KEY);
    for (const id of productIds) tx.del(itemKey(id));
    await tx.exec();
  } catch (err) {
    // Redis down: old entries still expire on their own within 60 seconds
    console.error('Cache invalidation failed:', err.message);
  }
}