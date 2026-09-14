/**
 * Reproduction / likeness heuristics.
 * These detect *intent* to copy a work or a person. They do not store lyrics.
 */

const BLOCK_PATTERNS = [
  {
    re: /\b(cover|covers|covering)\s+(of|the)\b/giu,
    reason: 'cover-reproduction intent',
  },
  {
    re: /\b(lyrics?)\s+(of|from|to|for|:)\b/giu,
    reason: 'lyric-reproduction intent',
  },
  {
    re: /\b(lyric|lyrics)\s*[:\-–—]/giu,
    reason: 'lyric-reproduction intent',
  },
  {
    re: /\b(word[-\s]?for[-\s]?word|verbatim|note[-\s]?for[-\s]?note|note[-\s]?perfect)\b/giu,
    reason: 'verbatim reproduction intent',
  },
  {
    re: /\b(recreate|reproduce|remake|clone)\s+(the\s+)?(song|track|album|movie|film|scene|shot)\b/giu,
    reason: 'reproduce-this-work intent',
  },
  {
    re: /\b(official\s+)?(soundtrack|ost)\s+(of|from|for)\b/giu,
    reason: 'soundtrack reproduction intent',
  },
  {
    re: /\b(sing|rap|perform)\s+(the\s+)?(lyrics|chorus|verse|hook)\b/giu,
    reason: 'perform-lyrics intent',
  },
  {
    re: /\b(verse|chorus|bridge|hook)\s*[:#]/giu,
    reason: 'lyric-structure marker',
  },
  {
    re: /\b(play|perform|record)\s+(the\s+)?(exact|original)\b/giu,
    reason: 'exact-performance intent',
  },
  {
    re: /\b(frame|scene|still|screenshot|shot)\s+from\b/giu,
    reason: 'visual reproduction intent',
  },
  {
    re: /\b(character|mascot)\s+from\b/giu,
    reason: 'franchise-character reproduction',
  },
];

const REVIEW_PATTERNS = [
  {
    re: /\bin the style of\b/giu,
    reason: 'artist-style request',
  },
  {
    re: /\b(inspired by|in the vein of|a la|à la)\b/giu,
    reason: 'artist-inspired request',
  },
  {
    re: /\b(vocal|voice|singer|rapper)\s+(of|like|as)\b/giu,
    reason: 'performer-likeness request',
  },
  {
    re: /\b(official\s+)?(logo|wordmark|trademark)\b/giu,
    reason: 'trademark-logo request',
  },
];

/**
 * Nearby tokens that make an otherwise-common identifier look like a
 * rights request. Mix/production words (chorus, vocal, film, track) stay
 * out so "analog bus stacked chorus" and "film grain" are not auto-cued.
 */
export const CONTEXT_CUES = new Set([
  'album',
  'artist',
  'band',
  'brand',
  'character',
  'cover',
  'franchise',
  'like',
  'logo',
  'lyric',
  'lyrics',
  'official',
  'ost',
  'rapper',
  'singer',
  'song',
  'soundtrack',
  'sounding',
  'sounds',
  'style',
  'trademark',
  'verse',
]);

/** Kinds where a sentence-initial capital is just English, not a title. */
const WEAK_INITIAL_KINDS = new Set(['work', 'album', 'franchise', 'trademark', 'custom']);

const QUOTE_RE = /"([^"]+)"|“([^”]+)”|‘([^’]+)’|'([^']+)'/gu;

/**
 * @typedef {import('./verdicts.js').Verdict} Verdict
 * @typedef {object} Span
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {Verdict} verdict
 * @property {string} reason
 * @property {string} [kind]
 */

/**
 * @param {string} text
 * @param {RegExp} re
 * @param {Verdict} verdict
 * @param {string} reason
 * @returns {Span[]}
 */
function spansFromPattern(text, re, verdict, reason) {
  const spans = [];
  re.lastIndex = 0;
  let match;
  while ((match = re.exec(text))) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      verdict,
      reason,
      kind: 'heuristic',
    });
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return spans;
}

/**
 * Long quoted runs look like pasted lyrics / dialogue. Invented or PD only
 * in tests — this never compares against stored copyrighted text.
 * @param {string} text
 * @returns {Span[]}
 */
function quotedReproductionSpans(text) {
  const spans = [];
  QUOTE_RE.lastIndex = 0;
  let match;
  while ((match = QUOTE_RE.exec(text))) {
    const inner = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    const words = inner.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 8 && inner.trim().length >= 40) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        verdict: 'block',
        reason: 'quoted lyric-like passage',
        kind: 'heuristic',
      });
    }
  }
  return spans;
}

/**
 * @param {string} text
 * @returns {Span[]}
 */
export function findHeuristicSpans(text) {
  const spans = [];
  for (const pattern of BLOCK_PATTERNS) {
    spans.push(...spansFromPattern(text, pattern.re, 'block', pattern.reason));
  }
  for (const pattern of REVIEW_PATTERNS) {
    spans.push(...spansFromPattern(text, pattern.re, 'review', pattern.reason));
  }
  spans.push(...quotedReproductionSpans(text));
  return spans;
}

/**
 * @param {import('./tokenize.js').Token[]} tokens
 * @param {number} index
 * @param {number} [window]
 */
const LIKE_PREFIXES = new Set(['sounds', 'sounding', 'voiced', 'voice', 'singer', 'rapper', 'vocal']);

export function hasNearbyCue(tokens, index, window = 8, matchLength = 1) {
  const from = Math.max(0, index - window);
  const to = Math.min(tokens.length, index + window + 1);
  const matchEnd = index + matchLength;
  for (let i = from; i < to; i += 1) {
    if (i >= index && i < matchEnd) continue;
    const norm = tokens[i].norm;
    if (!CONTEXT_CUES.has(norm)) continue;
    if (norm === 'like') {
      const prev = i > 0 ? tokens[i - 1].norm : '';
      if (!LIKE_PREFIXES.has(prev)) continue;
    }
    return true;
  }
  return false;
}

/**
 * @param {import('./tokenize.js').Token} token
 */
export function looksProperName(token) {
  return /\p{Lu}/u.test(token.text);
}

/**
 * Title-case evidence that a span is being used as a name/title, not
 * ordinary English. Sentence-initial capitals on a single work/franchise
 * token ("Grenade in the foley bed") are too weak.
 * @param {import('./tokenize.js').Token[]} tokens
 * @param {number} index
 * @param {number} length
 * @param {string} [kind]
 */
export function looksLikeTitledMention(tokens, index, length, kind = 'work') {
  const slice = tokens.slice(index, index + length);
  if (slice.length === 0) return false;
  const letterTokens = slice.filter((token) => /\p{L}/u.test(token.text));
  if (letterTokens.length === 0) return false;
  const named = letterTokens.filter(looksProperName);
  if (length === 1) {
    if (named.length === 0) return false;
    if (index === 0 && tokens.length > 1 && WEAK_INITIAL_KINDS.has(kind)) return false;
    return true;
  }
  return named.length >= Math.ceil(letterTokens.length / 2);
}

/**
 * Common / short identifiers may fire only with title-case evidence or a
 * nearby rights cue (never because the match cued itself).
 * @param {import('./tokenize.js').Token[]} tokens
 * @param {number} index
 * @param {number} length
 * @param {string} [kind]
 */
export function framingAllowsMatch(tokens, index, length, kind = 'work') {
  const first = tokens[index];
  if (length === 1 && first && first.norm.length <= 2) {
    return hasNearbyCue(tokens, index, 8, length);
  }
  return looksLikeTitledMention(tokens, index, length, kind) || hasNearbyCue(tokens, index, 8, length);
}
