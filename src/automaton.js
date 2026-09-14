import { framingAllowsMatch } from './heuristics.js';
import { isWeakPhrase } from './weak-tokens.js';

const WEAK_LEADERS = new Set(['the', 'a', 'an', 'my', 'your', 'our', 'their', 'his', 'her', 'its']);

function isWeakLedShort(norms) {
  return norms.length === 2 && WEAK_LEADERS.has(norms[0]);
}

const MAGIC = 0x4e454343; // "CCEN" little-endian
export const CATALOG_VERSION = 1;

export const KIND_CODES = {
  artist: 0,
  work: 1,
  album: 2,
  franchise: 3,
  trademark: 4,
};

export const KIND_NAMES = ['artist', 'work', 'album', 'franchise', 'trademark'];

const KIND_REASON = {
  artist: 'cataloged artist',
  work: 'cataloged work title',
  album: 'cataloged album title',
  franchise: 'cataloged franchise',
  trademark: 'cataloged trademark',
};

const KIND_VERDICT = {
  artist: 'review',
  work: 'block',
  album: 'block',
  franchise: 'block',
  trademark: 'block',
};

function packMeta(kind, verdict, commonWord) {
  const kindCode = KIND_CODES[kind] ?? 1;
  const verdictBit = verdict === 'block' ? 1 : 0;
  return kindCode | (verdictBit << 3) | (commonWord ? 1 << 4 : 0);
}

function unpackMeta(bits) {
  const kind = KIND_NAMES[bits & 7] ?? 'work';
  const verdict = bits & 8 ? 'block' : 'review';
  const commonWord = Boolean(bits & 16);
  return { kind, verdict, commonWord };
}

function mergeMeta(existing, incoming) {
  const a = unpackMeta(existing);
  const b = unpackMeta(incoming);
  const verdict = a.verdict === 'block' || b.verdict === 'block' ? 'block' : 'review';
  const kind = verdict === 'block' && a.verdict !== 'block' ? b.kind : a.kind;
  return packMeta(kind, verdict, a.commonWord || b.commonWord);
}

/**
 * Build a token-level Aho-Corasick automaton.
 * @param {Array<{ tokens: string[], kind: string, verdict?: string, commonWord?: boolean }>} entries
 */
export function compileAutomaton(entries) {
  const tokenToId = new Map();
  const tokenList = [];
  const intern = (token) => {
    let id = tokenToId.get(token);
    if (id === undefined) {
      id = tokenList.length;
      tokenList.push(token);
      tokenToId.set(token, id);
    }
    return id;
  };

  const nodes = [{ edges: new Map(), fail: 0, out: -1 }];
  const patterns = [];
  const patternLengths = [];

  for (const entry of entries) {
    if (!entry.tokens?.length) continue;
    const ids = entry.tokens.map(intern);
    let node = 0;
    for (const id of ids) {
      if (!nodes[node].edges.has(id)) {
        nodes[node].edges.set(id, nodes.length);
        nodes.push({ edges: new Map(), fail: 0, out: -1 });
      }
      node = nodes[node].edges.get(id);
    }
    const kind = entry.kind in KIND_CODES ? entry.kind : 'work';
    const verdict = entry.verdict ?? KIND_VERDICT[kind];
    const packed = packMeta(kind, verdict, Boolean(entry.commonWord));
    if (nodes[node].out === -1) {
      nodes[node].out = patterns.length;
      patterns.push(packed);
      patternLengths.push(ids.length);
    } else {
      patterns[nodes[node].out] = mergeMeta(patterns[nodes[node].out], packed);
    }
  }

  const queue = [];
  for (const [, next] of nodes[0].edges) {
    nodes[next].fail = 0;
    queue.push(next);
  }
  while (queue.length) {
    const current = queue.shift();
    for (const [id, next] of nodes[current].edges) {
      queue.push(next);
      let fail = nodes[current].fail;
      while (fail && !nodes[fail].edges.has(id)) fail = nodes[fail].fail;
      const fallback = nodes[fail].edges.get(id);
      nodes[next].fail = fallback === undefined || fallback === next ? 0 : fallback;
    }
  }

  return {
    tokenList,
    tokenToId,
    nodes,
    patterns,
    patternLengths,
  };
}

/**
 * @param {ReturnType<typeof compileAutomaton>} model
 * @returns {Uint8Array}
 */
export function serializeAutomaton(model) {
  const { tokenList, nodes, patterns, patternLengths } = model;
  const tokenBlob = new TextEncoder().encode(`${tokenList.join('\0')}\0`);
  const tokenOffsets = new Uint32Array(tokenList.length);
  let cursor = 0;
  for (let i = 0; i < tokenList.length; i += 1) {
    tokenOffsets[i] = cursor;
    cursor += new TextEncoder().encode(tokenList[i]).length + 1;
  }

  let edgeCount = 0;
  for (const node of nodes) edgeCount += node.edges.size;
  const edgeToken = new Uint32Array(edgeCount);
  const edgeNext = new Uint32Array(edgeCount);
  const edgeStart = new Uint32Array(nodes.length + 1);
  const nodeFail = new Uint32Array(nodes.length);
  const nodeOut = new Int32Array(nodes.length);
  let e = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    edgeStart[i] = e;
    const pairs = [...nodes[i].edges.entries()].sort((a, b) => a[0] - b[0]);
    for (const [id, next] of pairs) {
      edgeToken[e] = id;
      edgeNext[e] = next;
      e += 1;
    }
    nodeFail[i] = nodes[i].fail;
    nodeOut[i] = nodes[i].out;
  }
  edgeStart[nodes.length] = e;

  const header = 32;
  const lengths = Uint8Array.from(patternLengths);
  const bytes =
    header +
    tokenBlob.length +
    tokenOffsets.byteLength +
    patterns.length +
    lengths.length +
    edgeToken.byteLength +
    edgeNext.byteLength +
    edgeStart.byteLength +
    nodeFail.byteLength +
    nodeOut.byteLength +
    16;

  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, CATALOG_VERSION, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, tokenList.length, true);
  view.setUint32(12, patterns.length, true);
  view.setUint32(16, nodes.length, true);
  view.setUint32(20, edgeCount, true);
  view.setUint32(24, tokenBlob.length, true);
  view.setUint32(28, 0, true);

  let offset = header;
  out.set(tokenBlob, offset);
  offset += tokenBlob.length;
  offset = writeU32(view, offset, tokenOffsets);
  out.set(Uint8Array.from(patterns), offset);
  offset += patterns.length;
  out.set(lengths, offset);
  offset += lengths.length;
  offset = align4(offset);
  offset = writeU32(view, offset, edgeToken);
  offset = writeU32(view, offset, edgeNext);
  offset = writeU32(view, offset, edgeStart);
  offset = writeU32(view, offset, nodeFail);
  offset = writeI32(view, offset, nodeOut);
  return out.subarray(0, offset);
}

function align4(value) {
  return (value + 3) & ~3;
}

function writeU32(view, offset, arr) {
  for (let i = 0; i < arr.length; i += 1) view.setUint32(offset + i * 4, arr[i], true);
  return offset + arr.length * 4;
}

function writeI32(view, offset, arr) {
  for (let i = 0; i < arr.length; i += 1) view.setInt32(offset + i * 4, arr[i], true);
  return offset + arr.length * 4;
}

function readU32(view, offset, count) {
  const arr = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) arr[i] = view.getUint32(offset + i * 4, true);
  return arr;
}

function readI32(view, offset, count) {
  const arr = new Int32Array(count);
  for (let i = 0; i < count; i += 1) arr[i] = view.getInt32(offset + i * 4, true);
  return arr;
}

/**
 * @param {Uint8Array} bytes
 */
export function parseAutomaton(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) {
    throw new Error('invalid catalog magic');
  }
  if (view.getUint16(4, true) !== CATALOG_VERSION) {
    throw new Error('unsupported catalog version');
  }
  const nTokens = view.getUint32(8, true);
  const nPatterns = view.getUint32(12, true);
  const nNodes = view.getUint32(16, true);
  const nEdges = view.getUint32(20, true);
  const blobLen = view.getUint32(24, true);

  let offset = 32;
  const blob = bytes.subarray(offset, offset + blobLen);
  offset += blobLen;
  const decoder = new TextDecoder();
  const tokenList = [];
  const tokenToId = new Map();
  let start = 0;
  for (let i = 0; i < blob.length; i += 1) {
    if (blob[i] === 0) {
      if (i > start) {
        const token = decoder.decode(blob.subarray(start, i));
        tokenToId.set(token, tokenList.length);
        tokenList.push(token);
      }
      start = i + 1;
    }
  }
  if (tokenList.length !== nTokens) {
    throw new Error(`catalog token count mismatch (${tokenList.length} != ${nTokens})`);
  }
  offset += nTokens * 4;
  const patterns = Array.from(bytes.subarray(offset, offset + nPatterns));
  offset += nPatterns;
  const patternLengths = Array.from(bytes.subarray(offset, offset + nPatterns));
  offset += nPatterns;
  offset = align4(offset);
  const edgeToken = readU32(view, offset, nEdges);
  offset += nEdges * 4;
  const edgeNext = readU32(view, offset, nEdges);
  offset += nEdges * 4;
  const edgeStart = readU32(view, offset, nNodes + 1);
  offset += (nNodes + 1) * 4;
  const nodeFail = readU32(view, offset, nNodes);
  offset += nNodes * 4;
  const nodeOut = readI32(view, offset, nNodes);

  return {
    tokenList,
    tokenToId,
    patterns,
    patternLengths,
    edgeToken,
    edgeNext,
    edgeStart,
    nodeFail,
    nodeOut,
    stats: {
      tokens: nTokens,
      patterns: nPatterns,
      nodes: nNodes,
      edges: nEdges,
      bytes: bytes.byteLength,
    },
  };
}

function childOf(model, node, tokenId) {
  let lo = model.edgeStart[node];
  let hi = model.edgeStart[node + 1] - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = model.edgeToken[mid];
    if (value === tokenId) return model.edgeNext[mid];
    if (value < tokenId) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

function transition(model, state, tokenId) {
  let current = state;
  while (true) {
    const next = childOf(model, current, tokenId);
    if (next !== -1) return next;
    if (current === 0) return 0;
    current = model.nodeFail[current];
  }
}

function emitFrom(model, state, emit) {
  let current = state;
  while (current) {
    const out = model.nodeOut[current];
    if (out >= 0) emit(out);
    current = model.nodeFail[current];
  }
}

/**
 * Match token sequences and return character spans into `text`.
 * @param {ReturnType<typeof parseAutomaton>} model
 * @param {string} text
 * @param {Array<{ start: number, end: number, text: string, norm: string }>} tokens
 * @param {Set<string>} allowSet
 * @param {Set<string>} [commonPhrases] overlay phrases marked commonWord
 */
export function findCatalogSpans(model, text, tokens, allowSet, commonPhrases) {
  const spans = [];
  if (!tokens.length || !model?.tokenToId) return spans;

  let state = 0;

  const pushMatch = (patternIndex, endIndex) => {
    const meta = unpackMeta(model.patterns[patternIndex]);
    const length = model.patternLengths[patternIndex] || 0;
    if (!length || endIndex - length + 1 < 0) return;
    const startIndex = endIndex - length + 1;
    const start = tokens[startIndex].start;
    const end = tokens[endIndex].end;
    const matchedNorms = tokens.slice(startIndex, endIndex + 1).map((token) => token.norm);
    const phrase = matchedNorms.join(' ');
    if (allowSet?.has(phrase) || allowSet?.has(tokens[endIndex].norm)) return;
    const needs =
      meta.commonWord ||
      length === 1 ||
      isWeakPhrase(matchedNorms) ||
      isWeakLedShort(matchedNorms) ||
      Boolean(commonPhrases?.has(phrase));
    if (needs && !framingAllowsMatch(tokens, startIndex, length, meta.kind)) return;
    spans.push({
      start,
      end,
      text: text.slice(start, end),
      verdict: meta.verdict,
      reason: KIND_REASON[meta.kind],
      kind: meta.kind,
    });
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const id = model.tokenToId.get(tokens[i].norm);
    if (id === undefined) {
      state = 0;
      continue;
    }
    state = transition(model, state, id);
    emitFrom(model, state, (patternIndex) => pushMatch(patternIndex, i));
  }
  return spans;
}

export function emptyAutomaton() {
  return parseAutomaton(serializeAutomaton(compileAutomaton([])));
}

export function catalogStats(model) {
  return model?.stats ?? { tokens: 0, patterns: 0, nodes: 0, edges: 0, bytes: 0 };
}
