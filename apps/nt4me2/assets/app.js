const HYMN_ENABLED = false;
const HYMN_GAIN = 0.15;
const ART_ROTATE = true;
const ART_MS = 12500;
let art = [];
let artRaw = [];
let artIndex = 0;
let artTimer = null;
let playing = false;
let lastKey = "";
let artSourceKey = "";
let interpretOpen = false;
let interpretFrozen = false;
let interpretScroll = 0;
let interpretIndex = {};
let cardCache = {};
let nowPick = "";
let hearGreek = true;
let showText = true;
let voiceAccent = "british";
let bibleVersion = "berean";
const BIBLE_OPTIONS = ["berean", "kjv"];
const BELIEF_OPTIONS = ["evangelical", "roman catholic", "orthodox", "none"];
const EXEGETE_VOICES = [
  { id: "matthew-henry", label: "Matthew Henry" },
  { id: "albert-barnes", label: "Albert Barnes" },
  { id: "henry-alford", label: "Henry Alford" },
  { id: "spurgeon", label: "Spurgeon" },
  { id: "wesley", label: "Wesley" },
  { id: "conservative-mixture", label: "Conservative Mixture of Experts" }
];
let beliefs = "evangelical";
let exegeteMode = "conservative-mixture";
const PREF_KEY = "daily-chapter-hear-greek";
const TEXT_KEY = "daily-chapter-show-text";
const VOICE_KEY = "daily-chapter-voice-accent";
const BIBLE_KEY = "daily-chapter-bible-version";
const BELIEF_KEY = "daily-chapter-beliefs";
const VOL_KEY = "daily-chapter-voice-volume";
const INTERPRET_MODE_KEY = "daily-chapter-interpretation-mode";
const DONE_KEY = "daily-chapter-completed";
const OTREF_KEY = "daily-chapter-ot-ref";
const WCF_KEY = "daily-chapter-westminster";
const RCC_KEY = "daily-chapter-rc-catechism";
const EXEGETE_KEY = "daily-chapter-exegete";
const TRADITION_BY_FILE = {
  // Locked rc seed (file basename). Live MartinStatus2 pictures.json tags the
  // first three; Leonardo Annunciation is in the NT pool as this display file.
  // Album-shaped pictures.json (current_album/albums) is merged when mounted.
  "mass-bolsena-raphael-vatican.jpg": "rc",
  "holy-sepulchre-roberts-jerusalem.jpg": "rc",
  "holy-sepulchre-crypt-roberts.jpg": "rc",
  "annunciation-leonardo-uffizi.jpg": "rc",
  "disputation-sacrament-raphael-vatican.jpg": "rc"
};
let voiceVolume = 1;
let interpretMode = "academic"; // "academic" or "religious"
let savedBook = "romans";
let currentChapter = 0;
let viewingBook = "";
let liveTable = {};
let fragmentTable = {};
let hearOtRef = false;
let hearWestminster = false;
let hearRcCatechism = false;
let playQueue = [];
let queueIndex = 0;
let lastSewKey = "";
let americanFallbackHint = "";
let exegeteOpen = false;

function normalizeLiveTable(data) {
  const out = {};
  if (!data || typeof data !== "object") return out;
  const books = (data.books && typeof data.books === "object") ? data.books : data;
  Object.keys(books).forEach((id) => {
    const row = books[id];
    let chapters = [];
    if (Array.isArray(row)) chapters = row;
    else if (row && Array.isArray(row.chapters)) chapters = row.chapters;
    const nums = chapters.map(Number).filter((n) => n >= 1).sort((a, b) => a - b);
    if (nums.length) out[id] = nums;
  });
  return out;
}

function sewApi() {
  return (typeof window !== "undefined" && window.NT_SEW) || {};
}

function mergeFragmentTable(raw) {
  const api = sewApi();
  const incoming = api.normalizeFragmentBook ? api.normalizeFragmentBook(raw) : {};
  Object.keys(incoming).forEach((book) => {
    fragmentTable[book] = Object.assign({}, fragmentTable[book] || {}, incoming[book]);
  });
}

async function loadLiveTable() {
  const pack = packBase();
  const urls = [(pack || "") + "/data/live.json?v=20260919k"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      liveTable = normalizeLiveTable(data);
      if (data && data.fragments) mergeFragmentTable(data.fragments);
      return;
    } catch (e) {}
  }
}

async function loadFragmentOverlay() {
  const pack = packBase();
  const urls = [(pack || "") + "/data/fragments.json?v=20260919k"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && typeof data === "object") {
        mergeFragmentTable(data.fragments || data);
      }
      return;
    } catch (e) {}
  }
}

function liveChapters(book) {
  const row = liveTable[book];
  const fromLive = Array.isArray(row) ? row.slice() : [];
  const frag = fragmentTable[book] || {};
  Object.keys(frag).forEach((ch) => {
    const n = Number(ch);
    if (n >= 1 && fromLive.indexOf(n) < 0) fromLive.push(n);
  });
  return fromLive.sort((a, b) => a - b);
}

function isLiveBook(book) {
  return liveChapters(book).length > 0;
}

function isLiveChapter(book, n) {
  return liveChapters(book).indexOf(Number(n)) >= 0;
}

function audioStem(book) {
  if (book === "matthew") return "matthew-";
  if (book === "mark") return "mark-";
  if (book === "luke") return "luke-";
  if (book === "john") return "john-";
  if (book === "romans") return "romans-";
  if (book === "1corinthians") return "1cor-";
  if (book === "2corinthians") return "2cor-";
  if (book === "galatians") return "galatians-";
  if (book === "hebrews") return "hebrews-";
  return "";
}

function artFile(item) {
  if (!item) return "";
  if (item.file) return item.file;
  const src = String(item.src || "");
  const i = src.lastIndexOf("/");
  return i >= 0 ? src.slice(i + 1) : src;
}

function normalizeBeliefs(v) {
  const s = String(v || "").trim().toLowerCase();
  return BELIEF_OPTIONS.indexOf(s) >= 0 ? s : "evangelical";
}

function chapterNowPath(book, n) {
  return (packBase() || "") + "/data/" + bibleVersion + "/" + book + "/" + n + "/now-live.json";
}

function mergeTraditionMap(data) {
  if (!data) return;
  const seen = new Set();
  const walk = (node) => {
    if (!node || seen.has(node)) return;
    if (typeof node !== "object") return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const file = artFile(node) || String(node.file || "").trim();
    const t = String(node.tradition || "").trim().toLowerCase();
    if (file && t) TRADITION_BY_FILE[file] = t;
    Object.keys(node).forEach((key) => {
      if (key === "file" || key === "src" || key === "tradition") return;
      walk(node[key]);
    });
  };
  walk(data);
}

function traditionOf(item) {
  const direct = String((item && item.tradition) || "").trim().toLowerCase();
  if (direct) return direct;
  return String(TRADITION_BY_FILE[artFile(item)] || "").toLowerCase();
}

function filterArtByBeliefs(list, belief) {
  const pool = (list || []).slice();
  if (normalizeBeliefs(belief) === "evangelical") {
    return pool.filter((item) => traditionOf(item) !== "rc");
  }
  return pool;
}

function cleanVisibleText(s) {
  return String(s || "")
    .replace(/\s*\(\s*rc\s*\)/gi, "")
    .replace(/\s*\[\s*rc\s*\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fallbackArtItem() {
  const fb = window.FALLBACK_ART || {};
  return {
    src: fb.src || "/assets/descent-cross-novgorod-tretyakov.jpg",
    file: fb.file || "descent-cross-novgorod-tretyakov.jpg",
    title: fb.title || "The Descent from the Cross",
    place: fb.place || "Tretyakov Gallery, Moscow",
    artist: fb.artist || "unknown",
    _fallback: true
  };
}

function paintArtCaption(item) {
  const title = cleanVisibleText(item && item.title);
  const place = cleanVisibleText(item && item.place);
  let artist = cleanVisibleText(item && item.artist);
  if (!artist || artist.toLowerCase() === "unknown") artist = "unknown";
  document.getElementById("cap-title").textContent = title;
  document.getElementById("cap-place").textContent = place;
  document.getElementById("cap-artist").textContent = artist;
  document.getElementById("caption").hidden = !(title || place || artist);
}

function showFallbackArt() {
  const item = fallbackArtItem();
  const img = document.getElementById("art");
  if (!img || !item.src) return;
  img.src = item.src;
  img.hidden = false;
  document.getElementById("art-empty").hidden = true;
  paintArtCaption(item);
}

function applyArtPool(list, force) {
  artRaw = (list || []).slice();
  const next = filterArtByBeliefs(artRaw, beliefs);
  const id = String(currentChapter || 0) + "::" + beliefs + "::" + artListKey(next);
  if (!force && id === artSourceKey) return;
  artSourceKey = id;
  art = ART_ROTATE ? shuffleArt(next) : (next || []).slice();
  artIndex = 0;
  lastKey = id;
  if (!art.length) {
    stopSlideshow();
    showFallbackArt();
    setInterpretRim();
    return;
  }
  holdStillArt();
}

function artListKey(list) {
  return (list || []).map(artFile).join("|");
}

function shuffleArt(list) {
  const a = (list || []).slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function cardMeta(item) {
  const file = artFile(item);
  const prefix = "__" + (interpretMode || "academic") + "__";
  const row = interpretIndex[prefix + file];
  if (!row || typeof row !== "object") return null;
  if (String(row.status || "") !== "approved") return null;
  const card = String(row.card || "").trim();
  if (!card) return null;
  return { file, card };
}

function setInterpretRim() {
  const btn = document.getElementById("interpretation");
  const isHidden = interpretMode === "none";
  btn.hidden = isHidden;
  if (isHidden) {
    if (interpretOpen) hideInterpret();
    return;
  }
  const yes = !!cardMeta(art[artIndex]);
  btn.classList.toggle("interpret-yes", yes);
  btn.classList.toggle("interpret-no", !yes);
  btn.setAttribute("aria-pressed", interpretOpen ? "true" : "false");
  const label = interpretMode === "religious"
    ? "Religious, Art Interpretation"
    : "Academic, Art Interpretation.";
  btn.textContent = label;
}

function stopSlideshow() {
  if (artTimer) {
    clearInterval(artTimer);
    artTimer = null;
  }
}

function holdStillArt() {
  startSlideshow();
}

function startSlideshow() {
  stopSlideshow();
  showArt(artIndex);
  if (!ART_ROTATE || art.length < 2) return;
  artTimer = setInterval(function () {
    showArt(artIndex + 1);
  }, ART_MS);
}

function showArt(i) {
  if (!art.length) {
    showFallbackArt();
    setInterpretRim();
    return;
  }
  artIndex = ((i % art.length) + art.length) % art.length;
  const item = art[artIndex];
  const img = document.getElementById("art");
  const nextSrc = item.src;
  const paint = () => {
    img.src = nextSrc;
    img.hidden = false;
    document.getElementById("art-empty").hidden = true;
    paintArtCaption(item);
    setInterpretRim();
    if (interpretOpen) fillInterpret(item);
  };
  if (!nextSrc) {
    showFallbackArt();
    setInterpretRim();
    return;
  }
  if (img.getAttribute("src") === nextSrc && img.complete && img.naturalWidth) {
    paint();
    return;
  }
  const probe = new Image();
  probe.onload = paint;
  probe.onerror = () => {
    if (!img.getAttribute("src")) showFallbackArt();
    setInterpretRim();
    if (interpretOpen) fillInterpret(item);
  };
  probe.src = nextSrc;
  setInterpretRim();
  if (interpretOpen) fillInterpret(item);
}

function citeLine(c) {
  const bits = [c.author, c.title, c.publication, c.date].filter(Boolean);
  return bits.join(", ");
}

function fillInterpret(item) {
  const box = document.getElementById("interpret-scroll");
  const meta = cardMeta(item);
  if (!meta) {
    box.innerHTML = '<p class="interpret-empty">No interpretation is available for this picture yet.</p>';
    return;
  }
  const card = cardCache[meta.file];
  if (!card) {
    box.innerHTML = '<p class="interpret-empty">Loading the interpretation…</p>';
    return;
  }
  const sources = Array.isArray(card.sources_header) ? card.sources_header : [];
  const body = String(card.body || "");
  const cites = Array.isArray(card.citations) ? card.citations : [];
  let html = '<div class="interpret-sources">';
  sources.forEach((s) => {
    html += "<p></p>";
  });
  html += "</div><div class=\"interpret-body\">";
  body.split(/\n\n+/).forEach(() => {
    html += "<p></p>";
  });
  html += "</div><div class=\"interpret-cites\">";
  cites.forEach(() => {
    html += "<p></p>";
  });
  html += "</div>";
  box.innerHTML = html;
  const sourcePs = box.querySelectorAll(".interpret-sources p");
  sources.forEach((s, i) => {
    sourcePs[i].textContent = s;
  });
  const bodyPs = box.querySelectorAll(".interpret-body p");
  body.split(/\n\n+/).forEach((para, i) => {
    bodyPs[i].textContent = para;
  });
  const citePs = box.querySelectorAll(".interpret-cites p");
  cites.forEach((c, i) => {
    const line = citeLine(c);
    const url = String((c && c.url) || "").trim();
    if (url && /^https?:\/\//i.test(url)) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = line || url;
      citePs[i].appendChild(a);
    } else {
      citePs[i].textContent = line;
    }
  });
}

async function loadCard(item) {
  const meta = cardMeta(item);
  if (!meta) return;
  if (cardCache[meta.file]) return;
  const pack = (window.PACK_BASE || "").replace(/\/$/, "");
  const path = (pack || "") + "/data/art/" + meta.card.replace(/^\/+/, "");
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) return;
  const card = await res.json();
  if (!card || card.status !== "approved") return;
  cardCache[meta.file] = card;
}

async function openInterpret() {
  const item = art[artIndex];
  interpretFrozen = true;
  stopSlideshow();
  setPlaying(false);
  if (exegeteOpen) hideExegete();
  await loadCard(item);
  fillInterpret(item);
  const bubble = document.getElementById("interpret-bubble");
  const scroller = document.getElementById("interpret-scroll");
  bubble.hidden = false;
  interpretOpen = true;
  scroller.scrollTop = interpretScroll || 0;
  setInterpretRim();
}

function hideInterpret() {
  const scroller = document.getElementById("interpret-scroll");
  interpretScroll = scroller.scrollTop || 0;
  document.getElementById("interpret-bubble").hidden = true;
  interpretOpen = false;
  interpretFrozen = false;
  startSlideshow();
  setInterpretRim();
}

function toggleInterpret() {
  if (interpretOpen) hideInterpret();
  else openInterpret();
}

async function openHelp() {
  closeUr();
  if (interpretOpen) hideInterpret();
  if (exegeteOpen) hideExegete();
  const box = document.getElementById("help-scroll");
  box.textContent = "";
  const pack = packBase();
  let text = "";
  try {
    const res = await fetch((pack || "") + "/data/help.txt?v=20260919k", { cache: "no-store" });
    if (res.ok) text = await res.text();
  } catch (e) {}
  const p = document.createElement("p");
  p.className = "interpret-body";
  p.style.whiteSpace = "pre-wrap";
  p.textContent = text.trim() ? text : "Waiting on the help.";
  box.appendChild(p);
  document.getElementById("help-bubble").hidden = false;
}

function hideHelp() {
  document.getElementById("help-bubble").hidden = true;
}

function toggleHelp() {
  const bubble = document.getElementById("help-bubble");
  if (!bubble.hidden) hideHelp();
  else openHelp();
}

function hideExegete() {
  const bubble = document.getElementById("exegete-bubble");
  if (bubble) bubble.hidden = true;
  exegeteOpen = false;
}

async function openExegeteVoice(id) {
  // Martin lock: exegete is audio-only. Never open a text overlay on the art.
  closeUr();
  if (interpretOpen) hideInterpret();
  hideHelp();
  hideExegete();
  const api = sewApi();
  const stem = audioStem(savedBook);
  const ch = Number(currentChapter) || 0;
  const map = collectFragmentMap(window._lastNowData || {});
  const key = "exegete-" + id;
  let url = map[key] || "";
  if (!url && api.conventionUrls) {
    const conv = api.conventionUrls(stem, ch, key, sewOptions()) || [];
    url = await firstPlayable(conv.map(mediaUrl));
  }
  const voice = document.getElementById("voice");
  const hint = document.getElementById("hint");
  if (!url || !voice) {
    if (hint) hint.textContent = "No exegete audio for this chapter yet.";
    return;
  }
  // Play only this clip — do not append into chapter sew queue.
  playQueue = [{ key: key, url: url }];
  queueIndex = 0;
  lastSewKey = "";
  setPlaying(false);
  voice.src = url;
  applyVoiceVolume();
  if (hint) hint.textContent = "Exegete: " + id.replace(/-/g, " ");
  try {
    await voice.play();
    setPlaying(true);
  } catch (e) {
    if (hint) hint.textContent = "Exegete audio could not start.";
  }
}

function applyVoiceVolume() {
  const voice = document.getElementById("voice");
  if (voice) {
    try { voice.volume = voiceVolume; } catch (e) {}
  }
}

function setVoiceVolume(v) {
  v = Number(v);
  if (!isFinite(v)) v = 1;
  if (v < 0) v = 0;
  if (v > 1) v = 1;
  voiceVolume = v;
  applyVoiceVolume();
  try { localStorage.setItem(VOL_KEY, String(voiceVolume)); } catch (e) {}
  try { localStorage.setItem(INTERPRET_MODE_KEY, String(interpretMode)); } catch (e) {}
}

function readCompleted() {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const chapter = Number(p && p.chapter);
    const book = String((p && p.book) || "");
    if (book && chapter >= 1) return { book: book, chapter: chapter };
  } catch (e) {}
  return null;
}

function writeCompleted(book, chapter) {
  const n = Number(chapter);
  if (!book || !n) return;
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify({ book: String(book), chapter: n }));
  } catch (e) {}
}

function restoreCompleted() {
  const done = readCompleted();
  if (!done) return;
  if (!isLiveChapter(done.book, done.chapter)) return;
  savedBook = done.book;
  currentChapter = done.chapter;
  nowPick = chapterNowPath(done.book, done.chapter);
}

function showVerseOverlay() {
  var viewport = document.getElementById("verse-text-viewport");
  if (!viewport) return;
  viewport.hidden = !showText;
}

function hideVerseOverlay() {
  var viewport = document.getElementById("verse-text-viewport");
  if (viewport) viewport.hidden = true;
}

function setPlaying(on) {
  playing = on;
  const voice = document.getElementById("voice");
  const hymn = document.getElementById("hymn");
  const btn = document.getElementById("play");
  applyVoiceVolume();
  if (on) {
    voice.play().catch(() => {});
    if (HYMN_ENABLED && hymn.src) {
      hymn.volume = HYMN_GAIN;
      hymn.play().catch(() => {});
    } else {
      hymn.pause();
    }
    if (btn) btn.textContent = "Pause";
    if (!interpretOpen && interpretFrozen) {
      interpretFrozen = false;
      holdStillArt();
    }
  } else {
    voice.pause();
    hymn.pause();
    if (btn) btn.textContent = "Play";
  }
}

function repeatFromStart() {
  const voice = document.getElementById("voice");
  const hymn = document.getElementById("hymn");
  if (!playQueue.length && !voice.src) return;
  queueIndex = 0;
  if (playQueue.length) {
    const first = playQueue[0].url;
    if (voice.getAttribute("src") !== first) voice.src = first;
  }
  try { voice.currentTime = 0; } catch (e) {}
  try { if (hymn.src) hymn.currentTime = 0; } catch (e) {}
  if (interpretOpen) hideInterpret();
  if (exegeteOpen) hideExegete();
  interpretFrozen = false;
  setPlaying(true);
}

function advanceSew() {
  const voice = document.getElementById("voice");
  queueIndex += 1;
  // No tone/beep between sections — next clip only, or stop.
  if (queueIndex < playQueue.length) {
    voice.src = playQueue[queueIndex].url;
    applyVoiceVolume();
    voice.play().catch(() => {});
    return;
  }
  setPlaying(false);
  if (currentChapter >= 1) writeCompleted(savedBook || "romans", currentChapter);
}

async function loadIndex() {
  interpretIndex = {};
  try {
    const pack = (window.PACK_BASE || "").replace(/\/$/, "");
    const res = await fetch((pack || "") + "/data/art/interpretations.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        Object.keys(data).forEach((key) => {
          interpretIndex["__academic__" + key] = data[key];
        });
      }
    }
  } catch (e) {}
  try {
    const pack = (window.PACK_BASE || "").replace(/\/$/, "");
    const res = await fetch((pack || "") + "/data/art/religious-interpretations.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        Object.keys(data).forEach((key) => {
          interpretIndex["__religious__" + key] = data[key];
        });
      }
    }
  } catch (e) {}
  setInterpretRim();
}

function packBase() {
  return (window.PACK_BASE || "").replace(/\/$/, "");
}

function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const pack = packBase();
  if (pack && String(path).startsWith("/")) return pack + path;
  return path;
}

async function loadPrefs() {
  hearGreek = true;
  showText = true;
  voiceAccent = "british";
  bibleVersion = "berean";
  beliefs = "evangelical";
  exegeteMode = "conservative-mixture";
  hearOtRef = false;
  hearWestminster = false;
  hearRcCatechism = false;
  voiceVolume = 1;
  interpretMode = "academic";
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === "0") hearGreek = false;
    if (v === "1") hearGreek = true;
  } catch (e) {}
  try {
    const t = localStorage.getItem(TEXT_KEY);
    if (t === "0") showText = false;
    else showText = true;
  } catch (e) {}
  try {
    const a = localStorage.getItem(VOICE_KEY);
    if (a === "american" || a === "british") voiceAccent = a;
  } catch (e) {}
  try {
    bibleVersion = normalizeBible(localStorage.getItem(BIBLE_KEY));
  } catch (e) {}
  try {
    beliefs = normalizeBeliefs(localStorage.getItem(BELIEF_KEY));
  } catch (e) {}
  try {
    const rawEx = localStorage.getItem(EXEGETE_KEY);
    if (rawEx == null || rawEx === "") exegeteMode = "conservative-mixture";
    else {
      try { exegeteMode = normalizeExegeteMode(JSON.parse(rawEx)); }
      catch (e2) { exegeteMode = normalizeExegeteMode(rawEx); }
    }
  } catch (e) {}
  try { hearOtRef = localStorage.getItem(OTREF_KEY) === "1"; } catch (e) {}
  // Ignore legacy daily-chapter-teaching if present.
  try { hearWestminster = localStorage.getItem(WCF_KEY) === "1"; } catch (e) {}
  try { hearRcCatechism = localStorage.getItem(RCC_KEY) === "1"; } catch (e) {}
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (isFinite(n)) voiceVolume = Math.max(0, Math.min(1, n));
    }
  } catch (e) {}
  try {
    const mode = localStorage.getItem(INTERPRET_MODE_KEY);
    if (mode === "religious" || mode === "academic" || mode === "none") interpretMode = mode;
  } catch (e) {}
  try {
    const res = await fetch("/api/prefs", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.hearGreek === "boolean") hearGreek = data.hearGreek;
      if (data && data.beliefs != null) beliefs = normalizeBeliefs(data.beliefs);
    }
  } catch (e) {}
  applyVoiceVolume();
  paintGreek();
  paintText();
  paintVoice();
  paintBible();
  paintBeliefs();
  paintBible();
  paintSewToggles();
  paintInterpretation();
  setInterpretRim();
}

async function savePrefs() {
  try { localStorage.setItem(PREF_KEY, hearGreek ? "1" : "0"); } catch (e) {}
  try { localStorage.setItem(TEXT_KEY, showText ? "1" : "0"); } catch (e) {}
  try { localStorage.setItem(VOICE_KEY, voiceAccent); } catch (e) {}
  try { localStorage.setItem(BIBLE_KEY, bibleVersion); } catch (e) {}
  try { localStorage.setItem(BELIEF_KEY, beliefs); } catch (e) {}
  try { localStorage.setItem(EXEGETE_KEY, JSON.stringify(exegeteMode)); } catch (e) {}
  try { localStorage.setItem(OTREF_KEY, hearOtRef ? "1" : "0"); } catch (e) {}
  try { localStorage.setItem(WCF_KEY, hearWestminster ? "1" : "0"); } catch (e) {}
  try { localStorage.setItem(RCC_KEY, hearRcCatechism ? "1" : "0"); } catch (e) {}
  try { localStorage.setItem(VOL_KEY, String(voiceVolume)); } catch (e) {}
  try {
    await fetch("/api/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearGreek: hearGreek, beliefs: beliefs }),
    });
  } catch (e) {}
}

function paintToggle(sel, on, onLabel, offLabel) {
  document.querySelectorAll(sel).forEach((btn) => {
    btn.textContent = on ? onLabel : offLabel;
    btn.classList.toggle("ur-live", !!on);
    btn.classList.toggle("ur-off", !on);
  });
}

function paintGreek() {
  paintToggle("[data-ur=greek], [data-set=greek]", hearGreek, "Greek: on", "Greek: off");
}

function paintInterpretation() {
  const btn = document.getElementById("ur-interp");
  if (btn) {
    if (interpretMode === "none") {
      btn.textContent = "Interpretation: None";
    } else if (interpretMode === "religious") {
      btn.textContent = "Interpretation: Religious";
    } else {
      btn.textContent = "Interpretation: Academic";
    }
  }
}

function showInterpretation() {
  if (interpretMode === "religious") {
    interpretMode = "none";
  } else if (interpretMode === "none") {
    interpretMode = "academic";
  } else {
    interpretMode = "religious";
  }
  paintInterpretation();
  savePrefs();
  cardCache = {};
  if (interpretOpen) {
    fillInterpret(art[artIndex]);
  }
  setInterpretRim();
}


function paintText() {
  const btn = document.getElementById("ur-text");
  if (btn) btn.textContent = showText ? "Text" : "Notext";
}

function paintVoice() {
  document.querySelectorAll("[data-ur=voice], [data-set=voice]").forEach((btn) => {
    btn.textContent = "Voice: " + (voiceAccent === "american" ? "American" : "British");
  });
}

function paintBeliefs() {
  document.querySelectorAll("[data-ur=beliefs], [data-set=belief]").forEach((btn) => {
    btn.textContent = "Belief: " + beliefs;
  });
}

function normalizeBible(v) {
  const s = String(v || "").trim().toLowerCase();
  return BIBLE_OPTIONS.indexOf(s) >= 0 ? s : "berean";
}

function bibleLabel(id) {
  return id === "kjv" ? "KJV" : "Berean";
}

function paintBible() {
  document.querySelectorAll("[data-set=bible]").forEach((btn) => {
    btn.textContent = "Bible: " + bibleLabel(bibleVersion);
  });
}

function normalizeExegeteMode(raw) {
  if (raw == null || raw === "") return "none";
  if (typeof raw === "string") {
    const s = String(raw).trim();
    if (s === "none" || s === "random") return s;
    if (EXEGETE_VOICES.some((v) => v.id === s)) return s;
    return "none";
  }
  // Legacy object map { id: true/false } → first on, else none.
  if (typeof raw === "object") {
    for (let i = 0; i < EXEGETE_VOICES.length; i++) {
      const id = EXEGETE_VOICES[i].id;
      if (raw[id]) return id;
    }
  }
  return "none";
}

function exegeteIdsOn() {
  if (!exegeteMode || exegeteMode === "none" || exegeteMode === "random") return [];
  return [exegeteMode];
}

function paintExegete() {
  paintToggle('[data-exegete="none"]', exegeteMode === "none", "None: on", "None");
  paintToggle('[data-exegete="random"]', exegeteMode === "random", "Random: on", "Random");
  EXEGETE_VOICES.forEach((v) => {
    paintToggle('[data-exegete="' + v.id + '"]', exegeteMode === v.id, v.label + ": on", v.label);
  });
}

function paintSewToggles() {
  paintToggle("[data-set=otref]", hearOtRef, "OT Ref: on", "OT Ref: off");
  paintToggle("[data-set=westminster]", hearWestminster, "Westminster: on", "Westminster: off");
  paintToggle("[data-set=rccatechism]", hearRcCatechism, "RC Catechism: on", "RC Catechism: off");
}

function albumArtFromPictures(data) {
  // Album-shaped pictures.json: prefer religious album when data.art is empty.
  if (!data || typeof data !== "object") return [];
  const albums = Array.isArray(data.albums) ? data.albums : [];
  let chosen = null;
  for (let i = 0; i < albums.length; i++) {
    if (String(albums[i].id || "").toLowerCase() === "religious") {
      chosen = albums[i];
      break;
    }
  }
  if (!chosen && albums.length) chosen = albums[0];
  const images = (chosen && Array.isArray(chosen.images)) ? chosen.images : [];
  const out = [];
  const pack = packBase();
  for (let i = 0; i < images.length; i++) {
    const im = images[i];
    if (!im) continue;
    let src = "";
    let file = "";
    if (typeof im === "string") {
      src = im;
      file = String(im).split("/").pop() || "";
    } else {
      src = String(im.src || im.path || im.url || "").trim();
      file = String(im.file || "").trim() || (src.split("/").pop() || "");
      if (!src && file) src = "data/pictures/religious/" + file;
    }
    if (!src) continue;
    if (src.charAt(0) !== "/" && !/^https?:/i.test(src)) src = "/" + src.replace(/^\/+/, "");
    out.push({
      src: mediaUrl(src),
      file: file,
      title: (im && im.title) || "",
      place: (im && (im.place || im.caption)) || "",
      artist: (im && im.artist) || "unknown"
    });
  }
  return out;
}

async function loadTraditionMap() {
  const pack = packBase();
  const urls = [
    (pack || "") + "/data/art/pictures.json",
    (pack || "") + "/data/pictures.json",
    (pack || "") + "/data/art/status.json",
    (pack || "") + "/status/pictures.json"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      // Album-shaped status catalogs (current_album / albums) or flat lists.
      mergeTraditionMap(data);
      const albumArt = albumArtFromPictures(data);
      if (albumArt.length) {
        // Keep as standing pool when now-live.art is empty.
        artRaw = albumArt;
        if (!art.length || (art.length === 1 && art[0] && art[0]._fallback)) {
          applyArtPool(artRaw, true);
        }
      }
    } catch (e) {}
  }
}

function bookLabel(id) {
  if (id === "romans") return "Romans";
  if (id === "1corinthians") return "1 Corinthians";
  if (id === "galatians") return "Galatians";
  if (id === "hebrews") return "Hebrews";
  if (id === "matthew") return "Matthew";
  return bookNameForAPI(id || "");
}

function bookNameForDisplay(id) {
  return bookLabel(id);
}

function decorateNow(data) {
  if (!data || typeof data !== "object") return {};
  if (data.audio) data.audio = mediaUrl(data.audio);
  if (Array.isArray(data.art)) {
    data.art = data.art.map((item) => {
      if (item && item.src) {
        return Object.assign({}, item, { src: mediaUrl(item.src) });
      }
      return item;
    });
  }
  return data;
}

function synthesizeNow() {
  const book = savedBook || "romans";
  const ch = Number(currentChapter) || 0;
  const stem = audioStem(book);
  const data = {
    title: bookLabel(book) + (ch ? (" " + ch) : ""),
    book: book,
    chapter: ch,
    audio: "",
    hymn: "",
    art: art.slice(),
    waiting_art: !art.length,
    waiting_audio: false,
    waiting_hymn: true
  };
  if (stem && ch && isLiveChapter(book, ch)) {
    data.audio = mediaUrl("/data/audio/" + stem + ch + "-" + bibleVersion + "-" + voiceAccent + ".mp3");
  }
  return data;
}

async function fetchNowLive(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data === "object") return decorateNow(data);
  } catch (e) {}
  return null;
}

function bibleDir() {
  return bibleVersion === "kjv" ? "kjv" : "berean";
}

function otherBibleDir() {
  return bibleDir() === "kjv" ? "berean" : "kjv";
}

async function fetchNow() {
  const pack = packBase();
  if (nowPick) {
    const picked = await fetchNowLive(nowPick);
    if (picked) return picked;
    const alt = nowPick.replace("/data/" + bibleDir() + "/", "/data/" + otherBibleDir() + "/");
    if (alt !== nowPick) {
      const fallback = await fetchNowLive(alt);
      if (fallback) return fallback;
    }
    // Explicit chapter pick must stay on that book. Never fall back to root now-live (Romans).
    return synthesizeNow();
  }
  const urls = [];
  if (pack) urls.push(pack + "/data/now-live.json");
  else urls.push("/api/now", "/data/now-live.json");
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") return decorateNow(data);
      }
    } catch (e) {}
  }
  return {};
}

function bookNameForAPI(bookId) {
  if (bookId === "1corinthians") return "1 Corinthians";
  if (bookId === "2corinthians") return "2 Corinthians";
  if (bookId === "1thessalonians") return "1 Thessalonians";
  if (bookId === "2thessalonians") return "2 Thessalonians";
  if (bookId === "1timothy") return "1 Timothy";
  if (bookId === "2timothy") return "2 Timothy";
  if (bookId === "1peter") return "1 Peter";
  if (bookId === "2peter") return "2 Peter";
  if (bookId === "1john") return "1 John";
  if (bookId === "2john") return "2 John";
  if (bookId === "3john") return "3 John";
  return bookId.charAt(0).toUpperCase() + bookId.slice(1);
}

function renderVersesToScroller(verses) {
  var scroller = document.getElementById("verse-text-scroller");
  if (!scroller) return;
  scroller.innerHTML = "";
  if (!verses || verses.length === 0) return;
  var bk = bookNameForDisplay(savedBook);
  var ch = currentChapter || "";
  verses.forEach(function (v, idx) {
    var verseText = String(v.text || "").trim();
    if (!verseText) return;
    var verseNum = v.verse || (idx + 1);
    var p = document.createElement("p");
    var label = bk && ch ? (bk + " " + ch + ":" + verseNum) : verseNum;
    p.textContent = label + " " + verseText;
    scroller.appendChild(p);
  });
}

async function fetchBereanText(book, chapter) {
  const bookName = bookNameForAPI(book);
  const reference = encodeURIComponent(bookName + " " + chapter);
  try {
    const res = await fetch("https://bible-api.com/" + reference, { cache: "force-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.verses)) return data.verses;
  } catch (e) {}
  return null;
}

async function fetchKJVText(book, chapter) {
  const bookName = bookNameForAPI(book);
  const ver = normalizeBible(version);
  if (ver === "kjv") {
    const reference = encodeURIComponent(bookName + " " + chapter);
    try {
      const res = await fetch("https://bible-api.com/" + reference + "?translation=kjv", { cache: "force-cache" });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && Array.isArray(data.verses)) return data.verses;
    } catch (e) {}
    return null;
  }
  try {
    const res = await fetch("https://bible.helloao.org/api/BSB/" + encodeURIComponent(bookName) + "/" + chapter + ".json", { cache: "force-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data && data.chapter && Array.isArray(data.chapter.content) ? data.chapter.content : [];
    const verses = rows.filter((row) => row && row.type === "verse").map((row) => ({
      verse: row.number || row.verse || "",
      text: flattenHelloaoContent(row.content).replace(/\s+/g, " ").trim()
    })).filter((v) => v.text);
    return verses.length ? verses : null;
  } catch (e) {}
  return null;
}

async function loadLocalVerses(book, chapter, version) {
  try {
    var pack = packBase();
    var path = (pack || "") + "/data/" + normalizeBible(version) + "/" + book + "/" + chapter + "/verses.json";
    var res = await fetch(path, { cache: "no-store" });
    if (res.ok) {
      var data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (data[0].text) return data;
        if (data[0].lines) {
          return data.map(function (v) {
            return { verse: v.verse || "", text: (v.lines || []).join(" ") || "" };
          });
        }
      }
    }
  } catch (e) {}
  return null;
}

async function loadVerses(book, chapter) {
  var scroller = document.getElementById("verse-text-scroller");
  if (scroller) scroller.innerHTML = "";
  if (!book || !chapter) return;
  var versesData = null;
  try {
    var pack = packBase();
    var path = (pack || "") + "/data/" + bibleVersion + "/" + book + "/" + chapter + "/verses.json";
    var res = await fetch(path, { cache: "no-store" });
    if (res.ok) {
      var data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (data[0].text) {
          versesData = data;
        } else if (data[0].lines) {
          versesData = data.map(function (v) {
            return { verse: v.verse || "", text: (v.lines || []).join(" ") || "" };
          });
        }
      }
    }
  } catch (e) {}
  if (!versesData && bibleVersion === "kjv") {
    versesData = await fetchKJVText(book, chapter);
  }
  if (!versesData && bibleVersion === "berean") {
    versesData = await fetchBereanText(book, chapter);
  }
  if (versesData && versesData.length > 0) {
    renderVersesToScroller(versesData);
  }
  showVerseOverlay();
}

function sewSettings() {
  // None → []; named → [id]; random resolved later in buildSewQueue once audio is probed.
  let selected = [];
  if (exegeteMode && exegeteMode !== "none" && exegeteMode !== "random") {
    selected = [exegeteMode];
  } else if (exegeteMode === "random") {
    selected = ["__random__"];
  }
  return {
    hearGreek: hearGreek,
    otRef: hearOtRef,
    westminster: hearWestminster,
    rcCatechism: hearRcCatechism,
    exegete: selected
  };
}

function sewOptions() {
  return { voiceAccent: voiceAccent, bibleVersion: bibleVersion, hearGreek: hearGreek };
}

function decorateFragmentMap(map) {
  const out = {};
  if (!map || typeof map !== "object") return out;
  Object.keys(map).forEach((k) => {
    if (map[k]) out[k] = mediaUrl(String(map[k]));
  });
  return out;
}

function collectFragmentMap(data) {
  const api = sewApi();
  const fromTable = api.chapterFragments
    ? api.chapterFragments(fragmentTable, savedBook, currentChapter)
    : {};
  const fromNow = (data && data.fragments && typeof data.fragments === "object") ? data.fragments : {};
  const merged = api.mergeFragmentMaps
    ? api.mergeFragmentMaps(fromTable, fromNow)
    : Object.assign({}, fromTable, fromNow);
  return decorateFragmentMap(merged);
}

function readingCandidates(stem, chapter) {
  const api = sewApi();
  const conv = api.conventionUrls ? api.conventionUrls(stem, chapter, "reading", sewOptions()) : [];
  return conv.map(mediaUrl);
}

async function probeAudio(url) {
  if (!url) return "";
  // Prefer byte-range fetch: short/odd MP3s (24 kHz ID3 clips) often miss
  // loadeddata quickly in Safari (Henry / WCF / CCC). Plain GET is the fallback
  // when a CDN answers Range oddly; Audio() is last resort.
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1" },
      cache: "no-store"
    });
    if (res.ok || res.status === 206) return url;
  } catch (e) {}
  try {
    const res2 = await fetch(url, { method: "GET", cache: "no-store" });
    if (res2.ok) return url;
  } catch (e) {}
  return await new Promise((resolve) => {
    const probe = new Audio();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      probe.removeEventListener("loadeddata", onOk);
      probe.removeEventListener("canplay", onOk);
      probe.removeEventListener("error", onErr);
      try { probe.removeAttribute("src"); probe.load(); } catch (e) {}
      resolve(ok ? url : "");
    };
    const onOk = () => finish(true);
    const onErr = () => finish(false);
    probe.addEventListener("loadeddata", onOk);
    probe.addEventListener("canplay", onOk);
    probe.addEventListener("error", onErr);
    probe.src = url;
    setTimeout(() => finish(false), 6000);
  });
}

async function firstPlayable(urls) {
  for (let i = 0; i < (urls || []).length; i++) {
    const ok = await probeAudio(urls[i]);
    if (ok) return ok;
  }
  return "";
}

async function buildSewQueue(data) {
  const api = sewApi();
  const stem = audioStem(savedBook);
  const ch = Number(currentChapter) || 0;
  const map = collectFragmentMap(data);
  const verified = {};
  const gTag = hearGreek ? "on" : "off";
  const compound = "reading-" + bibleVersion + "-" + voiceAccent + "-" + gTag;
  if (map[compound]) map.reading = map[compound];
  else if (map["reading-" + bibleVersion + "-" + voiceAccent]) map.reading = map["reading-" + bibleVersion + "-" + voiceAccent];
  if (!map.reading) {
    const readingUrl = await firstPlayable(readingCandidates(stem, ch));
    if (readingUrl) { map.reading = readingUrl; verified[readingUrl] = true; }
    else if (data && data.audio && !data.waiting_audio) {
      map.reading = mediaUrl(data.audio);
    }
  } else if (voiceAccent === "american" && !map[compound] && map["reading-american"]) {
    const am = await probeAudio(map["reading-american"]);
    if (am) { map.reading = am; verified[am] = true; }
    else americanFallbackHint = "American audio not on pack yet — playing British.";
  }
  if (map.reading && !verified[map.reading]) {
    const okRead = await probeAudio(map.reading);
    if (okRead) verified[okRead] = true;
    else delete map.reading;
  }
  let settings = sewSettings();
  // Random: probe each named exegete, pick one with audio; if none, silence (empty exegete).
  if (settings.exegete && settings.exegete[0] === "__random__") {
    const playable = [];
    for (let i = 0; i < EXEGETE_VOICES.length; i++) {
      const id = EXEGETE_VOICES[i].id;
      const key = "exegete-" + id;
      let url = map[key] || "";
      if (!url) {
        const conv = api.conventionUrls ? api.conventionUrls(stem, ch, key, sewOptions()) : [];
        url = await firstPlayable(conv.map(mediaUrl));
        if (url) map[key] = url;
      } else {
        url = await probeAudio(url);
        if (url) map[key] = url;
        else delete map[key];
      }
      if (map[key]) playable.push(id);
    }
    settings = Object.assign({}, settings, {
      exegete: playable.length ? [playable[Math.floor(Math.random() * playable.length)]] : []
    });
  }
  const wanted = api.wantedKeys ? api.wantedKeys(settings) : ["reading"];
  const extraKeys = wanted.filter((k) => k !== "reading");
  for (let i = 0; i < extraKeys.length; i++) {
    const key = extraKeys[i];
    const conv = api.conventionUrls ? api.conventionUrls(stem, ch, key, sewOptions()) : [];
    // Voice:American — prefer *-american even when a British map[key] already exists
    // (fragments/now often pin the British exegete clip).
    if (voiceAccent === "american" && !map[key + "-american"]) {
      const amOnly = conv.filter(function (u) {
        return /american\.(mp3|m4a)$/i.test(String(u || ""));
      });
      const am = await firstPlayable(amOnly.map(mediaUrl));
      if (am) {
        map[key + "-american"] = am;
        verified[am] = true;
      }
    }
    // Drop stale/404 map URLs so convention can refill (e.g. westminster present on CDN
    // but an old fragment path is broken). Never invent OT files — probe only.
    if (map[key]) {
      const ok = await probeAudio(map[key]);
      if (ok) verified[ok] = true;
      else delete map[key];
    }
    if (map[key] || map[key + "-american"]) continue;
    const found = await firstPlayable(conv.map(mediaUrl));
    if (found) {
      map[key] = found;
      verified[found] = true;
    }
  }
  // Single planner path — wantedKeys/sewPlan/conventionUrls must agree with sew.js exports.
  const planned = api.sewPlan
    ? api.sewPlan(map, settings, sewOptions())
    : { items: map.reading ? [{ key: "reading", url: map.reading }] : [], skipped: [] };
  const items = [];
  const skipped = (planned.skipped || []).slice();
  const skipReasons = {};
  (planned.skipped || []).forEach(function (k) { skipReasons[k] = "no-url"; });
  for (let i = 0; i < planned.items.length; i++) {
    const row = planned.items[i];
    // Trust URLs already proven in the extras/reading fill — a second CDN probe
    // was dropping WCF/CCC (24 kHz) even after a successful first hit.
    let ok = verified[row.url] ? row.url : await probeAudio(row.url);
    if (ok) {
      verified[ok] = true;
      items.push({ key: row.key, url: ok });
    } else {
      skipped.push(row.key);
      skipReasons[row.key] = "probe-fail";
    }
  }
  return {
    items: items,
    wanted: wanted,
    skipped: skipped,
    settings: settings,
    skipReasons: skipReasons,
    mapKeys: Object.keys(map)
  };
}

function sewKeyOf(items) {
  return (items || []).map((i) => i.key + ":" + i.url).join("|");
}

function applySewQueue(items, playAfter, meta) {
  const voice = document.getElementById("voice");
  const hint = document.getElementById("hint");
  playQueue = items || [];
  lastSewKey = sewKeyOf(playQueue);
  queueIndex = 0;
  // Keep sew debug off the picture — console + window._lastSewDebug only.
  if (meta) {
    try {
      window._lastSewDebug = {
        wanted: meta.wanted || [],
        keys: (playQueue || []).map((i) => i.key),
        skipped: meta.skipped || [],
        skipReasons: meta.skipReasons || {},
        mapKeys: meta.mapKeys || [],
        settings: meta.settings || null
      };
      console.debug("sew", window._lastSewDebug);
    } catch (e) {}
  }
  if (!playQueue.length) {
    voice.removeAttribute("src");
    try { voice.load(); } catch (e) {}
    hint.textContent = americanFallbackHint || "Waiting on the audio.";
    if (playing) setPlaying(false);
    return;
  }
  const first = playQueue[0].url;
  if (voice.getAttribute("src") !== first) voice.src = first;
  applyVoiceVolume();
  hint.textContent = americanFallbackHint || "";
  if (playAfter) setPlaying(true);
}

async function load(playAfter) {
  const data = await fetchNow();
  window._lastNowData = data;
  document.getElementById("title").textContent = data.title || "Daily reading";
  const hymn = document.getElementById("hymn");
  const hint = document.getElementById("hint");
  if (data && data.book) savedBook = String(data.book);
  const ch = chapterFromData(data);
  if (ch) currentChapter = ch;
  await loadVerses(savedBook, currentChapter);
  americanFallbackHint = "";
  let sewResult = { items: [], wanted: [], skipped: [], settings: null };
  if (audioStem(savedBook) && isLiveChapter(savedBook, currentChapter)) {
    sewResult = await buildSewQueue(data);
  }
  const items = sewResult.items || [];
  window._lastSewDebug = {
    wanted: sewResult.wanted || [],
    keys: items.map((i) => i.key),
    skipped: sewResult.skipped || [],
    skipReasons: sewResult.skipReasons || {},
    mapKeys: sewResult.mapKeys || [],
    settings: sewResult.settings || null,
    exegete: (sewResult.settings && sewResult.settings.exegete) || []
  };
  const nextKey = sewKeyOf(items);
  if (nextKey && nextKey === lastSewKey && document.getElementById("voice").getAttribute("src")) {
    // Queue unchanged — keep sew debug off the picture (see window._lastSewDebug).
    if (playAfter && items.length) setPlaying(true);
  } else {
    applySewQueue(items, playAfter, sewResult);
  }
  if (HYMN_ENABLED && data.hymn) {
    if (hymn.getAttribute("src") !== data.hymn) {
      hymn.src = data.hymn;
      hymn.volume = HYMN_GAIN;
    }
  } else {
    hymn.pause();
    hymn.removeAttribute("src");
  }
  // Prefer chapter art; if empty, keep/use album pool from pictures.json (religious).
  if (Array.isArray(data.art) && data.art.length) {
    applyArtPool(data.art);
  } else if (artRaw && artRaw.length) {
    applyArtPool(artRaw, true);
  } else {
    applyArtPool([]);
  }
  setInterpretRim();
  if (!hint.textContent && HYMN_ENABLED) {
    hint.textContent = data.waiting_hymn ? "Voice ready. Waiting on a public-domain hymn." : "Hymn stays very quiet under the voice.";
  }
}

function closeUr() {
  document.getElementById("ur-menu").hidden = true;
  document.getElementById("ur-panel").hidden = true;
  document.getElementById("ur-btn").setAttribute("aria-expanded", "false");
}

function openUrMenu() {
  const menu = document.getElementById("ur-menu");
  const open = menu.hidden;
  document.getElementById("ur-panel").hidden = true;
  menu.hidden = !open;
  document.getElementById("ur-btn").setAttribute("aria-expanded", open ? "true" : "false");
  paintText();
}

function showUrPanel(html) {
  const panel = document.getElementById("ur-panel");
  panel.innerHTML = html;
  panel.hidden = false;
  document.getElementById("ur-menu").hidden = true;
  document.getElementById("ur-btn").setAttribute("aria-expanded", "true");
}

function showSettings() {
  showUrPanel(
    '<p class="ur-head">Settings</p>' +
    '<button type="button" data-set="voice"></button>' +
    '<button type="button" data-set="bible"></button>' +
    '<button type="button" data-set="greek"></button>' +
    '<button type="button" data-set="interpretation" id="ur-interp-settings"></button>' +
    '<button type="button" data-set="belief"></button>' +
    '<button type="button" data-set="exegete">Exegete</button>' +
    '<button type="button" data-set="otref"></button>' +
    '<button type="button" data-set="westminster"></button>' +
    '<button type="button" data-set="rccatechism"></button>'
  );
  paintVoice();
  paintBible();
  paintGreek();
  // settings panel mirror of cycle label
  const sib = document.getElementById("ur-interp-settings");
  if (sib) sib.textContent = interpretMode === "religious" ? "Interpretation: Religious" : "Interpretation: Academic";
  paintBeliefs();
  paintSewToggles();
}

function showVersion() {
  const rows = [
    '<button type="button" class="ur-back" data-back="settings">Settings</button>',
    '<p class="ur-head">Bible</p>'
  ];
  BIBLE_OPTIONS.forEach((opt) => {
    const cls = opt === bibleVersion ? "ur-live" : "";
    rows.push('<button type="button" class="' + cls + '" data-bible="' + opt + '">' + bibleLabel(opt) + "</button>");
  });
  showUrPanel(rows.join(""));
}

function showBeliefs() {
  const rows = [
    '<button type="button" class="ur-back" data-back="settings">Settings</button>',
    '<p class="ur-head">Belief</p>'
  ];
  BELIEF_OPTIONS.forEach((opt) => {
    const cls = opt === beliefs ? "ur-live" : "";
    rows.push('<button type="button" class="' + cls + '" data-belief="' + opt + '">' + opt + "</button>");
  });
  showUrPanel(rows.join(""));
}

function showExegete() {
  const rows = [
    '<button type="button" class="ur-back" data-back="settings">Settings</button>',
    '<p class="ur-head">Exegete</p>',
    '<button type="button" data-exegete="none"></button>',
    '<button type="button" data-exegete="random"></button>'
  ];
  EXEGETE_VOICES.forEach((v) => {
    rows.push('<button type="button" data-exegete="' + v.id + '"></button>');
  });
  showUrPanel(rows.join(""));
  paintExegete();
}

function showVolume() {
  const v = Math.round(voiceVolume * 100);
  showUrPanel(
    '<p class="ur-head">Volume</p>' +
    '<div class="ur-vol">' +
    '<input id="ur-vol" type="range" min="0" max="100" value="' + v + '" aria-label="Spoken volume">' +
    "</div>"
  );
  const sl = document.getElementById("ur-vol");
  if (!sl) return;
  sl.addEventListener("input", () => {
    setVoiceVolume(Number(sl.value) / 100);
  });
  sl.addEventListener("click", (e) => { e.stopPropagation(); });
}

function showBooks(catalog) {
  const rows = ['<p class="ur-head">NT books</p>'];
  (catalog.books || []).forEach((b) => {
    if (isLiveBook(b.id)) {
      rows.push('<button type="button" class="ur-book ur-live" data-book="' + b.id + '">' + (b.label || b.id) + "</button>");
    } else {
      rows.push('<button type="button" class="ur-book-off" disabled tabindex="-1">' + (b.label || b.id) + "</button>");
    }
  });
  showUrPanel(rows.join(""));
}

function showChapters(book) {
  if (!book || !isLiveBook(book.id)) return;
  const live = liveChapters(book.id);
  let n = Number(book.chapters || 0);
  if (live.length) n = Math.max(n, live[live.length - 1]);
  if (!n) return;
  viewingBook = book.id;
  const on = {};
  live.forEach((c) => { on[c] = 1; });
  const rows = [
    '<button type="button" class="ur-back" data-back="books">Books</button>',
    '<p class="ur-head">' + (book.label || book.id) + " 1–" + n + "</p>"
  ];
  for (let i = 1; i <= n; i++) {
    const cls = on[i] ? "ur-live" : "ur-wait";
    rows.push('<button type="button" class="' + cls + '" data-chapter="' + i + '">' + i + "</button>");
  }
  showUrPanel(rows.join(""));
}

const NT_FALLBACK = {
  version: "KJV",
  books: [
    {id:"matthew",label:"Matthew",live:true,chapters:28},
    {id:"mark",label:"Mark",live:false,chapters:0},
    {id:"luke",label:"Luke",live:false,chapters:0},
    {id:"john",label:"John",live:false,chapters:0},
    {id:"acts",label:"Acts",live:false,chapters:0},
    {id:"romans",label:"Romans",live:true,chapters:16},
    {id:"1corinthians",label:"1 Corinthians",live:true,chapters:16},
    {id:"2corinthians",label:"2 Corinthians",live:false,chapters:0},
    {id:"galatians",label:"Galatians",live:true,chapters:6},
    {id:"ephesians",label:"Ephesians",live:false,chapters:0},
    {id:"philippians",label:"Philippians",live:false,chapters:0},
    {id:"colossians",label:"Colossians",live:false,chapters:0},
    {id:"1thessalonians",label:"1 Thessalonians",live:false,chapters:0},
    {id:"2thessalonians",label:"2 Thessalonians",live:false,chapters:0},
    {id:"1timothy",label:"1 Timothy",live:false,chapters:0},
    {id:"2timothy",label:"2 Timothy",live:false,chapters:0},
    {id:"titus",label:"Titus",live:false,chapters:0},
    {id:"philemon",label:"Philemon",live:false,chapters:0},
    {id:"hebrews",label:"Hebrews",live:true,chapters:13},
    {id:"james",label:"James",live:false,chapters:0},
    {id:"1peter",label:"1 Peter",live:false,chapters:0},
    {id:"2peter",label:"2 Peter",live:false,chapters:0},
    {id:"1john",label:"1 John",live:false,chapters:0},
    {id:"2john",label:"2 John",live:false,chapters:0},
    {id:"3john",label:"3 John",live:false,chapters:0},
    {id:"jude",label:"Jude",live:false,chapters:0},
    {id:"revelation",label:"Revelation",live:false,chapters:0}
  ]
};

async function loadCatalog() {
  const pack = packBase();
  const urls = pack ? [pack + "/data/books.json?v=20260919k"] : ["/data/books.json?v=20260919k"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.books) && data.books.length) return data;
      }
    } catch (e) {}
  }
  return NT_FALLBACK;
}

function chapterFromData(data) {
  if (data && data.book) savedBook = String(data.book);
  if (data && Number(data.chapter)) return Number(data.chapter);
  const title = String((data && data.title) || "");
  let m = title.match(/1\s*corinthians\s+(\d+)/i);
  if (m) {
    savedBook = "1corinthians";
    return Number(m[1]);
  }
  m = title.match(/romans\s+(\d+)/i);
  if (m) {
    savedBook = "romans";
    return Number(m[1]);
  }
  m = title.match(/galatians\s+(\d+)/i);
  if (m) {
    savedBook = "galatians";
    return Number(m[1]);
  }
  const p = String(nowPick || "").match(/(?:kjv|berean)\/([^/]+)\/(\d+)\//);
  if (p) {
    savedBook = p[1];
    return Number(p[2]);
  }
  const r = String(nowPick || "").match(/romans\/(\d+)\//);
  if (r) return Number(r[1]);
  return 0;
}

async function pickChapter(n, bookId) {
  n = Number(n);
  const book = bookId || viewingBook || savedBook || "romans";
  if (!isLiveChapter(book, n)) return;
  currentChapter = n;
  savedBook = book;
  const pack = packBase();
  nowPick = chapterNowPath(book, n);
  closeUr();
  showFallbackArt();
  artSourceKey = "";
  await load(true);
}

async function nextChapter() {
  const book = savedBook || "romans";
  const live = liveChapters(book);
  if (!live.length) return;
  const cur = Number(currentChapter);
  const idx = live.indexOf(cur);
  if (idx < 0 || idx >= live.length - 1) return;
  await pickChapter(live[idx + 1], book);
}

async function prevChapter() {
  const book = savedBook || "romans";
  const live = liveChapters(book);
  if (!live.length) return;
  const cur = Number(currentChapter);
  const idx = live.indexOf(cur);
  if (idx <= 0) return;
  await pickChapter(live[idx - 1], book);
}

document.getElementById("ur-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (!document.getElementById("ur-menu").hidden) closeUr();
  else openUrMenu();
});
document.getElementById("ur-menu").addEventListener("click", async (e) => {
  e.stopPropagation();
  const btn = e.target.closest("button");
  if (!btn) return;
  const kind = btn.getAttribute("data-ur");
  if (kind === "text") {
    showText = !showText;
    paintText();
    savePrefs();
    if (showText) showVerseOverlay();
    else hideVerseOverlay();
  }
  if (kind === "settings") showSettings();
  if (kind === "interpretation") {
    showInterpretation();
    closeUr();
  }
  if (kind === "volume") showVolume();
  if (kind === "book") {
    const catalog = await loadCatalog();
    window._bookCatalog = catalog;
    showBooks(catalog);
  }
  if (kind === "help") toggleHelp();
});
document.getElementById("ur-panel").addEventListener("click", async (e) => {
  e.stopPropagation();
  const btn = e.target.closest("button");
  if (!btn || btn.disabled || btn.classList.contains("ur-dead") || btn.classList.contains("ur-wait")) return;
  if (btn.getAttribute("data-back") === "books") {
    showBooks(window._bookCatalog || { books: [] });
    return;
  }
  if (btn.getAttribute("data-back") === "settings") {
    showSettings();
    return;
  }
  const set = btn.getAttribute("data-set");
  if (set === "interpretation") {
    showInterpretation();
    const sib = document.getElementById("ur-interp-settings");
    if (sib) sib.textContent = interpretMode === "religious" ? "Interpretation: Religious" : "Interpretation: Academic";
    return;
  }
  if (set === "voice") {
    voiceAccent = voiceAccent === "british" ? "american" : "british";
    paintVoice();
    savePrefs();
    load(playing);
    return;
  }
  if (set === "bible") {
    showVersion();
    return;
  }
  if (set === "exegete") {
    showExegete();
    return;
  }
  if (set === "greek") {
    hearGreek = !hearGreek;
    paintGreek();
    savePrefs();
    load(playing);
    return;
  }
  if (set === "belief") {
    showBeliefs();
    return;
  }
  if (set === "otref") {
    hearOtRef = !hearOtRef;
    paintSewToggles();
    savePrefs();
    load(playing);
    return;
  }
  if (set === "westminster") {
    hearWestminster = !hearWestminster;
    paintSewToggles();
    savePrefs();
    load(playing);
    return;
  }
  if (set === "rccatechism") {
    hearRcCatechism = !hearRcCatechism;
    paintSewToggles();
    savePrefs();
    load(playing);
    return;
  }
  const bible = btn.getAttribute("data-bible");
  if (bible) {
    bibleVersion = normalizeBible(bible);
    paintBible();
    savePrefs();
    nowPick = chapterNowPath(savedBook, currentChapter);
    lastSewKey = "";
    load(playing);
    showSettings();
    return;
  }
  const exegete = btn.getAttribute("data-exegete");
  if (exegete) {
    // Exclusive mode: none | random | named id. Audio-only — no text overlay.
    exegeteMode = normalizeExegeteMode(exegete);
    paintExegete();
    savePrefs();
    hideExegete();
    lastSewKey = "";
    // Rebuild realtime sew so the chosen exegete is IN the queue after shared sections.
    load(playing);
    return;
  }
  const belief = btn.getAttribute("data-belief");
  if (belief) {
    beliefs = normalizeBeliefs(belief);
    paintBeliefs();
    savePrefs();
    applyArtPool(artRaw, true);
    showSettings();
    return;
  }
  const bookId = btn.getAttribute("data-book");
  if (bookId) {
    const catalog = window._bookCatalog || await loadCatalog();
    const book = (catalog.books || []).find((b) => b.id === bookId);
    if (book && isLiveBook(book.id)) showChapters(book);
    return;
  }
  const ch = btn.getAttribute("data-chapter");
  if (ch) pickChapter(ch);
});
document.addEventListener("click", (e) => {
  if (e.target.closest("#ur-btn, #ur-menu, #ur-panel")) return;
  const menu = document.getElementById("ur-menu");
  const panel = document.getElementById("ur-panel");
  if (!menu.hidden || !panel.hidden) closeUr();
  if (!e.target.closest("#help-bubble") && !document.getElementById("help-bubble").hidden) {
    if (!e.target.closest("[data-ur=help]")) hideHelp();
  }
  if (!e.target.closest("#exegete-bubble") && exegeteOpen) {
    if (!e.target.closest("[data-exegete], [data-set=exegete]")) hideExegete();
  }
});

document.getElementById("play").addEventListener("click", () => {
  const voice = document.getElementById("voice");
  if (!voice.src) return;
  setPlaying(!playing);
});
document.getElementById("repeat").addEventListener("click", repeatFromStart);
document.getElementById("next").addEventListener("click", () => { nextChapter(); });
document.getElementById("back").addEventListener("click", () => { prevChapter(); });
document.getElementById("interpretation").addEventListener("click", (e) => {
  e.preventDefault();
  toggleInterpret();
});
document.getElementById("voice").addEventListener("ended", function () {
  advanceSew();
});

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

(async function boot() {
  showFallbackArt();
  await loadPrefs();
  await loadLiveTable();
  await loadFragmentOverlay();
  await loadTraditionMap();
  restoreCompleted();
  
  const bookParam = getQueryParam("book");
  if (bookParam && isLiveBook(bookParam)) {
    savedBook = bookParam;
  }
  
  const chapterParam = getQueryParam("chapter");
  if (chapterParam) {
    const ch = Number(chapterParam);
    if (ch >= 1 && isLiveChapter(savedBook, ch)) {
      currentChapter = ch;
      nowPick = chapterNowPath(savedBook, ch);
    }
  }
  
  loadIndex();
  load();
  setInterval(load, 15000);
  setInterval(loadIndex, 15000);
  setInterval(loadLiveTable, 15000);
  setInterval(loadFragmentOverlay, 15000);
  setInterval(loadTraditionMap, 60000);
})();

window.ntArtState = function () {
  return {
    beliefs: beliefs,
    files: art.map(artFile),
    raw: artRaw.map(artFile)
  };
};

window.ntSewState = function () {
  return {
    book: savedBook,
    chapter: currentChapter,
    voiceAccent: voiceAccent,
    bibleVersion: bibleVersion,
    settings: sewSettings(),
    queue: playQueue.slice(),
    index: queueIndex
  };
};
