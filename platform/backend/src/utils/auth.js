import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/** Hash a plaintext password for storage. */
export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

/** Compare a plaintext password against a stored bcrypt hash. */
export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Sign a JWT access token for a user id. */
export function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/** Verify a JWT and return its payload, or throw. */
export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/** Epoch seconds when a freshly-issued token will expire. */
export function tokenExpiresAt() {
  return Math.floor(Date.now() / 1000) + env.jwtExpiresIn;
}
