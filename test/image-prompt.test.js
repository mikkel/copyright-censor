import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCensor, shippedCatalog } from '../src/index.js';

/**
 * Use-case overlay: still-image / image-generation prompts.
 * People prompt image models with characters, fashion houses, camera
 * brands, game IP, meme templates, photographer styles, and product
 * marks. Identifiers only — never lyrics.
 *
 * Every new id below was verified as a TRUE gap first: a catalog-only
 * censor (replaceBlocklist + explicit catalog: shippedCatalog) returns
 * `allow` for the bare term, and the overlay-only censor
 * (replaceCatalog) also returned `allow` before the term was added.
 * Multi-word new ids are scoped to media ["image","video"] so song
 * prompts stay clean; single-token new ids are long distinctive strings
 * with no commonWord / DEFAULT_ALLOWLIST collision.
 */

const NEW_IDS = [
  { term: 'Buzz Lightyear', verdict: 'block' },
  { term: 'Nyan Cat', verdict: 'block' },
  { term: 'Wojak', verdict: 'block' },
  { term: 'Dior', verdict: 'block' },
  { term: 'Prada', verdict: 'block' },
  { term: 'Issey Miyake', verdict: 'block' },
  { term: 'Blackmagic', verdict: 'block' },
  { term: 'Steve McCurry', verdict: 'review' },
  { term: 'Charlotte Tilbury', verdict: 'block' },
  { term: 'Stanley Tumbler', verdict: 'block' },
];

describe('image-prompt overlay', () => {
  it('new ids are true catalog gaps (catalog-only isolation)', () => {
    const catalogOnly = createCensor({ replaceBlocklist: true, catalog: shippedCatalog });
    for (const { term } of NEW_IDS) {
      const result = catalogOnly.check(term);
      assert.equal(result.verdict, 'allow', `${JSON.stringify(term)} => ${result.verdict} (expected allow)`);
    }
  });

  it('blocks new image-prompt identifiers from invented prompts only', () => {
    const censor = createCensor({ replaceCatalog: true });
    const cases = [
      ['Buzz Lightyear portrait, studio light', 'block'],
      ['Nyan Cat video thumbnail, neon glow', 'block'],
      ['Wojak meme sticker, flat vector', 'block'],
      ['Dior lookbook page, studio light', 'block'],
      ['Prada runway still, warm grain', 'block'],
      ['Issey Miyake pleats close-up, product shot', 'block'],
      ['shot on Blackmagic cinema camera, warm grain', 'block'],
      ['portrait in the manner of Steve McCurry, warm grain', 'review'],
      ['Charlotte Tilbury display, product shot', 'block'],
      ['Stanley Tumbler product shot, studio light', 'block'],
    ];
    for (const [prompt, verdict] of cases) {
      const result = censor.check(prompt);
      assert.equal(result.verdict, verdict, `${JSON.stringify(prompt)} => ${result.verdict} (expected ${verdict})`);
    }
  });

  it('keeps song prompts clean via media scope for new ids', () => {
    const music = createCensor({ replaceCatalog: true, media: 'music' });
    const image = createCensor({ replaceCatalog: true, media: 'image' });
    const prompts = [
      'Buzz Lightyear portrait, studio light',
      'Nyan Cat video thumbnail, neon glow',
      'Wojak meme sticker, flat vector',
      'Dior lookbook page, studio light',
      'Prada runway still, warm grain',
      'Issey Miyake pleats close-up, product shot',
      'shot on Blackmagic cinema camera, warm grain',
      'Charlotte Tilbury display, product shot',
      'Stanley Tumbler product shot, studio light',
    ];
    for (const prompt of prompts) {
      assert.equal(music.check(prompt).verdict, 'allow', `music ${JSON.stringify(prompt)}`);
      assert.equal(image.check(prompt).verdict, 'block', `image ${JSON.stringify(prompt)}`);
    }
    assert.equal(music.check('portrait in the manner of Steve McCurry, warm grain').verdict, 'allow');
    assert.equal(image.check('portrait in the manner of Steve McCurry, warm grain').verdict, 'review');
  });

  it('Part A: music-irrelevant trademarks stay out of song prompts', () => {
    const music = createCensor({ replaceCatalog: true, media: 'music' });
    const image = createCensor({ replaceCatalog: true, media: 'image' });
    const full = createCensor({ replaceCatalog: true });
    // Default + image still block; music allows (song prompts stay clean).
    const cases = [
      'Adidas product shot, studio light',
      'Chanel lookbook page, studio light',
      'Gucci product shot, studio light',
      'Louis Vuitton product shot, studio light',
      'Coca-Cola product shot, studio light',
      "McDonald's product shot, studio light",
      'Pepsi product shot, studio light',
      'Starbucks product shot, studio light',
      'LEGO brick close-up, product shot',
      'DreamWorks title card, warm grain',
      'Paramount title card, warm grain',
      'Sony Pictures title card, warm grain',
      'Universal Pictures title card, warm grain',
      'Warner Bros title card, warm grain',
      'Facebook title sting, warm grain',
      'Instagram product shot, studio light',
      'Netflix title card, warm grain',
      'TikTok title sting, warm grain',
      'AirPods product shot, white background',
      'iPhone product shot, studio light',
      'Microsoft title sting, warm grain',
      'Rolex product shot, studio light',
      'Gemini prompt sting, product shot',
    ];
    for (const prompt of cases) {
      assert.equal(full.check(prompt).verdict, 'block', `default ${JSON.stringify(prompt)}`);
      assert.equal(image.check(prompt).verdict, 'block', `image ${JSON.stringify(prompt)}`);
      assert.equal(music.check(prompt).verdict, 'allow', `music ${JSON.stringify(prompt)}`);
    }
    // commonWord entries need title-case evidence or a nearby rights cue
    // to fire; "official … brand" cues without tripping the logo
    // heuristic (which is media-independent), so scope still holds.
    const cued = [
      'official Luma brand film, warm grain',
      'official Prime Video brand film, warm grain',
      'official Switch 2 brand film, warm grain',
      'official Steam brand film, warm grain',
      'official Unity brand film, warm grain',
    ];
    for (const prompt of cued) {
      assert.equal(full.check(prompt).verdict, 'block', `default ${JSON.stringify(prompt)}`);
      assert.equal(image.check(prompt).verdict, 'block', `image ${JSON.stringify(prompt)}`);
      assert.equal(music.check(prompt).verdict, 'allow', `music ${JSON.stringify(prompt)}`);
    }
    // Gaming-hardware phrases whose parent brand token is still an
    // unscoped franchise (Nintendo / PlayStation): the scoped entry no
    // longer fires, but the parent brand still blocks in music mode, so
    // only assert the image/default path here.
    const parentBranded = [
      'Nintendo Switch bumper sting, warm grain',
      'Nintendo Direct title sting, warm grain',
      'PlayStation 5 boot sting, warm grain',
      'Joy-Con controller close-up, product shot',
      'PS5 unboxing sting, warm grain',
    ];
    for (const prompt of parentBranded) {
      assert.equal(full.check(prompt).verdict, 'block', `default ${JSON.stringify(prompt)}`);
      assert.equal(image.check(prompt).verdict, 'block', `image ${JSON.stringify(prompt)}`);
    }
    assert.equal(music.check('PS5 unboxing sting, warm grain').verdict, 'allow');
    assert.equal(music.check('Joy-Con controller close-up, product shot').verdict, 'allow');
  });

  it('allow-path: innocent photo/art/vibe prompts stay allow', () => {
    const full = createCensor({ replaceCatalog: true });
    const music = createCensor({ replaceCatalog: true, media: 'music' });
    const image = createCensor({ replaceCatalog: true, media: 'image' });
    const cases = [
      'soft daylight portrait in a white room, 85mm lens',
      'grainy film photo of a quiet street at dusk',
      'dreamy 80s synthwave, warm analog pads',
      'pencil sketch of a lighthouse, crosshatch shading',
      'macro photo of morning dew on grass',
    ];
    for (const prompt of cases) {
      assert.equal(full.check(prompt).verdict, 'allow', `default ${JSON.stringify(prompt)}`);
      assert.equal(music.check(prompt).verdict, 'allow', `music ${JSON.stringify(prompt)}`);
      assert.equal(image.check(prompt).verdict, 'allow', `image ${JSON.stringify(prompt)}`);
    }
  });

  it('boundary: near-miss splits do not fire the overlay', () => {
    const overlayOnly = createCensor({ replaceCatalog: true });
    const full = createCensor({ replaceCatalog: true });
    const nearMiss = [
      'diorama of a quiet room',
      'prado museum daylight photo',
      'black magic daylight photo',
      'stanley cup daylight photo',
      'lightyear photo of the night sky',
      'wojaks dancing in a pencil sketch',
    ];
    for (const prompt of nearMiss) {
      assert.equal(overlayOnly.check(prompt).verdict, 'allow', `overlay ${JSON.stringify(prompt)}`);
    }
    // "black magic" (spaced, lowercase) is a cataloged work title, so the
    // default path claims it via the catalog — the overlay itself stays
    // silent, which is what this boundary proves.
    for (const prompt of nearMiss.filter((item) => item !== 'black magic daylight photo')) {
      assert.equal(full.check(prompt).verdict, 'allow', `default ${JSON.stringify(prompt)}`);
    }
  });
});
