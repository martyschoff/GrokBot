(function (root) {
  const SEW_KEYS = [
    { id: "reading", aliases: ["reading", "chapter", "audio"] },
    { id: "greek", aliases: ["greek"] },
    { id: "otref", aliases: ["otref", "ot_ref", "ot-ref", "ot"] },
    { id: "westminster", aliases: ["westminster", "wcf"] },
    { id: "rccatechism", aliases: ["rccatechism", "rc-catechism", "rc_catechism", "ccc", "rcc"] }
  ];

  const EXEGETE_IDS = [
    "matthew-henry",
    "albert-barnes",
    "henry-alford",
    "spurgeon",
    "wesley",
    "john-calvin",
    "conservative-mixture"
  ];

  function optsOf(options) {
    if (!options || typeof options === "string") {
      return {
        voiceAccent: options === "american" ? "american" : "british",
        bibleVersion: "berean",
        hearGreek: true
      };
    }
    return {
      voiceAccent: options.voiceAccent === "american" ? "american" : "british",
      bibleVersion: options.bibleVersion === "kjv" ? "kjv" : "berean",
      hearGreek: options.hearGreek !== false
    };
  }

  function wantedKeys(settings) {
    const keys = ["reading"];
    // Greek on/off is baked into the main Kokoro filename (greekon|greekoff), not a separate fragment.
    if (settings && settings.otRef) keys.push("otref");
    // At most ONE selected exegete — third after reading + OT Ref (Martin lock 20 Sep 26).
    // Teaching stays removed. Never substitute another voice.
    const voices = (settings && settings.exegete) || [];
    if (voices.length) {
      const id = String(voices[0] || "").trim();
      if (id) keys.push("exegete-" + id);
    }
    if (settings && settings.westminster) keys.push("westminster");
    if (settings && settings.rcCatechism) keys.push("rccatechism");
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
      const g = opt.hearGreek ? "on" : "off";
      const compound = map["reading-" + opt.bibleVersion + "-" + opt.voiceAccent + "-" + g]
        || map["reading-" + opt.bibleVersion + "-" + opt.voiceAccent]
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
    // stem is like "galatians-" → base "/data/audio/galatians-1"
    const base = "/data/audio/" + stem + chapter;
    const versionTag = opt.bibleVersion === "kjv" ? "kjv" : "bsb";
    const accent = opt.voiceAccent === "american" ? "american" : "british";
    const greekTag = opt.hearGreek ? "greekon" : "greekoff";
    const urls = [];
    const push = (u) => {
      if (u && urls.indexOf(u) < 0) urls.push(u);
    };
    if (key === "reading") {
      // Kokoro: galatians-1-bsb-main-greekon-british.mp3
      push(base + "-" + versionTag + "-main-" + greekTag + "-" + accent + ".mp3");
      // legacy fallbacks
      push(base + "-" + versionTag + "-" + accent + ".mp3");
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
      // Voice:American — prefer *-otref-american / *-ot-ref-american first
      if (accent === "american") {
        push(base + "-ot-ref-american.mp3");
        push(base + "-otref-american.mp3");
      }
      push(base + "-ot-ref.mp3");
      push(base + "-otref.mp3");
      return urls;
    }
    if (key === "westminster") {
      // Voice:American — prefer *-westminster-american first (Martin lock 20 Sep 26).
      if (accent === "american") {
        push(base + "-westminster-american.mp3");
      }
      push(base + "-westminster.mp3");
      return urls;
    }
    if (key === "rccatechism") {
      // Voice:American — prefer *-ccc-american / *-rccatechism-american first.
      if (accent === "american") {
        push(base + "-ccc-american.mp3");
        push(base + "-rccatechism-american.mp3");
      }
      push(base + "-ccc.mp3");
      push(base + "-rccatechism.mp3");
      return urls;
    }
    if (key.indexOf("exegete-") === 0) {
      const id = key.slice("exegete-".length);
      const shortMap = {
        "matthew-henry": "henry",
        "albert-barnes": "barnes",
        "henry-alford": "alford",
        "spurgeon": "spurgeon",
        "wesley": "wesley",
        "john-calvin": "calvin"
      };
      const short = shortMap[id] || id;
      // American first when Voice:American — else British-only names remain the fallback.
      if (accent === "american") {
        push(base + "-exegete-" + short + "-american.mp3");
        push(base + "-exegete-" + id + "-american.mp3");
      }
      // Prefer AAC/m4a when present (Safari-safe); keep mp3 fallbacks.
      push(base + "-exegete-" + short + ".m4a");
      push(base + "-exegete-" + id + ".m4a");
      push(base + "-exegete-" + short + ".mp3");
      push(base + "-exegete-" + id + ".mp3");
      return urls;
    }
    push(base + "-" + key + ".mp3");
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
