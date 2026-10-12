export type Verdict = 'allow' | 'review' | 'block';
export type MediaKind = 'music' | 'image' | 'video' | 'all';
export type EntryKind = 'artist' | 'work' | 'franchise' | 'trademark' | 'custom' | 'heuristic' | string;

export interface Span {
  start: number;
  end: number;
  text: string;
  verdict: Verdict;
  reason: string;
  kind?: EntryKind;
  field?: 'positive' | 'negative';
}

export interface CheckResult {
  verdict: Verdict;
  spans: Span[];
  reasons: string[];
}

export interface PairResult {
  verdict: Verdict;
  positive: CheckResult;
  negative: CheckResult;
  reasons: string[];
  spans: Array<Span & { field: 'positive' | 'negative' }>;
}

export interface BlocklistEntry {
  term: string;
  kind?: EntryKind;
  verdict?: Verdict;
  reason?: string;
  aliases?: string[];
  media?: MediaKind[];
  commonWord?: boolean;
  /** Fire only when one of these phrases also appears in the prompt. */
  requires?: string[];
}

export interface Blocklist {
  version?: number;
  artists?: Array<string | BlocklistEntry>;
  works?: Array<string | BlocklistEntry>;
  franchises?: Array<string | BlocklistEntry>;
  trademarks?: Array<string | BlocklistEntry>;
  entries?: Array<string | BlocklistEntry>;
}

export interface CensorOptions {
  /** Merged on top of the compiled catalog and extras overlay unless `replaceBlocklist` is set. */
  blocklist?: Blocklist | Array<string | BlocklistEntry>;
  replaceBlocklist?: boolean;
  replaceCatalog?: boolean;
  catalog?: CatalogModel;
  extraTerms?: Array<string | BlocklistEntry>;
  media?: MediaKind;
  allowlist?: string[];
}

export interface Censor {
  check(text: unknown): CheckResult;
  checkPair(pair?: { positive?: unknown; negative?: unknown }): PairResult;
  blocklist: Blocklist;
  entries: Array<BlocklistEntry & { tokens: string[] }>;
  catalogStats: CatalogStats | null;
}

export interface CatalogStats {
  tokens: number;
  patterns: number;
  nodes: number;
  edges: number;
  bytes: number;
}

export interface CatalogModel {
  tokenToId: Map<string, number>;
  patterns: number[];
  patternLengths: number[];
  stats: CatalogStats;
}

export const VERDICTS: {
  readonly ALLOW: 'allow';
  readonly REVIEW: 'review';
  readonly BLOCK: 'block';
};

export const VERDICT_RANK: Record<Verdict, number>;
export const DEFAULT_ALLOWLIST: string[];
export const defaultBlocklist: Blocklist;
export const catalogMeta: CatalogStats;
export const shippedCatalog: CatalogModel;

export function check(text: unknown, options?: CensorOptions): CheckResult;
export function checkPair(
  pair: { positive?: unknown; negative?: unknown },
  options?: CensorOptions,
): PairResult;
export function createCensor(options?: CensorOptions): Censor;
export function emptyBlocklist(): Blocklist;
export function mergeBlocklists(base?: unknown, extra?: unknown): Blocklist;
export function flattenBlocklist(input?: unknown): Array<BlocklistEntry & { tokens: string[] }>;
export function worstVerdict(...verdicts: Array<Verdict | null | undefined>): Verdict;
export function tokenize(text: string): Array<{
  start: number;
  end: number;
  text: string;
  norm: string;
}>;
export function normalizeToken(value: string): string;

declare const copyrightCensor: {
  check: typeof check;
  checkPair: typeof checkPair;
  createCensor: typeof createCensor;
  defaultBlocklist: typeof defaultBlocklist;
  emptyBlocklist: typeof emptyBlocklist;
  mergeBlocklists: typeof mergeBlocklists;
  VERDICTS: typeof VERDICTS;
  worstVerdict: typeof worstVerdict;
};

export default copyrightCensor;
