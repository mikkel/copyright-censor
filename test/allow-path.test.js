import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCensor } from '../src/index.js';
import { inventedCensor } from './helpers.js';

const overlay = createCensor({ replaceCatalog: true });
const full = createCensor();

function assertAllow(censor, prompt, label) {
  const result = censor.check(prompt);
  assert.equal(
    result.verdict,
    'allow',
    `${label} ${JSON.stringify(prompt)} => ${result.verdict} (${result.reasons.join('; ')}) spans=${JSON.stringify(result.spans.map((span) => span.text))}`,
  );
}

describe('allow-path / innocent usage', () => {
  const vibePrompts = [
    'warm tape lo-fi drums',
    'jangly guitar take',
    'bar-room guitar',
    'synth stab',
    'late-night keys',
    'soft tape vocal',
    'cheap speakers bounce',
    'analog bus stacked chorus',
    'dusty cassette, no crowd noise',
    'melancholic jazz piano, intimate vocal air',
  ];

  const directionPrompts = [
    'make it dreamier',
    'more 80s reverb',
    'less harsh highs',
    'film grain',
    'cinematic pads',
    'dreamy 80s synthwave, warm analog pads',
  ];

  const objectPrompts = [
    'add a faint grenade thud under the kick',
    'toss a grenade into the foley bed',
    'kryptonite green lighting on the pad',
    'morning dew on the grass, field recording',
    'iris of the camera, slow zoom',
    'a wonderwall of stacked pads',
    'rain on me from the ceiling mics',
    'dont rain on me with extra reverb',
    'a sign of the times in the mix',
    '7 rings of reverb around the snare',
    'orbiter drone, slow sweep',
    'midnight sun through the window mics',
    'drop dead gorgeous vocal air',
    'be her friend on the chorus stack',
  ];

  const nearMissPrompts = [
    'go-go boots rhythm',
    'pistol snare crack',
    'baby bounce on cheap speakers',
    'miami night pads',
    'combs through the mix',
    'tems? wait no, tempos',
  ];

  it('keeps genre / vibe / production prompts allow on the extras overlay', () => {
    for (const prompt of vibePrompts) {
      assertAllow(overlay, prompt, 'overlay vibe');
    }
  });

  it('keeps generic creative-direction prompts allow on the extras overlay', () => {
    for (const prompt of directionPrompts) {
      assertAllow(overlay, prompt, 'overlay direction');
    }
  });

  it('keeps ordinary-English overlaps allow when they are objects or weather', () => {
    for (const prompt of objectPrompts) {
      assertAllow(overlay, prompt, 'overlay object');
    }
  });

  it('does not trip on near-miss substrings of new artist/work tokens', () => {
    for (const prompt of nearMissPrompts) {
      assertAllow(overlay, prompt, 'overlay near-miss');
    }
  });

  it('keeps the same innocent prompts allow on the default catalog path', () => {
    const prompts = [...vibePrompts, ...directionPrompts, ...objectPrompts, ...nearMissPrompts];
    for (const prompt of prompts) {
      assertAllow(full, prompt, 'full-path');
    }
  });

  it('still allows public-domain and invented wrapper strings', () => {
    assertAllow(inventedCensor(), 'Mary had a little lamb, little lamb, little lamb', 'invented PD');
    assertAllow(inventedCensor(), 'dreamy 80s synthwave, warm analog pads, melancholic jazz', 'invented vibe');
    assertAllow(inventedCensor(), 'make it sound "warm and foggy" tonight', 'invented short quote');
    assertAllow(full, 'Mary had a little lamb, little lamb, little lamb', 'full PD');
  });

  it('still blocks explicit BMG / Hot 100 title prompts', () => {
    const cases = [
      'make it sound like Sympathy for the Devil',
      'lyrics of 7 Rings vibe',
      'Anarchy in the UK guitar take',
      'the song Grenade on analog tape',
      'the song Kryptonite on analog tape',
      'Morning Dew arrangement, soft tape',
      'Rain on Me synth stab',
      'Sign of the Times piano sketch',
      'the Orbiter song demo',
      'the song Wonderwall on analog tape',
    ];
    for (const prompt of cases) {
      const result = overlay.check(prompt);
      assert.equal(result.verdict, 'block', `${JSON.stringify(prompt)} => ${result.verdict}`);
    }
  });

  it('still catches explicit titles and artists on the default catalog path', () => {
    assert.equal(full.check('make it sound like Sympathy for the Devil').verdict, 'block');
    assert.equal(full.check('Anarchy in the UK guitar take').verdict, 'block');
    assert.equal(full.check('the song Grenade on analog tape').verdict, 'block');
    assert.equal(full.check("The Go-Go's jangly guitar take").verdict, 'review');
    assert.equal(full.check('Motley Crue stacked chorus, analog bus').verdict, 'review');
  });

  it('still reviews explicit new artist prompts', () => {
    const cases = [
      "The Go-Go's jangly guitar take",
      'Go Gos arrangement with tape hiss',
      'Sex Pistols gang vocals on analog tape',
      'Motley Crue stacked chorus, analog bus',
      'Tems stacked chorus, analog bus',
      'Luke Combs bar-room guitar',
      'Sam Fender guitar take',
    ];
    for (const prompt of cases) {
      const result = overlay.check(prompt);
      assert.equal(result.verdict, 'review', `${JSON.stringify(prompt)} => ${result.verdict}`);
    }
  });
});
