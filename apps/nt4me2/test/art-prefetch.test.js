const test = require("node:test");
const assert = require("node:assert/strict");
const art = require("../assets/art-prefetch.js");

function album(n, prefix) {
  const items = [];
  for (let i = 0; i < n; i++) items.push({ src: prefix + i + ".jpg?v=house9" });
  return items;
}

function recorder() {
  const created = [];
  const cancelled = [];
  const win = art.createArtWindow({
    windowSize: 4,
    createImage: function (src) {
      created.push(src);
      return {
        cancel: function () { cancelled.push(src); }
      };
    }
  });
  return { created: created, cancelled: cancelled, win: win };
}

test("cold start fetches only the next three ahead of a 100-image album", function () {
  const rec = recorder();
  const state = rec.win.sync(album(100, "/art/"), 0);
  assert.deepEqual(state.indexes, [0, 1, 2, 3]);
  assert.equal(state.srcs.length, 4);
  assert.deepEqual(state.ahead, [
    "/art/1.jpg?v=house9",
    "/art/2.jpg?v=house9",
    "/art/3.jpg?v=house9"
  ]);
  assert.deepEqual(rec.created, state.ahead);
  assert.deepEqual(rec.cancelled, []);
});

test("advancing one slide adds one image and does not refetch the window", function () {
  const rec = recorder();
  const list = album(100, "/art/");
  rec.win.sync(list, 0);
  const state = rec.win.sync(list, 1);
  assert.deepEqual(state.indexes, [1, 2, 3, 4]);
  assert.deepEqual(rec.created, [
    "/art/1.jpg?v=house9",
    "/art/2.jpg?v=house9",
    "/art/3.jpg?v=house9",
    "/art/4.jpg?v=house9"
  ]);
  assert.deepEqual(rec.cancelled, []);
  rec.win.sync(list, 1);
  assert.equal(rec.created.length, 4);
});

test("a jump drops probes that are no longer in the window", function () {
  const rec = recorder();
  const list = album(100, "/art/");
  rec.win.sync(list, 0);
  const state = rec.win.sync(list, 40);
  assert.deepEqual(state.indexes, [40, 41, 42, 43]);
  assert.deepEqual(rec.cancelled.slice().sort(), [
    "/art/1.jpg?v=house9",
    "/art/2.jpg?v=house9",
    "/art/3.jpg?v=house9"
  ]);
  assert.deepEqual(rec.created.slice(-3), [
    "/art/41.jpg?v=house9",
    "/art/42.jpg?v=house9",
    "/art/43.jpg?v=house9"
  ]);
});

test("replacing the album cancels the previous block", function () {
  const rec = recorder();
  rec.win.sync(album(20, "/old/"), 0);
  const state = rec.win.sync(album(8, "/new/"), 2);
  assert.deepEqual(state.indexes, [2, 3, 4, 5]);
  assert.deepEqual(rec.cancelled.slice().sort(), [
    "/old/1.jpg?v=house9",
    "/old/2.jpg?v=house9",
    "/old/3.jpg?v=house9"
  ]);
  assert.ok(rec.created.every(function (src) {
    return src.indexOf("/old/") === 0 || src.indexOf("/new/") === 0;
  }));
  assert.equal(state.ahead.filter(function (src) { return src.indexOf("/old/") === 0; }).length, 0);
});

test("window wraps and stays at the album length when the album is small", function () {
  const rec = recorder();
  const list = [
    { src: "/a.jpg" },
    { src: "/b.jpg?x=1" }
  ];
  const first = rec.win.sync(list, 0);
  assert.deepEqual(first.indexes, [0, 1]);
  assert.deepEqual(rec.created, ["/b.jpg?x=1"]);
  const second = rec.win.sync(list, 1);
  assert.deepEqual(second.indexes, [1, 0]);
  assert.deepEqual(rec.created, ["/b.jpg?x=1", "/a.jpg"]);
});

test("blank src slots are not requested", function () {
  const rec = recorder();
  const state = rec.win.sync([
    { src: "/now.jpg" },
    { src: "" },
    { title: "no src" },
    { src: "/soon.jpg" }
  ], 0);
  assert.deepEqual(state.indexes, [0, 1, 2, 3]);
  assert.deepEqual(rec.created, ["/soon.jpg"]);
});

test("reset cancels outstanding ahead fetches", function () {
  const rec = recorder();
  rec.win.sync(album(10, "/art/"), 3);
  rec.win.reset();
  assert.equal(rec.cancelled.length, 3);
  const again = rec.win.sync(album(10, "/art/"), 3);
  assert.deepEqual(again.indexes, [3, 4, 5, 6]);
  assert.equal(rec.created.length, 6);
});
