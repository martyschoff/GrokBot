const test = require("node:test");
const assert = require("node:assert/strict");
const art = require("../assets/art-album.js");

test("prefers religious album over current_album", () => {
  const data = {
    current_album: "landscapes",
    albums: {
      landscapes: [{ file: "hill.jpg", title: "Hill" }],
      religious: [{ file: "descent.jpg", title: "Descent", place: "Moscow", artist: "unknown" }]
    }
  };
  assert.equal(art.preferredAlbumName(data), "religious");
  const pool = art.albumArtFromPictures(data);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].file, "descent.jpg");
  assert.equal(pool[0].src, "/data/pictures/religious/descent.jpg");
  assert.equal(pool[0].title, "Descent");
});

test("reads array albums named religious", () => {
  const pool = art.albumArtFromPictures({
    current_album: "other",
    albums: [
      { name: "other", pictures: [{ file: "skip.jpg" }] },
      { id: "religious", pictures: [{ file: "mass-bolsena-raphael-vatican.jpg", tradition: "rc" }] }
    ]
  });
  assert.equal(pool[0].src, "/data/pictures/religious/mass-bolsena-raphael-vatican.jpg");
  assert.equal(pool[0].tradition, "rc");
});

test("empty catalog yields empty pool (Descent is a player fallback)", () => {
  assert.deepEqual(art.albumArtFromPictures({ current_album: "religious", albums: { religious: [] } }), []);
  assert.deepEqual(art.albumArtFromPictures({}), []);
});

test("string entries and explicit src stay wired, no invented files", () => {
  const pool = art.albumArtFromPictures({
    albums: {
      religious: [
        "holy-sepulchre-roberts-jerusalem.jpg",
        { src: "/data/pictures/religious/annunciation-leonardo-uffizi.jpg", title: "Annunciation" }
      ]
    }
  });
  assert.equal(pool[0].src, "/data/pictures/religious/holy-sepulchre-roberts-jerusalem.jpg");
  assert.equal(pool[1].src, "/data/pictures/religious/annunciation-leonardo-uffizi.jpg");
  assert.equal(pool[1].title, "Annunciation");
});

test("filters People/Places/Oldies/Future and keeps Religious only", () => {
  const pool = art.albumArtFromPictures({
    current_album: "People",
    albums: {
      People: [{ file: "paul.jpg" }],
      Places: [{ file: "athens.jpg" }],
      Oldies: [{ file: "old.jpg" }],
      Future: [{ file: "soon.jpg" }],
      religious: [{ file: "descent.jpg" }, { file: "annunciation.jpg" }]
    }
  });
  assert.deepEqual(pool.map((p) => p.file), ["descent.jpg", "annunciation.jpg"]);
});

test("pool identity ignores incoming order and chapter-shaped wrappers", () => {
  const a = [{ file: "z.jpg" }, { file: "a.jpg" }, { file: "m.jpg" }];
  const b = [{ file: "a.jpg" }, { file: "m.jpg" }, { file: "z.jpg" }];
  assert.equal(art.poolIdentity(a), art.poolIdentity(b));
  assert.equal(art.poolIdentity(a), "a.jpg|m.jpg|z.jpg");
});

test("same filtered file set does not rebuild; changed set does", () => {
  const pool = [{ file: "one.jpg" }, { file: "two.jpg" }];
  const first = art.shouldRebuildPool(null, pool);
  assert.equal(first.rebuild, true);
  const again = art.shouldRebuildPool(first.identity, pool.slice().reverse());
  assert.equal(again.rebuild, false);
  assert.equal(again.identity, first.identity);
  const beliefsChanged = art.shouldRebuildPool(first.identity, [{ file: "one.jpg" }]);
  assert.equal(beliefsChanged.rebuild, true);
});

test("shuffle is a permutation; walking the deck has no repeats until exhaust", () => {
  const files = [];
  for (let i = 0; i < 107; i++) files.push({ file: "img-" + String(i).padStart(3, "0") + ".jpg" });
  const deck = art.shuffleList(files);
  assert.equal(deck.length, 107);
  const seen = new Set(deck.map((item) => item.file));
  assert.equal(seen.size, 107);
  const again = art.shouldRebuildPool(art.poolIdentity(deck), files);
  assert.equal(again.rebuild, false);
});

test("exhaust reshuffle continues and avoids repeating the last slide first", () => {
  const files = [];
  for (let i = 0; i < 20; i++) files.push({ file: "slide-" + i + ".jpg" });
  const last = "slide-7.jpg";
  for (let n = 0; n < 40; n++) {
    const next = art.reshuffleDeck(files, last);
    assert.equal(next.length, 20);
    assert.notEqual(art.fileName(next[0]), last);
    assert.equal(new Set(next.map(art.fileName)).size, 20);
  }
});
