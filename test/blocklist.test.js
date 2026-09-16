import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCensor,
  defaultBlocklist,
  flattenBlocklist,
  mergeBlocklists,
} from '../src/index.js';

describe('blocklist', () => {
  it('ships an extras overlay without lyric fields', () => {
    assert.equal(typeof defaultBlocklist.version, 'number');
    const blob = JSON.stringify(defaultBlocklist).toLowerCase();
    assert.equal(blob.includes('verse 1'), false);
    assert.equal(blob.includes('chorus:'), false);
    assert.equal(blob.includes('"lyrics"'), false);
  });

  it('merges grouped lists and extra entries', () => {
    const merged = mergeBlocklists(
      { artists: ['Ada'] },
      { works: ['River Glass'], entries: [{ term: 'Nox', kind: 'trademark' }] },
    );
    assert.deepEqual(merged.artists, ['Ada']);
    assert.deepEqual(merged.works, ['River Glass']);
    assert.equal(merged.entries.length, 1);
  });

  it('drops leading articles so The Beatles-style terms hit the short form', () => {
    const entries = flattenBlocklist({ artists: ['The Silver Finch'] });
    assert.ok(entries.some((entry) => entry.tokens.join(' ') === 'silver finch'));
  });

  it('matches aliases and accent-folded spellings', () => {
    const censor = createCensor({
      replaceBlocklist: true,
      blocklist: {
        artists: [{ term: 'Beyoncé', aliases: ['Beyonce'] }],
        franchises: [{ term: 'Pokemon', aliases: ['Pokémon'] }],
      },
    });
    assert.equal(censor.check('beyonce-like vocals').verdict, 'review');
    assert.equal(censor.check('a Pokémon overworld theme').verdict, 'block');
  });

  it('lets an allowlist override a colliding custom term', () => {
    const censor = createCensor({
      replaceBlocklist: true,
      blocklist: { artists: ['dreamy'] },
      allowlist: ['dreamy'],
    });
    assert.equal(censor.check('dreamy pads').verdict, 'allow');
  });

  it('matches new overlay identifiers from invented prompts only', () => {
    const censor = createCensor({ replaceCatalog: true });
    const cases = [
      ['a Marvin Gaye groove on cheap speakers', 'review'],
      ['Bonnie Tyler vocal air over pads', 'review'],
      ['Goo Goo Dolls arrangement with tape hiss', 'review'],
      ['James Brown horns and a tight snare', 'review'],
      ['Bon Jovi gang vocals on analog tape', 'review'],
      ['Jim Steinman piano and stacked choir', 'review'],
      ['Mark Ronson brass stabs, dusty cassette', 'review'],
      ['Earth Wind & Fire horns, late night mix', 'review'],
      ['Ella Langley fiddle and dry vocal', 'review'],
      ['Morgan Wallen bar-room guitar', 'review'],
      ['Olivia Dean soft tape vocal', 'review'],
      ['Tame Impala phaser and muted drums', 'review'],
      ['JENNIE hook over warm pads', 'review'],
      ['KATSEYE stacked chorus, analog bus', 'review'],
      ['Stella Lefty pedal-steel demo', 'review'],
      ['PARTYNEXTDOOR late-night keys', 'review'],
      ['KAROL G perreo bounce on cheap speakers', 'review'],
      ['The Kinks jangly guitar take', 'review'],
      ['Dio operatic vocal over analog tape', 'review'],
      ['make it sound like Choosin Texas', 'block'],
      ['I Knew It I Knew You demo take', 'block'],
      ['Been By Now arrangement, soft tape', 'block'],
      ['Hate That I Made You Love Me sketch', 'block'],
      ['I Cannot wait — I Can\'t Love You Anymore', 'block'],
      ['Man I Need demo with dry vocal', 'block'],
      ['So Easy To Fall in Love sketch', 'block'],
      ['Be Her arrangement on analog tape', 'block'],
      ['Risk It All guitar take', 'block'],
      ['I Just Might piano sketch', 'block'],
      ['drop dead song sketch, tape hiss', 'block'],
      ['stupid song demo take', 'block'],
      ['Midnight Sun pads and soft choir', 'block'],
      ['Hootie Frutti bounce sketch', 'block'],
      ['Janice STFU demo take', 'block'],
      ['Babydoll arrangement on cheap speakers', 'block'],
      ['McArthur collab sketch', 'block'],
      ['Ain\'t No Mountain High Enough sketch', 'block'],
      ['All I Want for Christmas Is You sketch', 'block'],
      ['Eye of the Tiger guitar take', 'block'],
      ['Here Comes Santa Claus sketch', 'block'],
      ['Living On a Prayer gang vocal', 'block'],
      ['Paper Rings guitar take', 'block'],
      ['Great Balls of Fire piano take', 'block'],
      ['Ramblin\' Man guitar take', 'block'],
      ['Cruel Summer synth stab', 'block'],
      ['Twist and Shout gang vocal', 'block'],
      ['California Gurls bounce sketch', 'block'],
      ['We Belong Together vocal air', 'block'],
      ['Scars to Your Beautiful sketch', 'block'],
      ['Redbone bass and tape hiss', 'block'],
      ['Total Eclipse of the Heart choir', 'block'],
      ['I Feel Good horn stab', 'block'],
      ['the song Iris on analog tape', 'block'],
      ['the song Lola, jangly guitar take', 'block'],
      ['Holy Diver operatic vocal', 'block'],
      ['Got My Mind Set On You sketch', 'block'],
      ['Lucasfilm title card, warm grain', 'block'],
      ['Hanna-Barbera title sting', 'block'],
      ['Cartoon Network bumper sting', 'block'],
      ['Minions title sting', 'block'],
      ['Shrek swamp title sting', 'block'],
      ['Homer Simpson couch sting', 'block'],
      ['Han Solo cockpit sting', 'block'],
      ['The Go-Go\'s jangly guitar take', 'review'],
      ['Go Gos arrangement with tape hiss', 'review'],
      ['Sex Pistols gang vocals on analog tape', 'review'],
      ['Motley Crue stacked chorus, analog bus', 'review'],
      ['Mötley Crüe guitar take', 'review'],
      ['Luke Combs bar-room guitar', 'review'],
      ['Lil Baby bounce on cheap speakers', 'review'],
      ['Yung Miami hook over warm pads', 'review'],
      ['Noah Kahan soft tape vocal', 'review'],
      ['Zara Larsson synth stab', 'review'],
      ['Tems stacked chorus, analog bus', 'review'],
      ['Mac Miller late-night keys', 'review'],
      ['Burna Boy bounce sketch', 'review'],
      ['Sam Fender guitar take', 'review'],
      ['make it sound like Sympathy for the Devil', 'block'],
      ['Sign of the Times piano sketch', 'block'],
      ['Our Lips Are Sealed guitar take', 'block'],
      ['lyrics of 7 Rings vibe', 'block'],
      ['Anarchy in the UK guitar take', 'block'],
      ['Anarchy in the U.K. sketch', 'block'],
      ['Rain on Me synth stab', 'block'],
      ['the song Grenade on analog tape', 'block'],
      ['You Can\'t Always Get What You Want sketch', 'block'],
      ['Beauty and a Beat bounce sketch', 'block'],
      ['Kickstart My Heart guitar take', 'block'],
      ['Desolation Row arrangement, tape hiss', 'block'],
      ['What a Wonderful World sketch', 'block'],
      ['the song Kryptonite on analog tape', 'block'],
      ['BbY WOW bounce sketch', 'block'],
      ['BBY WOW arrangement on cheap speakers', 'block'],
      ['Be By You demo take', 'block'],
      ['Dead Fresh bounce sketch', 'block'],
      ['Spend Dat arrangement on analog tape', 'block'],
      ['Bottom Of Your Boots guitar take', 'block'],
      ['Loving Life Again piano sketch', 'block'],
      ['the Orbiter song demo, pads and soft choir', 'block'],
      ['Morning Dew arrangement, soft tape', 'block'],
      ['Morning Dew (Donk) sketch', 'block'],
      ['Judeline hook over warm pads', 'review'],
      ['rusowsky bounce on cheap speakers', 'review'],
      ['Rusowsky perreo bounce, dusty cassette', 'review'],
      ['Dolly Parton choir stack, analog bus', 'review'],
      ['Vincent Mason guitar take', 'review'],
      ['the song Boston on analog tape', 'block'],
      ['Boston song sketch, Stella Lefty vocal', 'block'],
      ['the song Dracula on analog tape', 'block'],
      ['Something to Lose piano sketch', 'block'],
      ['the song 9 to 5 on piano', 'block'],
      ['Steamboat Willie title card, warm grain', 'block'],
      ['Nintendo Switch bumper sting', 'block'],
      ['Nintendo Switch 2 unboxing sting', 'block'],
      ['Switch 2 unboxing sting, warm grain', 'block'],
      ['Joy-Con controller close-up, product shot', 'block'],
      ['Joy Con 2 click foley, game trailer', 'block'],
      ['Nintendo Direct title sting', 'block'],
      ['Thor character title sting', 'block'],
      ['Deadpool wisecrack title sting', 'block'],
      ['Wolverine claw sting, cinematic brass', 'block'],
      ['Loki trickster title card, warm grain', 'block'],
      ['Thanos snap title sting', 'block'],
      ['Avengers assemble title sting', 'block'],
      ['Encanto house title sting', 'block'],
      ['Moana ocean title sting', 'block'],
      ['Coco soundtrack title sting', 'block'],
      ['Toy Story lamp title sting', 'block'],
      ['Inside Out console title sting', 'block'],
      ['Halo franchise title sting', 'block'],
      ['Roblox lobby title sting', 'block'],
      ['Elden Ring title sting', 'block'],
      ['God of War title sting', 'block'],
      ['The Last of Us title sting', 'block'],
      ['Spotify wrap sting, product shot', 'block'],
      ['HBO static title sting', 'block'],
      ['Shaboozey bar-room guitar', 'review'],
      ['Naruto title sting', 'block'],
      ['Bluey title sting, warm grain', 'block'],
      ['ChatGPT prompt sting, product shot', 'block'],
      ['Midjourney prompt sting, product shot', 'block'],
      ['Fender logo sting, product shot', 'block'],
      ['Dominic Fike late-night keys', 'review'],
      ['Malcolm Todd soft tape vocal', 'review'],
      ['Koe Wetzel bar-room guitar', 'review'],
      ['Steve Lacy bass bounce sketch', 'review'],
      ['Shakira hook over warm pads', 'review'],
      ['Ty Dolla $ign late-night keys', 'review'],
      ['Ty Dolla Sign hook over warm pads', 'review'],
      ['sombr bedroom demo, soft tape', 'review'],
      ['Jolene vocal cover, soft tape', 'block'],
      ['the song Loser on analog tape', 'block'],
      ['Jaded song sketch, tired vocal', 'block'],
      ['the song Animal on analog tape', 'block'],
      ['Earrings song sketch, soft tape', 'block'],
      ['Cinderella song sketch, soft tape', 'block'],
      ['The Cure synth sketch, cold reverb', 'block'],
      ['What You Need song sketch, soft tape', 'block'],
      ['Oh Yeah song sketch, soft tape', 'block'],
      ['Dai Dai perreo bounce sketch', 'block'],
      ['PlayStation startup sting, warm grain', 'block'],
      ['PlayStation 5 boot sting', 'block'],
      ['PS5 unboxing sting, warm grain', 'block'],
      ['DualSense controller close-up, product shot', 'block'],
      ['Xbox Series X boot sting', 'block'],
      ['Barbie dreamhouse title sting', 'block'],
      ['Gundam hangar sting, warm grain', 'block'],
      ['One Piece title sting, warm grain', 'block'],
      ['Suno watermark sting, warm grain', 'block'],
      ['Udio bounce sketch', 'block'],
      ['LEGO brick close-up, product shot', 'block'],
      ['Labubu unboxing sting, warm grain', 'block'],
      ['Pop Mart blind-box unboxing sting', 'block'],
      ['AirPods product shot, white background', 'block'],
      ['iPhone product shot, studio light', 'block'],
      ['Warner Music Group title sting', 'block'],
      ['Universal Music Group title sting', 'block'],
      ['Atlantic Records title sting', 'block'],
      ['BMG logo sting, warm grain', 'block'],
    ];
    for (const [prompt, verdict] of cases) {
      const result = censor.check(prompt);
      assert.equal(result.verdict, verdict, `${JSON.stringify(prompt)} => ${result.verdict} (expected ${verdict})`);
    }
  });
});

