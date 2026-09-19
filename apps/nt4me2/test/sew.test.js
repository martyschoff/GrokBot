const test = require("node:test");
const assert = require("node:assert/strict");
const sew = require("../assets/sew.js");

test("wantedKeys starts with reading and adds Settings and exegete-* (Greek is not a fragment)", () => {
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
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
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
    { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }
  );
  assert.deepEqual(plan.items.map((i) => i.key), ["reading", "teaching", "exegete-wesley"]);
  assert.deepEqual(plan.skipped, ["otref", "westminster", "rccatechism", "exegete-spurgeon"]);
  assert.equal(plan.items.some((i) => /stub|silence|empty/i.test(i.url)), false);
});

test("reading prefers kjv|bsb main greekon|greekoff × british|american keys", () => {
  const map = {
    "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
    "reading-bsb-main-greekoff-american": "/data/audio/galatians-1-bsb-main-greekoff-american.mp3",
    "reading-kjv-main-greekon-american": "/data/audio/galatians-1-kjv-main-greekon-american.mp3",
    "reading-kjv-main-greekoff-british": "/data/audio/galatians-1-kjv-main-greekoff-british.mp3"
  };
  assert.equal(
    sew.pickUrl(map, "reading", { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }),
    "/data/audio/galatians-1-bsb-main-greekon-british.mp3"
  );
  assert.equal(
    sew.pickUrl(map, "reading", { voiceAccent: "american", bibleVersion: "kjv", hearGreek: true }),
    "/data/audio/galatians-1-kjv-main-greekon-american.mp3"
  );
  assert.equal(
    sew.pickUrl(map, "reading", { voiceAccent: "american", bibleVersion: "berean", hearGreek: false }),
    "/data/audio/galatians-1-bsb-main-greekoff-american.mp3"
  );
});

test("pickUrl maps exegete-matthew-henry/barnes/alford and rccatechism→ccc", () => {
  const map = {
    "exegete-henry": "/data/audio/galatians-1-exegete-henry.mp3",
    "exegete-barnes": "/data/audio/galatians-1-exegete-barnes.mp3",
    "exegete-alford": "/data/audio/galatians-1-exegete-alford.mp3",
    ccc: "/data/audio/galatians-1-ccc.mp3"
  };
  assert.equal(
    sew.pickUrl(map, "exegete-matthew-henry", { voiceAccent: "british", bibleVersion: "berean" }),
    "/data/audio/galatians-1-exegete-henry.mp3"
  );
  assert.equal(
    sew.pickUrl(map, "exegete-albert-barnes", { voiceAccent: "british", bibleVersion: "berean" }),
    "/data/audio/galatians-1-exegete-barnes.mp3"
  );
  assert.equal(
    sew.pickUrl(map, "exegete-henry-alford", { voiceAccent: "british", bibleVersion: "berean" }),
    "/data/audio/galatians-1-exegete-alford.mp3"
  );
  assert.equal(
    sew.pickUrl(map, "rccatechism", { voiceAccent: "british", bibleVersion: "berean" }),
    "/data/audio/galatians-1-ccc.mp3"
  );
});

test("conventionUrls emit Kokoro main / shared / mapped exegete names", () => {
  assert.deepEqual(
    sew.conventionUrls("galatians-", 1, "reading", { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }),
    ["/data/audio/galatians-1-bsb-main-greekon-british.mp3"]
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 2, "reading", { voiceAccent: "american", bibleVersion: "kjv", hearGreek: false }),
    ["/data/audio/galatians-2-kjv-main-greekoff-american.mp3"]
  );
  assert.deepEqual(sew.conventionUrls("galatians-", 1, "greek", { hearGreek: true }), []);
  assert.ok(sew.conventionUrls("galatians-", 1, "otref", { voiceAccent: "british", bibleVersion: "berean" }).indexOf("/data/audio/galatians-1-ot-ref.mp3") >= 0);
  assert.deepEqual(
    sew.conventionUrls("galatians-", 1, "exegete-matthew-henry", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-1-exegete-henry.mp3"]
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 1, "exegete-albert-barnes", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-1-exegete-barnes.mp3"]
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 1, "exegete-henry-alford", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-1-exegete-alford.mp3"]
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 1, "exegete-spurgeon", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-1-exegete-spurgeon.mp3"]
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 2, "teaching", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-2-teaching.mp3"]
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 2, "rccatechism", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-2-ccc.mp3"]
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 2, "westminster", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-2-westminster.mp3"]
  );
});

test("normalizeFragmentBook + chapterFragments read live.json overlay shape", () => {
  const table = sew.normalizeFragmentBook({
    galatians: {
      2: { "reading-bsb-main-greekon-british": "/data/audio/galatians-2-bsb-main-greekon-british.mp3" }
    }
  });
  const row = sew.chapterFragments(table, "galatians", 2);
  assert.equal(row["reading-bsb-main-greekon-british"], "/data/audio/galatians-2-bsb-main-greekon-british.mp3");
});
