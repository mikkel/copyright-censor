# copyright-censor

Preemptive copyright/trademark string check for music (and image/video) slider prompts.

The library is a **conservative filter**: high recall, false positives are acceptable, false negatives are not. It is **not legal advice**, not a takedown engine, and not a pirate tool. It never ships copyrighted lyrics and never scrapes lyric sites.

A concept-slider UI can call `check()` on every keystroke and highlight the exact words that look risky.

## Live demo

GitHub Pages: [difflabai.github.io/copyright-censor](https://difflabai.github.io/copyright-censor/)

Local (from repo root so ESM + the gzip catalog resolve):

```bash
npm run demo
```

Open [http://localhost:4173/](http://localhost:4173/) or [http://localhost:4173/demo/](http://localhost:4173/demo/). Sample chips cover allow / review / block (chart titles, franchises, reproduce-this heuristics).

## Policy

| Prompt | Verdict |
| --- | --- |
| Generic mood / era / production language (`dreamy 80s synthwave`) | `allow` |
| Cataloged artist, no specific work (`in the style of …`) | `review` |
| Specific cataloged work, franchise, trademark, or “reproduce this” phrasing | `block` |

Overall verdict is the worst span: `block` > `review` > `allow`.

## How coverage works

`check()` does **not** scan a 200-row JSON list. At build time, public **identifier** datasets are compiled into a compact token-level Aho-Corasick automaton (`data/catalog.bin.gz`):

- MusicBrainz artist names (CC0 extract)
- MusicBrainz recording titles (title field only)
- TV / game / anime / manga **names**
- Wikidata labels for media franchises, film series, video-game series, fictional universes

Rebuild with `npm run build-catalog`. The default `check()` path is still **synchronous and local** — the shipped gzip is loaded once at import, then every keystroke walks the automaton. No network at `check()` time. An optional rebuild/refresh exists only as a maintainer script.

This is high-recall coverage of **cataloged identifiers**, not a legal oracle and not 100% of every copyrighted sentence ever written. Unknown works, unpublished titles, and generic lyric lines will not match unless a heuristic fires.

Identifiers only. The compile step never reads synopsis, plot, or lyric columns.

## Install

```bash
npm install copyright-censor
```

ESM only, browser + Node 20.10+, no runtime dependencies.

## API

```js
import { check, checkPair, createCensor, catalogMeta } from 'copyright-censor';

catalogMeta.patterns; // compiled identifier count

check('dreamy 80s synthwave');
// { verdict: 'allow', spans: [], reasons: [] }

checkPair({
  positive: 'warm analog pads',
  negative: 'no Neon Glass Harbor',
});
```

`spans` are **character offsets into the original string**, so a textarea or contenteditable can mark words live.

### `check(text, options?)`

Returns `{ verdict, spans, reasons }`.

### `checkPair({ positive, negative }, options?)`

Checks both slider fields. Worst verdict wins. Each span also has `field: 'positive' | 'negative'`.

### `createCensor(options?)`

Load the automaton once, then call `censor.check()` / `censor.checkPair()` on every keystroke.

```js
const censor = createCensor({
  blocklist: myJson,          // extra identifiers merged onto the catalog
  extraTerms: [{ term: 'My Label Artist', kind: 'artist' }],
  media: 'music',             // or 'image' | 'video' | 'all'
  allowlist: ['harbor'],      // never flag these phrases
});
```

Set `replaceBlocklist: true` / `replaceCatalog: true` to ignore the shipped extras / compiled catalog (useful in tests).

### Options

| Option | Meaning |
| --- | --- |
| `blocklist` | User JSON extras. Merged onto the catalog. |
| `replaceBlocklist` | Ignore shipped extras **and** the compiled catalog. |
| `replaceCatalog` | Ignore the compiled catalog only. |
| `extraTerms` | Extra `{ term, kind, verdict? }` rows. |
| `media` | Drop overlay entries that do not apply. |
| `allowlist` | Extra mood/era phrases that must never flag. |

## Extras JSON

`data/blocklist.json` is an optional overlay, not the engine. Edit it or pass your own:

```json
{
  "artists": ["Zorblin Faye", { "term": "Queen", "commonWord": true }],
  "works": ["Neon Glass Harbor"],
  "franchises": ["Crystal Finch Saga"],
  "trademarks": [{ "term": "Lumistitch", "media": ["image", "video"] }]
}
```

- **artists** default to `review`
- **works / franchises / trademarks** default to `block`
- `commonWord: true` only flags a capitalized token or a nearby rights cue
- `requires: ["Artist Name"]` only flags the term when one of those phrases also appears (artist or other context). Title case alone does not fire
- Single-token common English **work** titles are dropped at compile time (`love`, `home`, `stay`) so the slider stays usable
- Matching is word-boundary, case-insensitive, accent-folded

**Do not add copyrighted lyrics.** Titles, names, and franchise labels only.

## Heuristics (no stored lyrics)

These fire without a catalog hit:

- Reproduction: `cover of`, `lyrics from`, `word for word`, `recreate the song`, `chorus:`, `screenshot from`, …
- Likeness: `in the style of`, `inspired by`, `voice of`, `official logo`
- `AI cover` together with a listed artist name (bare "AI cover" or "AI cover letter" does not fire)
- A long quoted passage (8+ words) is treated as a pasted lyric-like excerpt — tests use invented or public-domain strings only

## CLI

```bash
npx copyright-censor "dreamy 80s synthwave"
npx copyright-censor --json "cover of Whispering Shadows"
npx copyright-censor --positive "warm pads" --negative "no crowd noise"
npx copyright-censor --blocklist ./my-list.json --media music "…"
```

Exit codes: `0` allow, `1` review, `2` block, `64` usage.

## What this is not

- Not legal advice and not a guarantee you are clear to ship a generation
- Not a lyrics database, fingerprint, or Content ID replacement
- Not 100% of every copyrighted sentence — only cataloged identifiers plus intent heuristics
- Not a tool for finding, storing, or reproducing copyrighted works

If a lawsuit would wreck the product, treat `review` as “do not send to the model until a human looks at it,” and `block` as “do not send.”

## License

MIT
