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
    'tape-saturated folk stomp',
    'dusty vinyl crackle bed',
    'cathedral reverb tail',
    'muted trumpet air',
    'slowed trap bounce',
    'detuned choir swells',
    'phaser-heavy psych groove',
    'fingerpicked nylon intro',
    'sub-bass pulse under soft keys',
    'rainy rhodes, room tone',
    'glockenspiel sparkle, gentle strum',
    'flute loop with chopped choir',
    'slow strings swell, no vocal',
    'chorused twelve-string shimmer',
  ];

  const directionPrompts = [
    'make it dreamier',
    'more 80s reverb',
    'less harsh highs',
    'film grain',
    'cinematic pads',
    'dreamy 80s synthwave, warm analog pads',
    'slower build into the chorus',
    'strip it back to piano',
    'add vinyl crackle and hiss',
    'more room tone, less polish',
    'brighter master, tame the mud',
    'easy feel on the bridge',
    'switch to a minor key midway',
    'make the drums switch up halfway',
    'push the tempo to 128',
    'drier vocal, wider pads',
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
    'boston rain on the window mics',
    'leftover boston chowder in the green room',
    'a boston fern in the corner of the set',
    'dracula cape in the costume rack',
    'paper dracula teeth for the halloween sting',
    'nine to five shift whistle foley',
    'clocking nine to five warehouse ambience',
    'flip the pickup switch, second take',
    'a faulty light switch buzzing onsite',
    'something to lose, restless piano at midnight',
    'steamboat whistle foley with willie on harmonica',
    'a direct cinema cut, no captions',
    'forty hours of overtime, tired vocal take',
    'a thor cape prop on the workbench',
    'coco powder on the workbench, baking foley',
    'halo light rig, soft studio glow',
    'turned inside out, room tone',
    'toy storybook hour with kids, warm room',
    'the last of us left the room, quiet vocal',
    'boston cream donut in the green room',
    'boston terrier bark foley',
    'dracula parrot in the aviary ambience',
    'railroad switch yard ambience at dawn',
    'network switch hum in the server room',
    'nine-to-five traffic hum outside the booth',
    'grenadine syrup pour foley',
    'iris scanner beep foley',
    'a wall of canyon wonder reverb',
    'orbit decay drone swell',
    'loser bracket pinball foley at the arcade',
    'tired and jaded warehouse vocal at midnight',
    'farm animal foley, barn ambience',
    'her earrings clinked in the vocal booth',
    'the cure for the amp hum is less gain',
    'what you need is more room tone',
    'cinderella carriage prop on the set',
    'one piece of tape on the mic stand',
    'jolene nametag on the desk drawer',
    'oh yeah, push the fader up',
    'mid-atlantic ridge hydrophone foley',
    'universal reverb preset, large hall',
    'warner rainstorm field recording',
    'play the station break foley',
    'barbecue smoke ambience, grill foley',
    'barbed fence wire foley, high wind',
  ];

  const nearMissPrompts = [
    'go-go boots rhythm',
    'pistol snare crack',
    'baby bounce on cheap speakers',
    'miami night pads',
    'combs through the mix',
    'tems? wait no, tempos',
    'jude line the vocal booth with foam',
    'rusty bowstring fiddle texture',
    'enjoy conga breakdowns',
    'joyful conga layer under the hook',
    'vintage mason jar on the piano',
    'dolly in slowly, then part the curtains',
    'switch grass rustling, dry field mic',
    'a direct feed from the desk',
    'steam heat on the brass mic',
    'boss tone stack, crunch channel',
    'second switchback trail ambience',
    'how to lose the hum in the amp',
    'a moaning wind outside, night air',
    'spotty wifi foley, lo-fi bed',
    'a hobo campfire scene, warm grain',
    'sumo drums foley, taiko hit',
    'audio foley bed, room tone',
    'day by day field recording, slow build',
    'universal remote on the desk foley',
    'legacy console hum in the live room',
    'somber drone swell, dark pads',
    'my phone buzzes on the desk foley',
    'x box mic crate, roadie foley',
    'ps 5 mic positions, drum overheads',
    'street-pop mural on the brick wall',
  ];

  // Overlaps that stay allow on the extras overlay but trip pre-existing
  // single-word entries in the shipped catalog (e.g. "One Piece", "God",
  // "Dawn Chorus") — asserted overlay-only by design.
  const overlayOnlyPrompts = [
    'god of warbler dawn chorus, field recording',
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

  it('keeps one-piece-of-tape style overlaps allow on the overlay path', () => {
    // The shipped catalog already blocks the bare "One Piece" bigram; the
    // extras overlay (this file's scope) must not add its own trip here.
    assertAllow(overlay, 'one piece of tape on the desk', 'overlay one-piece');
    for (const prompt of overlayOnlyPrompts) {
      assertAllow(overlay, prompt, 'overlay-only near-miss');
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
      'the song Boston on analog tape',
      'Boston song sketch, Stella Lefty vocal',
      'the song Dracula on analog tape',
      'Something to Lose piano sketch',
      'the song 9 to 5 on piano',
      'Steamboat Willie title card, warm grain',
      'Nintendo Switch bumper sting',
      'Switch 2 unboxing sting, warm grain',
      'Joy-Con controller close-up, product shot',
      'Nintendo Direct title sting',
      'Jolene vocal cover, soft tape',
      'the song Loser on analog tape',
      'Jaded song sketch, tired vocal',
      'the song Animal on analog tape',
      'Earrings song sketch, soft tape',
      'Cinderella song sketch, soft tape',
      'The Cure synth sketch, cold reverb',
      'What You Need song sketch, soft tape',
      'Oh Yeah song sketch, soft tape',
      'Dai Dai perreo bounce sketch',
      'PlayStation startup sting, warm grain',
      'PlayStation 5 boot sting',
      'PS5 unboxing sting, warm grain',
      'DualSense controller close-up, product shot',
      'Xbox Series X boot sting',
      'Barbie dreamhouse title sting',
      'Gundam hangar sting, warm grain',
      'One Piece title sting, warm grain',
      'Suno watermark sting, warm grain',
      'Udio bounce sketch',
      'LEGO brick close-up, product shot',
      'Labubu unboxing sting, warm grain',
      'Pop Mart blind-box unboxing sting',
      'AirPods product shot, white background',
      'iPhone product shot, studio light',
      'Warner Music Group title sting',
      'Warner Music logo sting',
      'Universal Music Group title sting',
      'Atlantic Records title sting',
      'BMG logo sting, warm grain',
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
      'Judeline hook over warm pads',
      'rusowsky bounce on cheap speakers',
      'Dolly Parton choir stack, analog bus',
      'Vincent Mason guitar take',
      'Dominic Fike late-night keys',
      'Malcolm Todd soft tape vocal',
      'Koe Wetzel bar-room guitar',
      'Steve Lacy bass bounce sketch',
      'Shakira hook over warm pads',
      'Ty Dolla $ign late-night keys',
      'Ty Dolla Sign hook over warm pads',
      'sombr bedroom demo, soft tape',
    ];
    for (const prompt of cases) {
      const result = overlay.check(prompt);
      assert.equal(result.verdict, 'review', `${JSON.stringify(prompt)} => ${result.verdict}`);
    }
  });
});
