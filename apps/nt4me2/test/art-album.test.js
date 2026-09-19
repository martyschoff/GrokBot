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
