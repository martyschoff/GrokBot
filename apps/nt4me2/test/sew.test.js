const test = require("node:test");
const assert = require("node:assert/strict");
const sew = require("../assets/sew.js");

test("wantedKeys starts with reading and adds Settings, Greek, and exegete-*", () => {
  assert.deepEqual(sew.wantedKeys({}), ["reading"]);
  assert.deepEqual(
    sew.wantedKeys({
      hearGreek: true,
      otRef: true,
      teaching: true,
      westminster: true,
      rcCatechism: true,
      exegete: ["matthew-henry", "spurgeon"]
    }),
    [
      "reading",
      "greek",
      "otref",
      "teaching",
      "westminster",
      "rccatechism",
      "exegete-matthew-henry",
      "exegete-spurgeon"
    ]
  );
});

test("sewPlan skips missing ot-ref and other fragments instead of inventing stubs", () => {
  const plan = sew.sewPlan(
    {
      "reading-berean-british": "/data/audio/galatians-1-berean-british.mp3",
      teaching: "/data/audio/galatians-1-teaching.mp3",
      "exegete-wesley": "/data/audio/galatians-1-exegete-wesley.mp3"
    },
    {
      hearGreek: true,
      otRef: true,
      teaching: true,
      westminster: true,
      rcCatechism: true,
      exegete: ["wesley", "spurgeon"]
    },
    { voiceAccent: "british", bibleVersion: "berean" }
  );
  assert.deepEqual(plan.items.map((i) => i.key), ["reading", "teaching", "exegete-wesley"]);
  assert.deepEqual(plan.skipped, ["greek", "otref", "westminster", "rccatechism", "exegete-spurgeon"]);
  assert.equal(plan.items.some((i) => /stub|silence|empty/i.test(i.url)), false);
});

test("reading prefers berean/kjv x american/british compound keys", () => {
  const map = {
    "reading-berean-british": "/data/audio/galatians-1-berean-british.mp3",
    "reading-berean-american": "/data/audio/galatians-1-berean-american.mp3",
    "reading-kjv-british": "/data/audio/galatians-1-kjv-british.mp3",
    "reading-kjv-american": "/data/audio/galatians-1-kjv-american.mp3"
  };
  assert.equal(
    sew.pickUrl(map, "reading", { voiceAccent: "british", bibleVersion: "berean" }),
    "/data/audio/galatians-1-berean-british.mp3"
  );
  assert.equal(
    sew.pickUrl(map, "reading", { voiceAccent: "american", bibleVersion: "kjv" }),
    "/data/audio/galatians-1-kjv-american.mp3"
  );
});

test("conventionUrls emit version-accent main reads and fragment / exegete / ot-ref names", () => {
  assert.deepEqual(
    sew.conventionUrls("galatians-", 1, "reading", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-1-berean-british.mp3", "/data/audio/galatians-1.mp3", "/data/audio/galatians-1-nogrk.mp3"]
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 2, "reading", { voiceAccent: "american", bibleVersion: "kjv" }),
    [
      "/data/audio/galatians-2-kjv-american.mp3",
      "/data/audio/galatians-2-american.mp3",
      "/data/audio/galatians-2-american-nogrk.mp3"
    ]
  );
  assert.ok(sew.conventionUrls("galatians-", 1, "otref", { voiceAccent: "british", bibleVersion: "berean" }).indexOf("/data/audio/galatians-1-ot-ref.mp3") >= 0);
  assert.ok(sew.conventionUrls("galatians-", 1, "exegete-spurgeon", { voiceAccent: "british", bibleVersion: "berean" }).indexOf("/data/audio/galatians-1-exegete-spurgeon.mp3") >= 0);
  assert.ok(sew.conventionUrls("galatians-", 2, "teaching", { voiceAccent: "british", bibleVersion: "berean" }).indexOf("/data/audio/galatians-2-teaching.mp3") >= 0);
});

test("normalizeFragmentBook + chapterFragments read live.json overlay shape", () => {
  const table = sew.normalizeFragmentBook({
    galatians: {
      2: { "reading-berean-british": "/data/audio/galatians-2-berean-british.mp3" }
    }
  });
  const row = sew.chapterFragments(table, "galatians", 2);
  assert.equal(row["reading-berean-british"], "/data/audio/galatians-2-berean-british.mp3");
});
