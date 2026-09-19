(function (root) {
  const SEW_KEYS = [
    { id: "reading", aliases: ["reading", "chapter", "audio"] },
    { id: "greek", aliases: ["greek"] },
    { id: "otref", aliases: ["otref", "ot_ref", "ot-ref", "ot"] },
    { id: "teaching", aliases: ["teaching"] },
    { id: "westminster", aliases: ["westminster", "wcf"] },
    { id: "rccatechism", aliases: ["rccatechism", "rc-catechism", "rc_catechism", "ccc", "rcc"] }
  ];

  function wantedKeys(settings) {
    const keys = ["reading"];
    if (settings && settings.hearGreek) keys.push("greek");
    if (settings && settings.otRef) keys.push("otref");
    if (settings && settings.teaching) keys.push("teaching");
    if (settings && settings.westminster) keys.push("westminster");
    if (settings && settings.rcCatechism) keys.push("rccatechism");
    return keys;
  }

  function aliasesFor(key) {
    const spec = SEW_KEYS.find((s) => s.id === key);
    return spec ? spec.aliases.slice() : [key];
  }

  function pickUrl(map, key, voiceAccent) {
    if (!map || typeof map !== "object") return "";
    const aliases = aliasesFor(key);
    if (voiceAccent === "american") {
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
    const accent = options && options.voiceAccent;
    const wanted = wantedKeys(settings);
    const items = [];
    const skipped = [];
    for (let i = 0; i < wanted.length; i++) {
      const key = wanted[i];
      const url = pickUrl(availableMap, key, accent);
      if (url) items.push({ key: key, url: url });
      else skipped.push(key);
    }
    return { items: items, skipped: skipped };
  }

  function conventionUrls(stem, chapter, key, voiceAccent) {
    if (!stem || !chapter || !key) return [];
    const base = "/data/audio/" + stem + chapter;
    const urls = [];
    if (key === "reading") {
      if (voiceAccent === "american") {
        urls.push(base + "-american.mp3");
        urls.push(base + "-american-nogrk.mp3");
      }
      urls.push(base + ".mp3");
      urls.push(base + "-nogrk.mp3");
      return urls;
    }
    if (voiceAccent === "american") urls.push(base + "-american-" + key + ".mp3");
    urls.push(base + "-" + key + ".mp3");
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
