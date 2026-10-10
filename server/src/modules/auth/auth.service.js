import bcrypt from 'bcryptjs';
import * as repo from './auth.repository.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from './tokens.js';
import { HttpError } from '../../utils/httpError.js';
import { withTransaction } from '../../db/transaction.js';

const BCRYPT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505'; // Postgres error code
// Used when the email doesn't exist, so the response takes the same time either way
const DUMMY_HASH = bcrypt.hashSync('timing-attack-dummy-password', BCRYPT_ROUNDS);

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});

// Shared by register, login and refresh
export async function issueTokens(user, db) {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();

  await repo.saveRefreshToken(
    { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshTokenExpiry() },
    db,
  );

  return { accessToken, refreshToken };
}

export async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await repo.createUser({ name, email, passwordHash });
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new HttpError(409, 'Email is already registered');
    }
    throw err;
  }

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), ...tokens };
}

export async function login({ email, password }) {
  const user = await repo.findUserByEmail(email);

  // Always run bcrypt, even if the user doesn't exist
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !passwordOk) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), ...tokens };


}


export async function refresh(refreshToken) {
  const result = await withTransaction(async (client) => {
    const stored = await repo.findRefreshToken(hashToken(refreshToken), client);

    if (!stored) return { error: 'invalid' };
    if (stored.expires_at <= new Date()) return { error: 'invalid' };

    // Atomic: only ONE request can revoke a given token
    const revokedNow = await repo.revokeRefreshToken(stored.id, client);
    if (!revokedNow) {
      // Token was already used → someone else has a copy → kill every session
      await repo.revokeAllUserTokens(stored.user_id, client);
      return { error: 'reused' };
    }

    // Load fresh from the DB so role changes take effect
    const user = await repo.findUserById(stored.user_id, client);
    const tokens = await issueTokens(user, client);
    return { user: toPublicUser(user), ...tokens };
  });

  if (result.error === 'reused') {
    throw new HttpError(401, 'Refresh token reuse detected. Please log in again.');
  }
  if (result.error) {
    throw new HttpError(401, 'Invalid or expired refresh token');
  }
  return result;
}

export async function logout(refreshToken) {
  const stored = await repo.findRefreshToken(hashToken(refreshToken));
  if (stored) {
    await repo.revokeRefreshToken(stored.id);
  }
}