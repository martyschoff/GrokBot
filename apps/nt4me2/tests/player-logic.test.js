const { test } = require("node:test");
const assert = require("node:assert/strict");
const NT4 = require("../assets/player-logic.js");

test("hasMediaSrc ignores a resolved empty audio src (document URL)", () => {
  const empty = {
    src: "https://example.com/apps/nt4me2/index.html",
    getAttribute(name) {
      return name === "src" ? null : "";
    }
  };
  assert.equal(NT4.hasMediaSrc(empty), false);
  assert.equal(NT4.hasMediaSrc(null), false);
  assert.equal(NT4.hasMediaSrc({
    src: "https://cdn.example/data/audio/romans-1.mp3",
    getAttribute() { return "/data/audio/romans-1.mp3"; }
  }), true);
});

test("normalizeLiveTable seeds NT_FALLBACK live books and skips dead ones", () => {
  const table = NT4.normalizeLiveTable(NT4.NT_FALLBACK);
  assert.deepEqual(table.romans.slice(0, 3), [1, 2, 3]);
  assert.equal(table.romans.length, 16);
  assert.equal(table["1corinthians"].length, 16);
  assert.equal(table.hebrews, undefined);
  assert.equal(table.matthew, undefined);
  assert.equal(NT4.isLiveBook(table, "romans"), true);
  assert.equal(NT4.isLiveChapter(table, "romans", 16), true);
  assert.equal(NT4.isLiveChapter(table, "romans", 17), false);
});

test("normalizeLiveTable accepts map, nested books, and catalog arrays", () => {
  assert.deepEqual(NT4.normalizeLiveTable({ romans: [3, 1, "2"] }).romans, [1, 2, 3]);
  assert.deepEqual(
    NT4.normalizeLiveTable({ books: { romans: { chapters: [1, 5] } } }).romans,
    [1, 5]
  );
  const catalog = NT4.normalizeLiveTable({
    books: [
      { id: "romans", live: true, chapters: 2 },
      { id: "hebrews", live: false, chapters: 13 }
    ]
  });
  assert.deepEqual(catalog.romans, [1, 2]);
  assert.equal(catalog.hebrews, undefined);
});

test("next/prev skip holes and start from chapter 0", () => {
  const table = { romans: [1, 3, 8] };
  assert.equal(NT4.nextLiveChapter(table, "romans", 0), 1);
  assert.equal(NT4.nextLiveChapter(table, "romans", 1), 3);
  assert.equal(NT4.nextLiveChapter(table, "romans", 8), null);
  assert.equal(NT4.nextLiveChapter(table, "romans", 2), 3);
  assert.equal(NT4.prevLiveChapter(table, "romans", 8), 3);
  assert.equal(NT4.prevLiveChapter(table, "romans", 1), null);
  assert.equal(NT4.prevLiveChapter({}, "romans", 1), null);
});

test("audioStem and bookLabel cover Romans, 1 Corinthians, and Hebrews", () => {
  assert.equal(NT4.audioStem("romans"), "romans-");
  assert.equal(NT4.audioStem("1corinthians"), "1cor-");
  assert.equal(NT4.audioStem("hebrews"), "hebrews-");
  assert.equal(NT4.audioStem("jude"), "");
  assert.equal(NT4.bookLabel("1corinthians"), "1 Corinthians");
  assert.equal(NT4.bookLabel("hebrews"), "Hebrews");
});

test("chapterFromPayload reads title, payload, and nowPick paths", () => {
  assert.deepEqual(
    NT4.chapterFromPayload({ title: "1 Corinthians 13" }, ""),
    { book: "1corinthians", chapter: 13 }
  );
  assert.deepEqual(
    NT4.chapterFromPayload({ book: "hebrews", chapter: 3 }, ""),
    { book: "hebrews", chapter: 3 }
  );
  assert.deepEqual(
    NT4.chapterFromPayload({}, "/data/kjv/romans/5/now-live.json"),
    { book: "romans", chapter: 5 }
  );
  assert.deepEqual(NT4.chapterFromPayload({}, ""), { book: "", chapter: 0 });
});

test("mediaUrl prefixes pack-relative paths only", () => {
  assert.equal(NT4.mediaUrl("/data/audio/romans-1.mp3", "/pack/"), "/pack/data/audio/romans-1.mp3");
  assert.equal(NT4.mediaUrl("https://cdn.example/a.mp3", "/pack"), "https://cdn.example/a.mp3");
  assert.equal(NT4.mediaUrl("", "/pack"), "");
});

test("artFile and citeLine stay stable on thin records", () => {
  assert.equal(NT4.artFile({ src: "/data/art/foo.jpg" }), "foo.jpg");
  assert.equal(NT4.artFile(null), "");
  assert.equal(NT4.artListKey([{ file: "a.jpg" }, { src: "/b/c.png" }]), "a.jpg|c.png");
  assert.equal(
    NT4.citeLine({ author: "Spurgeon", title: "Take Heed, Brethren", date: "1884" }),
    "Spurgeon, Take Heed, Brethren, 1884"
  );
});
