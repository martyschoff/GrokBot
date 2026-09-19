(function (root) {
  const SEW_KEYS = [
    { id: "reading", aliases: ["reading", "chapter", "audio"] },
    { id: "greek", aliases: ["greek"] },
    { id: "otref", aliases: ["otref", "ot_ref", "ot-ref", "ot"] },
    { id: "teaching", aliases: ["teaching"] },
    { id: "westminster", aliases: ["westminster", "wcf"] },
    { id: "rccatechism", aliases: ["rccatechism", "rc-catechism", "rc_catechism", "ccc", "rcc"] }
  ];

  const EXEGETE_IDS = [
    "matthew-henry",
    "albert-barnes",
    "henry-alford",
    "spurgeon",
    "wesley"
  ];

  function optsOf(options) {
    if (!options || typeof options === "string") {
      return {
        voiceAccent: options === "american" ? "american" : "british",
        bibleVersion: "berean"
      };
    }
    return {
      voiceAccent: options.voiceAccent === "american" ? "american" : "british",
      bibleVersion: options.bibleVersion === "kjv" ? "kjv" : "berean"
    };
  }

  function wantedKeys(settings) {
    const keys = ["reading"];
    if (settings && settings.hearGreek) keys.push("greek");
    if (settings && settings.otRef) keys.push("otref");
    if (settings && settings.teaching) keys.push("teaching");
    if (settings && settings.westminster) keys.push("westminster");
    if (settings && settings.rcCatechism) keys.push("rccatechism");
    const voices = (settings && settings.exegete) || [];
    for (let i = 0; i < voices.length; i++) {
      const id = String(voices[i] || "").trim();
      if (id) keys.push("exegete-" + id);
    }
    return keys;
  }

  function aliasesFor(key) {
    const spec = SEW_KEYS.find((s) => s.id === key);
    if (spec) return spec.aliases.slice();
    return [key];
  }

  function pickUrl(map, key, options) {
    if (!map || typeof map !== "object") return "";
    const opt = optsOf(options);
    const aliases = aliasesFor(key);
    if (key === "reading") {
      const compound = map["reading-" + opt.bibleVersion + "-" + opt.voiceAccent]
        || map[opt.bibleVersion + "-" + opt.voiceAccent];
      if (compound) return String(compound);
    }
    if (opt.voiceAccent === "american") {
      for (let i = 0; i < aliases.length; i++) {
        const a = aliases[i];
        const u = map[a + "-american"] || map[a + "_american"];
        if (u) return String(u);
      }
    }
    for (let i = 0; i < aliases.length; i++) {
      const u = map[aliases[i]];
      if (u) return String(u);
    }
    return "";
  }

  function sewPlan(availableMap, settings, options) {
    const wanted = wantedKeys(settings);
    const items = [];
    const skipped = [];
    for (let i = 0; i < wanted.length; i++) {
      const key = wanted[i];
      const url = pickUrl(availableMap, key, options);
      if (url) items.push({ key: key, url: url });
      else skipped.push(key);
    }
    return { items: items, skipped: skipped };
  }

  function conventionUrls(stem, chapter, key, options) {
    if (!stem || !chapter || !key) return [];
    const opt = optsOf(options);
    const base = "/data/audio/" + stem + chapter;
    const version = opt.bibleVersion;
    const accent = opt.voiceAccent;
    const urls = [];
    const push = (u) => {
      if (u && urls.indexOf(u) < 0) urls.push(u);
    };
    if (key === "reading") {
      push(base + "-" + version + "-" + accent + ".mp3");
      if (accent === "american") {
        push(base + "-american.mp3");
        push(base + "-american-nogrk.mp3");
      } else {
        push(base + ".mp3");
        push(base + "-nogrk.mp3");
      }
      return urls;
    }
    if (key === "otref") {
      push(base + "-ot-ref.mp3");
      push(base + "-otref.mp3");
      push(base + "-" + version + "-" + accent + "-otref.mp3");
      return urls;
    }
    push(base + "-" + key + ".mp3");
    push(base + "-" + version + "-" + accent + "-" + key + ".mp3");
    if (accent === "american") push(base + "-american-" + key + ".mp3");
    return urls;
  }

  function mergeFragmentMaps() {
    const out = {};
    for (let i = 0; i < arguments.length; i++) {
      const map = arguments[i];
      if (!map || typeof map !== "object") continue;
      Object.keys(map).forEach((k) => {
        if (map[k]) out[k] = map[k];
      });
    }
    return out;
  }

  function normalizeFragmentBook(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach((book) => {
      const chs = raw[book];
      if (!chs || typeof chs !== "object") return;
      out[book] = {};
      Object.keys(chs).forEach((ch) => {
        const row = chs[ch];
        if (!row || typeof row !== "object") return;
        out[book][String(Number(ch) || ch)] = Object.assign({}, row);
      });
    });
    return out;
  }

  function chapterFragments(table, book, chapter) {
    if (!table || !book) return {};
    const row = table[book];
    if (!row) return {};
    return Object.assign({}, row[String(chapter)] || row[Number(chapter)] || {});
  }

  const api = {
    SEW_KEYS: SEW_KEYS,
    EXEGETE_IDS: EXEGETE_IDS,
    wantedKeys: wantedKeys,
    aliasesFor: aliasesFor,
    pickUrl: pickUrl,
    sewPlan: sewPlan,
    conventionUrls: conventionUrls,
    mergeFragmentMaps: mergeFragmentMaps,
    normalizeFragmentBook: normalizeFragmentBook,
    chapterFragments: chapterFragments
  };
  root.NT_SEW = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
