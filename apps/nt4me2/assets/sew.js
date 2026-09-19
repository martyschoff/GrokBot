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
    "wesley"
  ];

  const EXEGETE_FILE = {
    "matthew-henry": "henry",
    "albert-barnes": "barnes",
    "henry-alford": "alford",
    "spurgeon": "spurgeon",
    "wesley": "wesley"
  };

  function optsOf(options) {
    if (!options || typeof options === "string") {
      return {
        voiceAccent: options === "american" ? "american" : "british",
        bibleVersion: "berean",
        hearGreek: false
      };
    }
    return {
      voiceAccent: options.voiceAccent === "american" ? "american" : "british",
      bibleVersion: options.bibleVersion === "kjv" ? "kjv" : "berean",
      hearGreek: !!options.hearGreek
    };
  }

  function versionCode(bibleVersion) {
    return bibleVersion === "kjv" ? "kjv" : "bsb";
  }

  function greekCode(hearGreek) {
    return hearGreek ? "greekon" : "greekoff";
  }

  function readingFileStem(opt) {
    return versionCode(opt.bibleVersion) + "-main-" + greekCode(opt.hearGreek) + "-" + opt.voiceAccent;
  }

  function exegeteFileId(key) {
    if (!key || key.indexOf("exegete-") !== 0) return "";
    const id = key.slice("exegete-".length);
    if (id === "none" || id === "random") return "";
    return EXEGETE_FILE[id] || id;
  }

  function exegeteMode(settings) {
    const voices = settings && settings.exegete;
    if (!Array.isArray(voices) || !voices.length) return "none";
    const first = String(voices[0] || "").trim().toLowerCase();
    if (!first || first === "none") return "none";
    if (first === "random") return "random";
    if (EXEGETE_IDS.indexOf(first) >= 0) return first;
    return "none";
  }

  function isCodaFragment(key, url) {
    const hit = (s) => {
      const t = String(s || "").toLowerCase();
      if (!t) return false;
      if (t === "closer" || t === "coda") return true;
      return /(?:^|[-_./])(closer|coda)(?:[-_.]|$|\.mp3)/.test(t);
    };
    return hit(key) || hit(url);
  }

  function dropCoda(items) {
    return (items || []).filter((item) => !isCodaFragment(item && item.key, item && item.url));
  }

  function isExegeteKey(key) {
    return String(key || "").indexOf("exegete-") === 0;
  }

  function selectedExegeteId(settings) {
    const mode = exegeteMode(settings);
    return mode === "none" || mode === "random" ? "" : mode;
  }

  function selectedExegeteKey(settings) {
    const mode = exegeteMode(settings);
    if (mode === "none") return "";
    if (mode === "random") return "exegete-random";
    return "exegete-" + mode;
  }

  function playableExegeteIds(availableMap, options) {
    return EXEGETE_IDS.filter((id) => !!pickUrl(availableMap, "exegete-" + id, options));
  }

  function resolveRandomExegeteId(availableMap, options) {
    const ids = playableExegeteIds(availableMap, options);
    if (!ids.length) return "";
    if (options && typeof options.pickRandom === "function") {
      const picked = String(options.pickRandom(ids.slice()) || "").trim();
      if (ids.indexOf(picked) >= 0) return picked;
    }
    return ids[Math.floor(Math.random() * ids.length)];
  }

  function chapterQueueItems(items, settings) {
    const mode = exegeteMode(settings);
    let keptExegete = false;
    return dropCoda(items).filter((item) => {
      if (isTeachingKey(item && item.key)) return false;
      if (!isExegeteKey(item && item.key)) return true;
      if (mode === "none") return false;
      if (mode === "random") {
        if (keptExegete) return false;
        keptExegete = true;
        return true;
      }
      return item.key === "exegete-" + mode;
    });
  }

  function isTeachingKey(key) {
    return String(key || "").toLowerCase() === "teaching";
  }

  function sewHintText(items, skipped) {
    const names = (items || []).map((row) => row && row.key).filter((key) => key && !isTeachingKey(key));
    let text = "Sew: " + names.join(" · ");
    const miss = (skipped || []).filter((key) => key && !isTeachingKey(key));
    if (miss.length) {
      if (names.length) text += " · ";
      text += "skipped " + miss.join(" · ");
    }
    return text;
  }

  function wantedKeys(settings) {
    const keys = ["reading"];
    if (settings && settings.otRef) keys.push("otref");
    if (settings && settings.westminster) keys.push("westminster");
    if (settings && settings.rcCatechism) keys.push("rccatechism");
    const selected = selectedExegeteKey(settings);
    if (selected) keys.push(selected);
    return keys.filter((key) => !isTeachingKey(key));
  }

  function probeKeys(settings) {
    const keys = [];
    wantedKeys(settings).forEach((key) => {
      if (key === "reading") return;
      if (key === "exegete-random") {
        EXEGETE_IDS.forEach((id) => keys.push("exegete-" + id));
        return;
      }
      keys.push(key);
    });
    return keys;
  }

  function aliasesFor(key) {
    const spec = SEW_KEYS.find((s) => s.id === key);
    if (spec) return spec.aliases.slice();
    if (key.indexOf("exegete-") === 0) {
      const short = exegeteFileId(key);
      const aliases = [key];
      if (short && aliases.indexOf("exegete-" + short) < 0) aliases.push("exegete-" + short);
      return aliases;
    }
    return [key];
  }

  function pickUrl(map, key, options) {
    if (!map || typeof map !== "object") return "";
    const opt = optsOf(options);
    if (key === "reading") {
      const stem = readingFileStem(opt);
      const compound = map["reading-" + stem] || map[stem]
        || map["reading-" + opt.bibleVersion + "-" + opt.voiceAccent]
        || map[opt.bibleVersion + "-" + opt.voiceAccent];
      if (compound) return String(compound);
    }
    const aliases = aliasesFor(key);
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
    const selected = selectedExegeteKey(settings);
    for (let i = 0; i < wanted.length; i++) {
      const key = wanted[i];
      if (isTeachingKey(key)) {
        continue;
      }
      if (isCodaFragment(key)) {
        skipped.push(key);
        continue;
      }
      if (key === "exegete-random") {
        const id = resolveRandomExegeteId(availableMap, options);
        const url = id ? pickUrl(availableMap, "exegete-" + id, options) : "";
        if (id && url && !isCodaFragment("exegete-" + id, url)) {
          items.push({ key: "exegete-" + id, url: url });
        } else {
          skipped.push(key);
        }
        continue;
      }
      if (isExegeteKey(key) && key !== selected) {
        skipped.push(key);
        continue;
      }
      const url = pickUrl(availableMap, key, options);
      if (url && !isCodaFragment(key, url)) items.push({ key: key, url: url });
      else skipped.push(key);
    }
    return { items: chapterQueueItems(items, settings), skipped: skipped };
  }

  function conventionUrls(stem, chapter, key, options) {
    if (!stem || !chapter || !key || isTeachingKey(key)) return [];
    if (key === "exegete-random" || key === "exegete-none") return [];
    const opt = optsOf(options);
    const base = "/data/audio/" + stem + chapter;
    const urls = [];
    const push = (u) => {
      if (u && urls.indexOf(u) < 0) urls.push(u);
    };
    if (key === "reading") {
      push(base + "-" + readingFileStem(opt) + ".mp3");
      push(base + "-" + opt.bibleVersion + "-" + opt.voiceAccent + ".mp3");
      if (opt.voiceAccent === "american") {
        push(base + "-american.mp3");
        push(base + "-american-nogrk.mp3");
      } else {
        push(base + ".mp3");
        push(base + "-nogrk.mp3");
      }
      return urls;
    }
    if (key === "greek") {
      push(base + "-greek.mp3");
      return urls;
    }
    if (key === "otref") {
      push(base + "-ot-ref.mp3");
      push(base + "-otref.mp3");
      return urls;
    }
    if (key === "rccatechism") {
      push(base + "-ccc.mp3");
      push(base + "-rccatechism.mp3");
      return urls;
    }
    if (key.indexOf("exegete-") === 0) {
      const short = exegeteFileId(key);
      if (short) push(base + "-exegete-" + short + ".mp3");
      push(base + "-" + key + ".mp3");
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
    exegeteMode: exegeteMode,
    playableExegeteIds: playableExegeteIds,
    probeKeys: probeKeys,
    isCodaFragment: isCodaFragment,
    dropCoda: dropCoda,
    chapterQueueItems: chapterQueueItems,
    sewHintText: sewHintText,
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
