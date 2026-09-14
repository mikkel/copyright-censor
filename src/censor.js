import { DEFAULT_ALLOWLIST } from './allowlist.js';
import { findCatalogSpans } from './automaton.js';
import {
  asBlocklistObject,
  defaultBlocklist,
  emptyBlocklist,
  flattenBlocklist,
  mediaApplies,
  mergeBlocklists,
} from './blocklist.js';
import { shippedCatalog } from './catalog.js';
import { findHeuristicSpans } from './heuristics.js';
import { compileAllowSet, compileMatcher, mergeSpans } from './matcher.js';
import { tokenize } from './tokenize.js';
import { VERDICTS, worstVerdict } from './verdicts.js';

export { defaultBlocklist, mergeBlocklists, emptyBlocklist };

/**
 * @typedef {import('./verdicts.js').Verdict} Verdict
 * @typedef {import('./heuristics.js').Span} Span
 * @typedef {object} CheckResult
 * @property {Verdict} verdict
 * @property {Span[]} spans
 * @property {string[]} reasons
 * @typedef {object} PairResult
 * @property {Verdict} verdict
 * @property {CheckResult} positive
 * @property {CheckResult} negative
 * @property {string[]} reasons
 * @property {Array<Span & { field: 'positive' | 'negative' }>} spans
 */

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function emptyResult() {
  return { verdict: VERDICTS.ALLOW, spans: [], reasons: [] };
}

/**
 * Compile a reusable censor. Prefer this in a keystroke loop when you pass
 * a custom blocklist so the matcher is not rebuilt on every call.
 * @param {object} [options]
 * @param {unknown} [options.blocklist]
 * @param {boolean} [options.replaceBlocklist]
 * @param {unknown[]} [options.extraTerms]
 * @param {'music' | 'image' | 'video' | 'all'} [options.media]
 * @param {string[]} [options.allowlist]
 */
export function createCensor(options = {}) {
  const media = options.media ?? 'all';
  const useCatalog = !options.replaceBlocklist && !options.replaceCatalog;
  const catalog = options.catalog ?? (useCatalog ? shippedCatalog : null);
  const base = options.replaceBlocklist ? emptyBlocklist() : defaultBlocklist;
  let merged = options.blocklist
    ? options.replaceBlocklist
      ? asBlocklistObject(options.blocklist)
      : mergeBlocklists(base, options.blocklist)
    : asBlocklistObject(base);

  if (Array.isArray(options.extraTerms) && options.extraTerms.length > 0) {
    merged = mergeBlocklists(merged, { entries: options.extraTerms });
  }

  const entries = flattenBlocklist(merged).filter((entry) => mediaApplies(entry.media, media));
  const matcher = compileMatcher(entries);
  const allowSet = compileAllowSet([
    ...DEFAULT_ALLOWLIST,
    ...(Array.isArray(options.allowlist) ? options.allowlist : []),
  ]);
  const commonPhrases = new Set(
    entries.filter((entry) => entry.commonWord).map((entry) => entry.tokens.join(' ')),
  );

  /**
   * @param {unknown} text
   * @returns {CheckResult}
   */
  function check(text) {
    const raw = text == null ? '' : String(text);
    if (!raw.trim()) return emptyResult();

    const tokens = tokenize(raw);
    const catalogSpans = catalog ? findCatalogSpans(catalog, raw, tokens, allowSet, commonPhrases) : [];
    const listSpans = matcher.find(raw, tokens, allowSet);
    const heuristicSpans = findHeuristicSpans(raw);
    const spans = mergeSpans([...catalogSpans, ...listSpans, ...heuristicSpans]);
    const verdict = spans.reduce((current, span) => worstVerdict(current, span.verdict), VERDICTS.ALLOW);
    return {
      verdict,
      spans,
      reasons: unique(spans.map((span) => span.reason)),
    };
  }

  /**
   * @param {{ positive?: unknown, negative?: unknown }} pair
   * @returns {PairResult}
   */
  function checkPair(pair = {}) {
    const positive = check(pair.positive);
    const negative = check(pair.negative);
    return {
      verdict: worstVerdict(positive.verdict, negative.verdict),
      positive,
      negative,
      reasons: unique([...positive.reasons, ...negative.reasons]),
      spans: [
        ...positive.spans.map((span) => ({ ...span, field: 'positive' })),
        ...negative.spans.map((span) => ({ ...span, field: 'negative' })),
      ],
    };
  }

  return {
    check,
    checkPair,
    blocklist: merged,
    entries,
    catalogStats: catalog?.stats ?? null,
  };
}

let defaultCensor = null;

function defaultInstance() {
  defaultCensor ??= createCensor();
  return defaultCensor;
}

function hasCustomData(options) {
  if (!options) return false;
  return Boolean(
    options.blocklist ||
      options.replaceBlocklist ||
      options.replaceCatalog ||
      options.extraTerms ||
      options.allowlist ||
      options.catalog ||
      (options.media && options.media !== 'all'),
  );
}

/**
 * @param {unknown} text
 * @param {Parameters<typeof createCensor>[0]} [options]
 * @returns {CheckResult}
 */
export function check(text, options) {
  if (hasCustomData(options)) return createCensor(options).check(text);
  return defaultInstance().check(text);
}

/**
 * @param {{ positive?: unknown, negative?: unknown }} pair
 * @param {Parameters<typeof createCensor>[0]} [options]
 * @returns {PairResult}
 */
export function checkPair(pair, options) {
  if (hasCustomData(options)) return createCensor(options).checkPair(pair);
  return defaultInstance().checkPair(pair);
}
