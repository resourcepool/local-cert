/**
 * Environment-derived defaults.
 *
 * One switch drives the two settings that must never be wrong in production:
 * the password policy and which ACME directory is used. Both can still be
 * overridden explicitly — the environment only decides the default.
 */

export type AppEnv = 'production' | 'development';

/**
 * APP_ENV wins so a production build can be run locally against staging, and a
 * dev server can be pointed at the production profile deliberately.
 */
export function appEnv(): AppEnv {
  const raw = (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase();
  return raw === 'production' || raw === 'prod' ? 'production' : 'development';
}

export function isProduction(): boolean {
  return appEnv() === 'production';
}

export interface PasswordPolicy {
  enforced: boolean;
  minLength: number;
  maxLength: number;
  /** how many of lowercase / uppercase / digit / symbol are required */
  requiredClasses: number;
  rejectCommon: boolean;
  rejectEmailSimilarity: boolean;
}

const PRODUCTION_POLICY: PasswordPolicy = {
  enforced: true,
  minLength: 12,
  // Capped, not for security but because argon2 hashes the whole input and an
  // unbounded password is a cheap way to burn CPU.
  maxLength: 256,
  requiredClasses: 3,
  rejectCommon: true,
  rejectEmailSimilarity: true,
};

const DEVELOPMENT_POLICY: PasswordPolicy = {
  enforced: false,
  minLength: 1,
  maxLength: 256,
  requiredClasses: 0,
  rejectCommon: false,
  rejectEmailSimilarity: false,
};

export function passwordPolicy(): PasswordPolicy {
  return isProduction() ? PRODUCTION_POLICY : DEVELOPMENT_POLICY;
}

/**
 * A deliberately short blocklist. Anything longer belongs in a real breached
 * password service; this only catches the handful that show up in practice
 * when someone types a placeholder and forgets to change it.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'motdepasse', 'azerty', 'azertyuiop',
  'qwerty', 'qwerty123', '123456', '1234567890', 'letmein', 'admin', 'administrator',
  'adminadmin', 'changeme', 'changeme123', 'welcome', 'welcome1', 'iloveyou', 'monkey',
  'dragon', 'football', 'baseball', 'sunshine', 'princess', 'trustno1', 'secret',
  'localcert', 'local-cert', 'certificate', 'letsencrypt',
]);

function classCount(password: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
}

/** Returns the list of violations; empty means the password is acceptable. */
export function validatePassword(password: string, email?: string): string[] {
  const policy = passwordPolicy();
  const problems: string[] = [];

  if (password.length === 0) return ['Password must not be empty'];
  if (password.length > policy.maxLength) {
    problems.push(`Password must be at most ${policy.maxLength} characters`);
  }
  if (!policy.enforced) return problems;

  if (password.length < policy.minLength) {
    problems.push(`Password must be at least ${policy.minLength} characters`);
  }

  const classes = classCount(password);
  if (classes < policy.requiredClasses) {
    problems.push(
      `Password must combine at least ${policy.requiredClasses} of: lowercase, uppercase, digit, symbol (found ${classes})`,
    );
  }

  if (policy.rejectCommon) {
    // Strip trailing digits so "password2024" is caught along with "password".
    const normalised = password.toLowerCase().replace(/[0-9!.]+$/, '');
    if (COMMON.has(password.toLowerCase()) || COMMON.has(normalised)) {
      problems.push('Password is too common');
    }
  }

  if (policy.rejectEmailSimilarity && email) {
    const local = email.split('@')[0]?.toLowerCase();
    if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
      problems.push('Password must not contain the account email');
    }
  }

  return problems;
}

/** Human-readable summary, shown in the setup form. */
export function describePolicy(): string {
  const p = passwordPolicy();
  if (!p.enforced) return 'Aucune politique de mot de passe en environnement de développement.';
  return (
    `${p.minLength} caractères minimum, combinant au moins ${p.requiredClasses} catégories ` +
    'parmi minuscule, majuscule, chiffre et symbole. Les mots de passe courants et ceux ' +
    "contenant l'adresse e-mail sont refusés."
  );
}
