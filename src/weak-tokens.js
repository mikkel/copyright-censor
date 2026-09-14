import { COMMON_WORDS } from '../scripts/common-words.js';

/**
 * Extra production / English tokens that show up as catalog identifiers
 * but are ordinary slider language. Used only for runtime framing — this
 * is not a lyrics list.
 */
const EXTRA_WEAK = new Set([
  'add',
  'bar',
  'boots',
  'bounce',
  'bus',
  'camera',
  'ceiling',
  'crack',
  'crowd',
  'dead',
  'drone',
  'drop',
  'extra',
  'faint',
  'fi',
  'field',
  'fog',
  'foley',
  'gel',
  'gorgeous',
  'grain',
  'grass',
  'it',
  'keys',
  'kick',
  'lawn',
  'lfo',
  'lighting',
  'lo',
  'lofi',
  'make',
  'miami',
  'noise',
  'pad',
  'room',
  'sign',
  'snare',
  'speakers',
  'stab',
  'stacked',
  'thud',
  'times',
  'toss',
  'vibe',
  'whoosh',
  'zoom',
]);

/**
 * @param {string} norm
 * @returns {boolean}
 */
export function isWeakToken(norm) {
  if (!norm) return false;
  if (norm.length <= 2) return true;
  return COMMON_WORDS.has(norm) || EXTRA_WEAK.has(norm);
}

/**
 * True when every token is ordinary English / production language.
 * Unique titles like "sympathy for the devil" stay false.
 * @param {string[]} norms
 */
export function isWeakPhrase(norms) {
  return Array.isArray(norms) && norms.length > 0 && norms.every(isWeakToken);
}
