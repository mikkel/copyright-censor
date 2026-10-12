import defaultBlocklistJson from '../data/blocklist.json' with { type: 'json' };
import { tokenize } from './tokenize.js';
import { isVerdict } from './verdicts.js';

export const defaultBlocklist = defaultBlocklistJson;

const KIND_DEFAULTS = {
  artist: {
    kind: 'artist',
    verdict: 'review',
    reason: 'famous artist',
  },
  work: {
    kind: 'work',
    verdict: 'block',
    reason: 'specific protected work',
  },
  franchise: {
    kind: 'franchise',
    verdict: 'block',
    reason: 'protected franchise',
  },
  trademark: {
    kind: 'trademark',
    verdict: 'block',
    reason: 'protected trademark',
  },
  custom: {
    kind: 'custom',
    verdict: 'review',
    reason: 'custom blocklist term',
  },
};

const GROUP_TO_KIND = {
  artists: 'artist',
  works: 'work',
  franchises: 'franchise',
  trademarks: 'trademark',
  entries: 'custom',
};

const ARTICLES = new Set(['the', 'a', 'an']);

/**
 * @typedef {object} BlocklistEntry
 * @property {string} term
 * @property {string} [kind]
 * @property {'allow' | 'review' | 'block'} [verdict]
 * @property {string} [reason]
 * @property {string[]} [aliases]
 * @property {Array<'music' | 'image' | 'video' | 'all'>} [media]
 * @property {boolean} [commonWord]
 * @property {string[]} [requires] co-occurring phrases; any one must also appear
 */

/**
 * @param {unknown} raw
 * @returns {object}
 */
export function emptyBlocklist() {
  return {
    version: 1,
    artists: [],
    works: [],
    franchises: [],
    trademarks: [],
    entries: [],
  };
}

/**
 * @param {unknown} input
 * @returns {object}
 */
export function asBlocklistObject(input) {
  if (!input) return emptyBlocklist();
  if (Array.isArray(input)) {
    return { ...emptyBlocklist(), entries: input };
  }
  if (typeof input === 'object') {
    return {
      version: input.version ?? 1,
      artists: Array.isArray(input.artists) ? input.artists : [],
      works: Array.isArray(input.works) ? input.works : [],
      franchises: Array.isArray(input.franchises) ? input.franchises : [],
      trademarks: Array.isArray(input.trademarks) ? input.trademarks : [],
      entries: Array.isArray(input.entries) ? input.entries : [],
    };
  }
  throw new TypeError('blocklist must be an object or array');
}

/**
 * @param {unknown} base
 * @param {unknown} extra
 * @returns {object}
 */
export function mergeBlocklists(base, extra) {
  const left = asBlocklistObject(base);
  const right = asBlocklistObject(extra);
  return {
    version: right.version ?? left.version ?? 1,
    artists: [...left.artists, ...right.artists],
    works: [...left.works, ...right.works],
    franchises: [...left.franchises, ...right.franchises],
    trademarks: [...left.trademarks, ...right.trademarks],
    entries: [...left.entries, ...right.entries],
  };
}

/**
 * @param {unknown} item
 * @param {string} kind
 * @returns {BlocklistEntry | null}
 */
function normalizeEntry(item, kind) {
  if (item == null) return null;
  const defaults = KIND_DEFAULTS[kind] ?? KIND_DEFAULTS.custom;
  if (typeof item === 'string') {
    const term = item.trim();
    if (term.length < 2) return null;
    return {
      term,
      kind: defaults.kind,
      verdict: defaults.verdict,
      reason: defaults.reason,
      aliases: [],
      media: ['all'],
      commonWord: false,
      requires: [],
    };
  }
  if (typeof item !== 'object' || typeof item.term !== 'string') return null;
  const term = item.term.trim();
  if (term.length < 2) return null;
  const verdict = isVerdict(item.verdict) ? item.verdict : defaults.verdict;
  const media = Array.isArray(item.media) && item.media.length > 0 ? item.media : ['all'];
  const requires = Array.isArray(item.requires)
    ? item.requires.filter((phrase) => typeof phrase === 'string' && phrase.trim())
    : [];
  return {
    term,
    kind: typeof item.kind === 'string' ? item.kind : defaults.kind,
    verdict,
    reason: typeof item.reason === 'string' && item.reason ? item.reason : defaults.reason,
    aliases: Array.isArray(item.aliases) ? item.aliases.filter((alias) => typeof alias === 'string') : [],
    media,
    commonWord: Boolean(item.commonWord),
    requires,
  };
}

/**
 * @param {string[] | undefined} requires
 * @returns {string[][]}
 */
function compileRequires(requires) {
  if (!Array.isArray(requires)) return [];
  const phrases = [];
  for (const phrase of requires) {
    const tokens = tokenize(phrase).map((token) => token.norm).filter(Boolean);
    if (tokens.length > 0) phrases.push(tokens);
  }
  return phrases;
}

/**
 * Flatten grouped JSON / arrays into compiled entries (one per alias).
 * @param {unknown} input
 * @returns {Array<BlocklistEntry & { tokens: string[] }>}
 */
export function flattenBlocklist(input) {
  const object = asBlocklistObject(input);
  /** @type {BlocklistEntry[]} */
  const rawEntries = [];

  for (const [group, kind] of Object.entries(GROUP_TO_KIND)) {
    const list = object[group];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const entry = normalizeEntry(item, kind);
      if (entry) rawEntries.push(entry);
    }
  }

  /** @type {Array<BlocklistEntry & { tokens: string[], requiresTokens: string[][] }>} */
  const compiled = [];
  for (const entry of rawEntries) {
    const requiresTokens = compileRequires(entry.requires);
    const terms = [entry.term, ...entry.aliases];
    for (const term of terms) {
      const tokens = tokenize(term).map((token) => token.norm).filter(Boolean);
      if (tokens.length === 0) continue;
      compiled.push({ ...entry, term, tokens, requiresTokens });
      if (tokens.length > 1 && ARTICLES.has(tokens[0])) {
        compiled.push({ ...entry, term, tokens: tokens.slice(1), requiresTokens });
      }
    }
  }
  return compiled;
}

/**
 * @param {string[] | undefined} entryMedia
 * @param {string} requested
 */
export function mediaApplies(entryMedia, requested) {
  if (!requested || requested === 'all') return true;
  if (!entryMedia || entryMedia.length === 0 || entryMedia.includes('all')) return true;
  return entryMedia.includes(requested);
}
