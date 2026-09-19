const test = require("node:test");
const assert = require("node:assert/strict");
const sew = require("../assets/sew.js");

test("wantedKeys always starts with reading and adds Settings + Greek", () => {
  assert.deepEqual(sew.wantedKeys({}), ["reading"]);
  assert.deepEqual(
    sew.wantedKeys({
      hearGreek: true,
      otRef: true,
      teaching: true,
      westminster: true,
      rcCatechism: true
    }),
    ["reading", "greek", "otref", "teaching", "westminster", "rccatechism"]
  );
});

test("sewPlan skips missing fragments instead of inventing stubs", () => {
  const plan = sew.sewPlan(
    { reading: "/data/audio/galatians-1.mp3", teaching: "/data/audio/galatians-1-teaching.mp3" },
    { hearGreek: true, otRef: true, teaching: true, westminster: true, rcCatechism: true },
    { voiceAccent: "british" }
  );
  assert.deepEqual(plan.items.map((i) => i.key), ["reading", "teaching"]);
  assert.deepEqual(plan.skipped, ["greek", "otref", "westminster", "rccatechism"]);
  assert.equal(plan.items.some((i) => /stub|silence|empty/i.test(i.url)), false);
});

test("American accent prefers *-american fragment keys then British", () => {
  const map = {
    reading: "/data/audio/galatians-1.mp3",
    "reading-american": "/data/audio/galatians-1-american.mp3",
    otref: "/data/audio/galatians-1-otref.mp3"
  };
  assert.equal(sew.pickUrl(map, "reading", "american"), "/data/audio/galatians-1-american.mp3");
  assert.equal(sew.pickUrl(map, "reading", "british"), "/data/audio/galatians-1.mp3");
  assert.equal(sew.pickUrl(map, "otref", "american"), "/data/audio/galatians-1-otref.mp3");
});

test("conventionUrls keep Brit/Am reading names and section keys", () => {
  assert.deepEqual(sew.conventionUrls("galatians-", 1, "otref", "british"), [
    "/data/audio/galatians-1-otref.mp3"
  ]);
  assert.deepEqual(sew.conventionUrls("galatians-", 1, "otref", "american"), [
    "/data/audio/galatians-1-american-otref.mp3",
    "/data/audio/galatians-1-otref.mp3"
  ]);
});

test("normalizeFragmentBook + chapterFragments read live.json overlay shape", () => {
  const table = sew.normalizeFragmentBook({
    galatians: {
      1: { reading: "/data/audio/galatians-1.mp3", greek: "/data/audio/galatians-1-greek.mp3" }
    }
  });
  const row = sew.chapterFragments(table, "galatians", 1);
  assert.equal(row.reading, "/data/audio/galatians-1.mp3");
  assert.equal(row.greek, "/data/audio/galatians-1-greek.mp3");
});
