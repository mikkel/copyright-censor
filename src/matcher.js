import { framingAllowsMatch } from './heuristics.js';
import { normalizeToken } from './tokenize.js';
import { isWeakPhrase } from './weak-tokens.js';

/**
 * @typedef {import('./blocklist.js').BlocklistEntry} BlocklistEntry
 * @typedef {import('./tokenize.js').Token} Token
 * @typedef {import('./heuristics.js').Span} Span
 */

/**
 * @param {Array<BlocklistEntry & { tokens: string[] }>} entries
 */
export function compileMatcher(entries) {
  /** @type {Map<string, Array<BlocklistEntry & { tokens: string[] }>>} */
  const byFirst = new Map();
  for (const entry of entries) {
    const first = entry.tokens[0];
    if (!first) continue;
    const list = byFirst.get(first) ?? [];
    list.push(entry);
    byFirst.set(first, list);
  }
  for (const list of byFirst.values()) {
    list.sort((a, b) => b.tokens.length - a.tokens.length);
  }

  /**
   * @param {string} text
   * @param {Token[]} tokens
   * @param {Set<string>} allowSet
   * @returns {Span[]}
   */
  function find(text, tokens, allowSet) {
    const spans = [];
    let i = 0;
    while (i < tokens.length) {
      const candidates = byFirst.get(tokens[i].norm) ?? [];
      let best = null;
      for (const entry of candidates) {
        if (!matchesAt(tokens, i, entry.tokens)) continue;
        if (needsFraming(entry) && !framingAllowsMatch(tokens, i, entry.tokens.length, entry.kind)) {
          continue;
        }
        const phrase = entry.tokens.join(' ');
        if (allowSet.has(phrase)) continue;
        if (!best || entry.tokens.length > best.tokens.length) {
          best = entry;
        }
      }
      if (best) {
        const start = tokens[i].start;
        const end = tokens[i + best.tokens.length - 1].end;
        spans.push({
          start,
          end,
          text: text.slice(start, end),
          verdict: best.verdict,
          reason: best.reason,
          kind: best.kind,
        });
        i += best.tokens.length;
      } else {
        i += 1;
      }
    }
    return spans;
  }

  return { find };
}

/**
 * @param {Token[]} tokens
 * @param {number} index
 * @param {string[]} termTokens
 */
function matchesAt(tokens, index, termTokens) {
  if (index + termTokens.length > tokens.length) return false;
  for (let i = 0; i < termTokens.length; i += 1) {
    if (tokens[index + i].norm !== termTokens[i]) return false;
  }
  return true;
}

/**
 * Ambiguous identifiers ("Queen", "morning dew", "rain on me") only fire
 * when they look like a title/name or sit next to a rights cue.
 * @param {BlocklistEntry & { tokens: string[] }} entry
 */
function needsFraming(entry) {
  return Boolean(entry.commonWord) || isWeakPhrase(entry.tokens);
}

/**
 * @param {Span[]} spans
 * @returns {Span[]}
 */
export function mergeSpans(spans) {
  if (spans.length <= 1) return spans.slice();
  const ranked = {
    allow: 0,
    review: 1,
    block: 2,
  };
  const sorted = spans.slice().sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return ranked[b.verdict] - ranked[a.verdict];
  });

  /** @type {Span[]} */
  const out = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (!last || span.start >= last.end) {
      out.push({ ...span });
      continue;
    }
    if (ranked[span.verdict] > ranked[last.verdict]) {
      out[out.length - 1] = { ...span };
    } else if (
      ranked[span.verdict] === ranked[last.verdict] &&
      span.end - span.start > last.end - last.start
    ) {
      out[out.length - 1] = { ...span };
    }
  }
  return out;
}

/**
 * @param {Iterable<string>} words
 * @returns {Set<string>}
 */
export function compileAllowSet(words) {
  const set = new Set();
  for (const word of words) {
    const norm = normalizeToken(String(word)).trim();
    if (norm) set.add(norm);
  }
  return set;
}
