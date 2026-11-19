import type { Locale } from '../config';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import { it } from './it';
import { pt } from './pt';
import { de } from './de';

/** English is the reference: every other language must have the same keys. */
export type Messages = typeof en;

export const MESSAGES: Record<Locale, Messages> = { en, fr, es, it, pt, de };
