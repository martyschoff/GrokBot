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
    "Sew: reading · skipped otref"
  );
  assert.equal(
    sew.sewHintText([{ key: "reading" }, { key: "teaching" }], ["teaching"]),
    "Sew: reading"
  );
  assert.equal(sew.sewHintText([], ["otref"]), "Sew: skipped otref");
});

test("wantedKeys is reading, optional otref, exegete (if selected), then westminster/rccatechism — never teaching", () => {
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
    ["reading", "otref", "exegete-matthew-henry", "westminster", "rccatechism"]
  );
  assert.deepEqual(sew.wantedKeys({ exegete: ["wesley", "spurgeon"] }), ["reading", "exegete-wesley"]);
  assert.equal(sew.wantedKeys({ exegete: [] }).some((k) => k.indexOf("exegete") === 0), false);
  assert.deepEqual(sew.wantedKeys({ exegete: ["none"] }), ["reading"]);
  assert.deepEqual(sew.wantedKeys({ exegete: ["random"] }), ["reading", "exegete-random"]);
  assert.equal(sew.wantedKeys({ teaching: true }).indexOf("teaching"), -1);
  assert.deepEqual(
    sew.probeKeys({ otRef: true, exegete: ["random"] }),
    ["otref"].concat(sew.EXEGETE_IDS.map((id) => "exegete-" + id))
  );
  assert.equal(sew.exegeteMode({ exegete: ["random"] }), "random");
  assert.equal(sew.exegeteMode({ exegete: [] }), "none");
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
  assert.deepEqual(plan.items.map((i) => i.key), ["reading", "exegete-wesley"]);
  assert.deepEqual(plan.skipped, ["otref", "westminster", "rccatechism"]);
  assert.equal(plan.items.some((i) => i.key === "teaching"), false);
  assert.equal(plan.skipped.indexOf("teaching"), -1);
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

  const noneNamed = sew.sewPlan(
    {
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
      "exegete-wesley": "/data/audio/galatians-1-exegete-wesley.mp3"
    },
    { exegete: ["none"] },
    { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }
  );
  assert.deepEqual(noneNamed.items.map((i) => i.key), ["reading"]);

  const randomPicked = sew.sewPlan(
    {
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
      "exegete-wesley": "/data/audio/galatians-1-exegete-wesley.mp3",
      "exegete-spurgeon": "/data/audio/galatians-1-exegete-spurgeon.mp3"
    },
    { exegete: ["random"] },
    {
      voiceAccent: "british",
      bibleVersion: "berean",
      hearGreek: true,
      pickRandom: (ids) => {
        assert.deepEqual(ids, ["spurgeon", "wesley"]);
        return "spurgeon";
      }
    }
  );
  assert.deepEqual(randomPicked.items.map((i) => i.key), ["reading", "exegete-spurgeon"]);
  assert.equal(randomPicked.skipped.indexOf("exegete-random"), -1);

  const randomSilent = sew.sewPlan(
    {
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3"
    },
    { exegete: ["random"] },
    { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }
  );
  assert.deepEqual(randomSilent.items.map((i) => i.key), ["reading"]);
  assert.ok(randomSilent.skipped.indexOf("exegete-random") >= 0);
  assert.equal(randomSilent.items.some((i) => /stub|silence|empty|beep|tone/i.test(i.url || "")), false);

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
  assert.deepEqual(
    sew.chapterQueueItems([
      { key: "reading", url: "/data/audio/galatians-1-bsb-main-greekon-british.mp3" },
      { key: "exegete-spurgeon", url: "/data/audio/galatians-1-exegete-spurgeon.mp3" },
      { key: "exegete-wesley", url: "/data/audio/galatians-1-exegete-wesley.mp3" }
    ], { exegete: ["random"] }).map((i) => i.key),
    ["reading", "exegete-spurgeon"]
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
  assert.equal(henry[0], "/data/audio/galatians-1-exegete-henry.m4a");
  assert.ok(henry.indexOf("/data/audio/galatians-1-exegete-henry.mp3") >= 0);
  assert.ok(henry.indexOf("/data/audio/galatians-1-exegete-matthew-henry.mp3") >= 0);
  assert.equal(
    sew.conventionUrls("galatians-", 1, "exegete-albert-barnes", { voiceAccent: "british", bibleVersion: "berean" })[0],
    "/data/audio/galatians-1-exegete-barnes.m4a"
  );
  assert.equal(
    sew.conventionUrls("galatians-", 1, "exegete-henry-alford", { voiceAccent: "british", bibleVersion: "berean" })[0],
    "/data/audio/galatians-1-exegete-alford.m4a"
  );
  assert.equal(
    sew.conventionUrls("galatians-", 1, "exegete-spurgeon", { voiceAccent: "british", bibleVersion: "berean" })[0],
    "/data/audio/galatians-1-exegete-spurgeon.m4a"
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 2, "teaching", { voiceAccent: "british", bibleVersion: "berean" }),
    []
  );
  assert.deepEqual(
    sew.conventionUrls("galatians-", 1, "exegete-random", { voiceAccent: "british", bibleVersion: "berean" }),
    []
  );
  const rcc = sew.conventionUrls("galatians-", 2, "rccatechism", { voiceAccent: "british", bibleVersion: "berean" });
  assert.equal(rcc[0], "/data/audio/galatians-2-ccc.mp3");
  assert.ok(rcc.indexOf("/data/audio/galatians-2-rccatechism.mp3") >= 0);
  assert.deepEqual(
    sew.conventionUrls("galatians-", 2, "westminster", { voiceAccent: "british", bibleVersion: "berean" }),
    ["/data/audio/galatians-2-westminster.mp3"]
  );
});

test("conventionUrls lists American exegete filenames first for American accent", () => {
  const americanHenry = sew.conventionUrls("galatians-", 1, "exegete-matthew-henry", { voiceAccent: "american", bibleVersion: "berean" });
  assert.equal(americanHenry[0], "/data/audio/galatians-1-exegete-henry-american.mp3");
  assert.equal(americanHenry[1], "/data/audio/galatians-1-exegete-matthew-henry-american.mp3");
  assert.ok(americanHenry.indexOf("/data/audio/galatians-1-exegete-henry.m4a") >= 0);
  assert.ok(americanHenry.indexOf("/data/audio/galatians-1-exegete-henry.mp3") >= 0);
  
  const britishHenry = sew.conventionUrls("galatians-", 1, "exegete-matthew-henry", { voiceAccent: "british", bibleVersion: "berean" });
  assert.equal(britishHenry[0], "/data/audio/galatians-1-exegete-henry.m4a");
  assert.equal(britishHenry.indexOf("/data/audio/galatians-1-exegete-henry-american.mp3"), -1);
  
  const americanBarnes = sew.conventionUrls("matthew-", 5, "exegete-albert-barnes", { voiceAccent: "american", bibleVersion: "berean" });
  assert.equal(americanBarnes[0], "/data/audio/matthew-5-exegete-barnes-american.mp3");
  assert.equal(americanBarnes[1], "/data/audio/matthew-5-exegete-albert-barnes-american.mp3");
});

test("pickUrl with American accent prefers -american variant over British for exegetes", () => {
  const map = {
    "exegete-henry": "/data/audio/galatians-1-exegete-henry.m4a",
    "exegete-henry-american": "/data/audio/galatians-1-exegete-henry-american.mp3"
  };
  assert.equal(
    sew.pickUrl(map, "exegete-matthew-henry", { voiceAccent: "american", bibleVersion: "berean" }),
    "/data/audio/galatians-1-exegete-henry-american.mp3"
  );
  assert.equal(
    sew.pickUrl(map, "exegete-matthew-henry", { voiceAccent: "british", bibleVersion: "berean" }),
    "/data/audio/galatians-1-exegete-henry.m4a"
  );
});

test("westminster stays in wantedKeys when settings.westminster true", () => {
  const withWestminster = sew.wantedKeys({
    hearGreek: true,
    otRef: false,
    westminster: true,
    rcCatechism: false,
    exegete: []
  });
  assert.ok(withWestminster.indexOf("westminster") >= 0);
  
  const withoutWestminster = sew.wantedKeys({
    hearGreek: true,
    otRef: false,
    westminster: false,
    rcCatechism: false,
    exegete: []
  });
  assert.equal(withoutWestminster.indexOf("westminster"), -1);
});

test("otRef stays in wantedKeys when settings.otRef true", () => {
  const withOtRef = sew.wantedKeys({
    hearGreek: true,
    otRef: true,
    westminster: false,
    rcCatechism: false,
    exegete: []
  });
  assert.ok(withOtRef.indexOf("otref") >= 0);
  
  const withoutOtRef = sew.wantedKeys({
    hearGreek: true,
    otRef: false,
    westminster: false,
    rcCatechism: false,
    exegete: []
  });
  assert.equal(withoutOtRef.indexOf("otref"), -1);
});

test("sewPlan does not invent OT Ref URLs when missing", () => {
  const plan = sew.sewPlan(
    {
      "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3"
    },
    {
      hearGreek: true,
      otRef: true,
      westminster: false,
      rcCatechism: false,
      exegete: []
    },
    { voiceAccent: "british", bibleVersion: "berean", hearGreek: true }
  );
  assert.deepEqual(plan.items.map((i) => i.key), ["reading"]);
  assert.ok(plan.skipped.indexOf("otref") >= 0);
  assert.equal(plan.items.some((i) => /otref|ot.ref|ot-ref/i.test(i.url || "")), false);
});

test("conventionUrls lists American ot-ref names first for otref with American accent", () => {
  const americanOtRef = sew.conventionUrls("galatians-", 1, "otref", { voiceAccent: "american", bibleVersion: "berean" });
  assert.equal(americanOtRef[0], "/data/audio/galatians-1-ot-ref-american.mp3");
  assert.equal(americanOtRef[1], "/data/audio/galatians-1-otref-american.mp3");
  assert.ok(americanOtRef.indexOf("/data/audio/galatians-1-ot-ref.mp3") >= 0);
  assert.ok(americanOtRef.indexOf("/data/audio/galatians-1-otref.mp3") >= 0);
  
  const britishOtRef = sew.conventionUrls("galatians-", 1, "otref", { voiceAccent: "british", bibleVersion: "berean" });
  assert.equal(britishOtRef[0], "/data/audio/galatians-1-ot-ref.mp3");
  assert.equal(britishOtRef.indexOf("/data/audio/galatians-1-ot-ref-american.mp3"), -1);
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

test("conventionUrls lists American westminster filenames first for American accent", () => {
  const americanWcf = sew.conventionUrls("galatians-", 1, "westminster", { voiceAccent: "american", bibleVersion: "berean" });
  assert.equal(americanWcf[0], "/data/audio/galatians-1-westminster-american.mp3");
  assert.ok(americanWcf.indexOf("/data/audio/galatians-1-westminster.mp3") >= 0);
  
  const britishWcf = sew.conventionUrls("galatians-", 1, "westminster", { voiceAccent: "british", bibleVersion: "berean" });
  assert.equal(britishWcf[0], "/data/audio/galatians-1-westminster.mp3");
  assert.equal(britishWcf.indexOf("/data/audio/galatians-1-westminster-american.mp3"), -1);
});

test("conventionUrls lists American rccatechism filenames first for American accent", () => {
  const americanCcc = sew.conventionUrls("galatians-", 1, "rccatechism", { voiceAccent: "american", bibleVersion: "berean" });
  assert.equal(americanCcc[0], "/data/audio/galatians-1-ccc-american.mp3");
  assert.equal(americanCcc[1], "/data/audio/galatians-1-rccatechism-american.mp3");
  assert.ok(americanCcc.indexOf("/data/audio/galatians-1-ccc.mp3") >= 0);
  assert.ok(americanCcc.indexOf("/data/audio/galatians-1-rccatechism.mp3") >= 0);
  
  const britishCcc = sew.conventionUrls("galatians-", 1, "rccatechism", { voiceAccent: "british", bibleVersion: "berean" });
  assert.equal(britishCcc[0], "/data/audio/galatians-1-ccc.mp3");
  assert.equal(britishCcc.indexOf("/data/audio/galatians-1-ccc-american.mp3"), -1);
  assert.equal(britishCcc.indexOf("/data/audio/galatians-1-rccatechism-american.mp3"), -1);
});
