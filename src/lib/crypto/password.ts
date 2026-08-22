import 'server-only';
import { hash, verify } from '@node-rs/argon2';

/**
 * Algorithm.Argon2id, inlined: the package ships it as an ambient const enum,
 * which isolatedModules (required by Next) cannot read at runtime.
 */
const ARGON2ID = 2;

/**
 * argon2id with the OWASP baseline (19 MiB, t=2, p=1). The PHC string carries
 * its own parameters, so raising these later keeps old hashes verifiable.
 */
const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, PARAMS);
}

export async function verifyPassword(phc: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(phc, plaintext);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same time as a real verify so that a missing account is
 * not distinguishable from a wrong password by response latency.
 */
export async function fakeVerify(): Promise<void> {
  await hash('timing-equalizer', PARAMS);
}
