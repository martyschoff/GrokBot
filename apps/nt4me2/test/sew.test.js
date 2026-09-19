const test = require("node:test");
const assert = require("node:assert/strict");
const sew = require("../assets/sew.js");

test("sewHintText always lists Sew keys and appends skipped", () => {
  assert.equal(sew.sewHintText([{ key: "reading" }]), "Sew: reading");
  assert.equal(
    sew.sewHintText([{ key: "reading" }, { key: "exegete-matthew-henry" }]),
    "Sew: reading · exegete-matthew-henry"
  );
  assert.equal(
    sew.sewHintText([{ key: "reading" }], ["otref", "teaching"]),
    "Sew: reading · skipped otref · teaching"
  );
  assert.equal(sew.sewHintText([], ["otref"]), "Sew: skipped otref");
});

test("wantedKeys is reading, optional teaching/westminster/rccatechism, then exegete[0] only", () => {
  assert.deepEqual(sew.wantedKeys({}), ["reading"]);
  assert.deepEqual(
    sew.wantedKeys({
      hearGreek: true,
      otRef: true,
      teaching: true,
      westminster: true,
      rcCatechism: true,
      exegete: ["matthew-henry", "spurgeon"],
      closer: true,
      coda: true
    }),
    ["reading", "otref", "teaching", "westminster", "rccatechism", "exegete-matthew-henry"]
  );
  assert.deepEqual(sew.wantedKeys({ exegete: ["wesley", "spurgeon"] }), ["reading", "exegete-wesley"]);
  assert.equal(sew.wantedKeys({ exegete: [] }).some((k) => k.indexOf("exegete") === 0), false);
});

test("sewPlan skips missing fragments and never substitutes an unselected exegete", () => {
  const plan = sew.sewPlan(
    {
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
      teaching: "/data/audio/galatians-1-teaching.mp3",
      "exegete-wesley": "/data/audio/galatians-1-exegete-wesley.mp3",
      "exegete-spurgeon": "/data/audio/galatians-1-exegete-spurgeon.mp3"
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
  assert.deepEqual(plan.skipped, ["otref", "westminster", "rccatechism"]);
  assert.equal(plan.items.some((i) => i.key === "exegete-spurgeon"), false);
  assert.equal(plan.items.some((i) => /closer|coda/i.test(i.key)), false);
  assert.equal(plan.items.some((i) => /stub|silence|empty/i.test(i.url)), false);
});

test("chapter queue drops closer/coda and queues only the selected exegete", () => {
  const withSelected = sew.sewPlan(
    {
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
      closer: "/data/audio/galatians-1-closer.mp3",
      coda: "/data/audio/galatians-1-coda.mp3",
      "exegete-wesley": "/data/audio/galatians-1-exegete-wesley.mp3",
      "exegete-spurgeon": "/data/audio/galatians-1-exegete-spurgeon.mp3"
    },
    { exegete: ["wesley"] },
    { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }
  );
  assert.deepEqual(withSelected.items.map((i) => i.key), ["reading", "exegete-wesley"]);
  assert.equal(withSelected.items.some((i) => sew.isCodaFragment(i.key, i.url)), false);

  const missingSelected = sew.sewPlan(
    {
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
      "exegete-spurgeon": "/data/audio/galatians-1-exegete-spurgeon.mp3"
    },
    { exegete: ["wesley"] },
    { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }
  );
  assert.deepEqual(missingSelected.items.map((i) => i.key), ["reading"]);
  assert.ok(missingSelected.skipped.indexOf("exegete-wesley") >= 0);

  const noneSelected = sew.sewPlan(
    {
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
      "exegete-wesley": "/data/audio/galatians-1-exegete-wesley.mp3"
    },
    { exegete: [] },
    { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }
  );
  assert.deepEqual(noneSelected.items.map((i) => i.key), ["reading"]);

  assert.deepEqual(
    sew.chapterQueueItems([
      { key: "reading", url: "/data/audio/galatians-1-bsb-main-greekon-british.mp3" },
      { key: "closer", url: "/data/audio/galatians-1-closer.mp3" },
      { key: "coda", url: "/data/audio/galatians-1-coda.mp3" },
      { key: "exegete-wesley", url: "/data/audio/galatians-1-exegete-wesley.mp3" }
    ]).map((i) => i.key),
    ["reading"]
  );
  assert.deepEqual(
    sew.chapterQueueItems([
      { key: "reading", url: "/data/audio/galatians-1-bsb-main-greekon-british.mp3" },
      { key: "exegete-spurgeon", url: "/data/audio/galatians-1-exegete-spurgeon.mp3" },
      { key: "exegete-wesley", url: "/data/audio/galatians-1-exegete-wesley.mp3" }
    ], { exegete: ["wesley"] }).map((i) => i.key),
    ["reading", "exegete-wesley"]
  );
  assert.equal(sew.isCodaFragment("closer", "/data/audio/galatians-1-closer.mp3"), true);
  assert.equal(sew.isCodaFragment("reading", "/data/audio/galatians-1-bsb-main-greekon-british.mp3"), false);
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
  const brit = sew.conventionUrls("galatians-", 1, "reading", { voiceAccent: "british", bibleVersion: "berean", hearGreek: true });
  assert.equal(brit[0], "/data/audio/galatians-1-bsb-main-greekon-british.mp3");
  assert.ok(brit.indexOf("/data/audio/galatians-1-berean-british.mp3") >= 0);
  const am = sew.conventionUrls("galatians-", 2, "reading", { voiceAccent: "american", bibleVersion: "kjv", hearGreek: false });
  assert.equal(am[0], "/data/audio/galatians-2-kjv-main-greekoff-american.mp3");
  assert.ok(am.indexOf("/data/audio/galatians-2-kjv-american.mp3") >= 0);
  assert.ok(sew.conventionUrls("galatians-", 1, "greek", { hearGreek: true }).indexOf("/data/audio/galatians-1-greek.mp3") >= 0);
  assert.ok(sew.conventionUrls("galatians-", 1, "otref", { voiceAccent: "british", bibleVersion: "berean" }).indexOf("/data/audio/galatians-1-ot-ref.mp3") >= 0);
  const henry = sew.conventionUrls("galatians-", 1, "exegete-matthew-henry", { voiceAccent: "british", bibleVersion: "berean" });
  assert.equal(henry[0], "/data/audio/galatians-1-exegete-henry.mp3");
  assert.ok(henry.indexOf("/data/audio/galatians-1-exegete-matthew-henry.mp3") >= 0);
  assert.equal(
    sew.conventionUrls("galatians-", 1, "exegete-albert-barnes", { voiceAccent: "british", bibleVersion: "berean" })[0],
    "/data/audio/galatians-1-exegete-barnes.mp3"
  );
  assert.equal(
    sew.conventionUrls("galatians-", 1, "exegete-henry-alford", { voiceAccent: "british", bibleVersion: "berean" })[0],
    "/data/audio/galatians-1-exegete-alford.mp3"
  );
  assert.equal(
    sew.conventionUrls("galatians-", 1, "exegete-spurgeon", { voiceAccent: "british", bibleVersion: "berean" })[0],
    "/data/audio/galatians-1-exegete-spurgeon.mp3"
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 2, "teaching", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-2-teaching.mp3"]
  );
  const rcc = sew.conventionUrls("galatians-", 2, "rccatechism", { voiceAccent: "british", bibleVersion: "berean" });
  assert.equal(rcc[0], "/data/audio/galatians-2-ccc.mp3");
  assert.ok(rcc.indexOf("/data/audio/galatians-2-rccatechism.mp3") >= 0);
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
