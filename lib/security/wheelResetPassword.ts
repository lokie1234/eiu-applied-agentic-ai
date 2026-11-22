import 'server-only';
import { scrypt, timingSafeEqual } from 'node:crypto';

// Server-only verifier. A deployment can override the confirmation through env.
const salt = '7474a0b8b19b673c230e512dc5003900';
const verifier = '36ae21e4ee99e4567c9380e1376cb312d32736fdbd3409e655b4cce8f6777c2d';
const derive = (value: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(value, salt, 32, (error, key) => error ? reject(error) : resolve(key));
});
export async function verifyWheelResetPassword(password: unknown) {
  if (typeof password !== 'string' || !password || password.length > 200) return false;
  const expected = process.env.WHEEL_RESET_PASSWORD ? await derive(process.env.WHEEL_RESET_PASSWORD) : Buffer.from(verifier, 'hex');
  return timingSafeEqual(await derive(password), expected);
}
