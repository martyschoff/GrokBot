const HYMN_ENABLED = false;
const HYMN_GAIN = 0.15;
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
const BELIEF_OPTIONS = ["evangelical", "roman catholic", "orthodox", "none"];
let beliefs = "evangelical";
const PREF_KEY = "daily-chapter-hear-greek";
const TEXT_KEY = "daily-chapter-show-text";
const VOICE_KEY = "daily-chapter-voice-accent";
const BELIEF_KEY = "daily-chapter-beliefs";
const VOL_KEY = "daily-chapter-voice-volume";
const DONE_KEY = "daily-chapter-completed";
const TRADITION_BY_FILE = {
  // Locked rc seed (file basename). Live MartinStatus2 pictures.json tags the
  // first three; Leonardo Annunciation is in the NT pool as this display file.
  // Album-shaped pictures.json (current_album/albums) is merged when mounted.
  "mass-bolsena-raphael-vatican.jpg": "rc",
  "holy-sepulchre-roberts-jerusalem.jpg": "rc",
  "holy-sepulchre-crypt-roberts.jpg": "rc",
  "annunciation-leonardo-uffizi.jpg": "rc"
};
let voiceVolume = 1;
let savedBook = "romans";
let currentChapter = 0;
let viewingBook = "";
let liveTable = {};

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

async function loadLiveTable() {
  const pack = packBase();
  const urls = [(pack || "") + "/data/live.json?v=20260912hj"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      liveTable = normalizeLiveTable(data);
      return;
    } catch (e) {}
  }
}

function liveChapters(book) {
  const row = liveTable[book];
  return Array.isArray(row) ? row.slice() : [];
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
  art = shuffleArt(next);
  artIndex = 0;
  lastKey = id;
  if (!art.length) {
    stopSlideshow();
    showFallbackArt();
    setInterpretRim();
    return;
  }
  if (!interpretFrozen) startSlideshow();
  else showArt(artIndex);
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
  const row = interpretIndex[file];
  if (!row || typeof row !== "object") return null;
  if (String(row.status || "") !== "approved") return null;
  const card = String(row.card || "").trim();
  if (!card) return null;
  return { file, card };
}

function setInterpretRim() {
  const btn = document.getElementById("interpretation");
  const yes = !!cardMeta(art[artIndex]);
  btn.classList.toggle("interpret-yes", yes);
  btn.classList.toggle("interpret-no", !yes);
  btn.setAttribute("aria-pressed", interpretOpen ? "true" : "false");
}

function stopSlideshow() {
  if (artTimer) {
    clearInterval(artTimer);
    artTimer = null;
  }
}

function startSlideshow() {
  stopSlideshow();
  if (!art.length) {
    showArt(0);
    return;
  }
  showArt(artIndex);
  if (interpretFrozen) return;
  artTimer = setInterval(() => showArt(artIndex + 1), ART_MS);
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
  const box = document.getElementById("help-scroll");
  box.textContent = "";
  const pack = packBase();
  let text = "";
  try {
    const res = await fetch((pack || "") + "/data/help.txt", { cache: "no-store" });
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
  nowPick = (packBase() || "") + "/data/kjv/" + done.book + "/" + done.chapter + "/now-live.json";
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
      startSlideshow();
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
  if (!voice.src) return;
  try { voice.currentTime = 0; } catch (e) {}
  try { if (hymn.src) hymn.currentTime = 0; } catch (e) {}
  if (interpretOpen) hideInterpret();
  interpretFrozen = false;
  setPlaying(true);
}

async function loadIndex() {
  try {
    const pack = (window.PACK_BASE || "").replace(/\/$/, "");
    const res = await fetch((pack || "") + "/data/art/interpretations.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data === "object") interpretIndex = data;
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
  beliefs = "evangelical";
  voiceVolume = 1;
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
    beliefs = normalizeBeliefs(localStorage.getItem(BELIEF_KEY));
  } catch (e) {}
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (isFinite(n)) voiceVolume = Math.max(0, Math.min(1, n));
    }
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
  paintBeliefs();
}

async function savePrefs() {
  try { localStorage.setItem(PREF_KEY, hearGreek ? "1" : "0"); } catch (e) {}
  try { localStorage.setItem(TEXT_KEY, showText ? "1" : "0"); } catch (e) {}
  try { localStorage.setItem(VOICE_KEY, voiceAccent); } catch (e) {}
  try { localStorage.setItem(BELIEF_KEY, beliefs); } catch (e) {}
  try { localStorage.setItem(VOL_KEY, String(voiceVolume)); } catch (e) {}
  try {
    await fetch("/api/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearGreek: hearGreek, beliefs: beliefs }),
    });
  } catch (e) {}
}

function paintGreek() {
  const btn = document.getElementById("ur-greek");
  if (btn) btn.textContent = hearGreek ? "Greek: on" : "Greek: off";
}

function paintText() {
  const btn = document.getElementById("ur-text");
  if (btn) btn.textContent = showText ? "Text" : "Notext";
}

function paintVoice() {
  const btn = document.getElementById("ur-voice");
  if (btn) btn.textContent = "Voice: " + (voiceAccent === "american" ? "American" : "British");
}

function paintBeliefs() {
  const btn = document.getElementById("ur-beliefs");
  if (btn) btn.textContent = "Beliefs: " + beliefs;
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
    } catch (e) {}
  }
}

function bookLabel(id) {
  if (id === "romans") return "Romans";
  if (id === "1corinthians") return "1 Corinthians";
  return id || "";
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
    data.audio = mediaUrl("/data/audio/" + stem + ch + ".mp3");
  }
  return data;
}

async function fetchNow() {
  const pack = packBase();
  if (nowPick) {
    try {
      const res = await fetch(nowPick, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") return decorateNow(data);
      }
    } catch (e) {}
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

async function fetchKJVText(book, chapter) {
  const bookName = bookNameForAPI(book);
  const reference = encodeURIComponent(bookName + " " + chapter);
  try {
    const res = await fetch("https://bible-api.com/" + reference + "?translation=kjv", { cache: "force-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.verses)) {
      return data.verses;
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
    var path = (pack || "") + "/data/kjv/" + book + "/" + chapter + "/verses.json";
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
  if (!versesData) {
    versesData = await fetchKJVText(book, chapter);
  }
  if (versesData && versesData.length > 0) {
    renderVersesToScroller(versesData);
  }
  showVerseOverlay();
}

async function load(playAfter) {
  const data = await fetchNow();
  document.getElementById("title").textContent = data.title || "Daily reading";
  const voice = document.getElementById("voice");
  const hymn = document.getElementById("hymn");
  const hint = document.getElementById("hint");
  if (data && data.book) savedBook = String(data.book);
  const ch = chapterFromData(data);
  if (ch) currentChapter = ch;
  await loadVerses(savedBook, currentChapter);
  const stem = audioStem(savedBook);
  if (stem && isLiveChapter(savedBook, currentChapter)) {
    let suffix = "";
    if (voiceAccent === "american") suffix = "-american";
    if (!hearGreek) suffix += "-nogrk";
    let preferredUrl = mediaUrl("/data/audio/" + stem + currentChapter + suffix + ".mp3");
    
    // Always rebuild live audio URL from voiceAccent + greek-off; don't let now-live.audio lock british
    if (voiceAccent === "american" || !hearGreek) {
      data.audio = preferredUrl;
      hint.textContent = "";
      // Probe american audio existence with Audio element (avoids CORS issues)
      if (voiceAccent === "american") {
        const probe = new Audio();
        let probeResolved = false;
        const onLoadedData = () => {
          if (!probeResolved) {
            probeResolved = true;
            cleanup();
          }
        };
        const onError = () => {
          if (!probeResolved) {
            probeResolved = true;
            // American audio not available, fall back to british equivalent
            let fallbackSuffix = "";
            if (!hearGreek) fallbackSuffix = "-nogrk";
            data.audio = mediaUrl("/data/audio/" + stem + currentChapter + fallbackSuffix + ".mp3");
            hint.textContent = "American audio not on pack yet — playing British.";
            // Update voice element with fallback
            if (voice.getAttribute("src") !== data.audio) voice.src = data.audio;
            cleanup();
          }
        };
        const cleanup = () => {
          probe.removeEventListener("loadeddata", onLoadedData);
          probe.removeEventListener("canplay", onLoadedData);
          probe.removeEventListener("error", onError);
          probe.src = "";
        };
        probe.addEventListener("loadeddata", onLoadedData);
        probe.addEventListener("canplay", onLoadedData);
        probe.addEventListener("error", onError);
        probe.src = preferredUrl;
      }
    } else if (!data.audio || data.waiting_audio) {
      data.audio = preferredUrl;
    }
  }
  if (data.audio) {
    if (voice.getAttribute("src") !== data.audio) voice.src = data.audio;
    applyVoiceVolume();
    if (!hint.textContent) {
      hint.textContent = HYMN_ENABLED
        ? (data.waiting_hymn ? "Voice ready. Waiting on a public-domain hymn." : "Hymn stays very quiet under the voice.")
        : "";
    }
  } else {
    voice.removeAttribute("src");
    hint.textContent = "Waiting on the audio.";
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
  applyArtPool(data.art || []);
  setInterpretRim();
  if (playAfter && data.audio) setPlaying(true);
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
  paintVoice();
  paintGreek();
  paintBeliefs();
}

function showUrPanel(html) {
  const panel = document.getElementById("ur-panel");
  panel.innerHTML = html;
  panel.hidden = false;
  document.getElementById("ur-menu").hidden = true;
  document.getElementById("ur-btn").setAttribute("aria-expanded", "true");
}

function showVersion() {
  showUrPanel(
    '<button type="button" class="ur-live">KJV</button>' +
    '<button type="button" class="ur-dead" disabled>NIV</button>'
  );
}

function showBeliefs() {
  const rows = ['<p class="ur-head">Beliefs</p>'];
  BELIEF_OPTIONS.forEach((opt) => {
    const cls = opt === beliefs ? "ur-live" : "";
    rows.push('<button type="button" class="' + cls + '" data-belief="' + opt + '">' + opt + "</button>");
  });
  showUrPanel(rows.join(""));
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
    {id:"galatians",label:"Galatians",live:false,chapters:0},
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
  const urls = pack ? [pack + "/data/books.json?v=20260912hj"] : ["/data/books.json?v=20260912hj"];
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
  const p = String(nowPick || "").match(/kjv\/([^/]+)\/(\d+)\//);
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
  nowPick = (pack || "") + "/data/kjv/" + book + "/" + n + "/now-live.json";
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
  if (kind === "voice") {
    voiceAccent = voiceAccent === "british" ? "american" : "british";
    paintVoice();
    savePrefs();
    load(playing);
  }
  if (kind === "version") showVersion();
  if (kind === "greek") {
    hearGreek = !hearGreek;
    paintGreek();
    savePrefs();
    load(playing);
  }
  if (kind === "beliefs") showBeliefs();
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
  const belief = btn.getAttribute("data-belief");
  if (belief) {
    beliefs = normalizeBeliefs(belief);
    paintBeliefs();
    savePrefs();
    applyArtPool(artRaw, true);
    closeUr();
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
  setPlaying(false);
  if (currentChapter >= 1) writeCompleted(savedBook || "romans", currentChapter);
});

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

(async function boot() {
  showFallbackArt();
  await loadPrefs();
  await loadLiveTable();
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
      nowPick = (packBase() || "") + "/data/kjv/" + savedBook + "/" + ch + "/now-live.json";
    }
  }
  
  loadIndex();
  load();
  setInterval(load, 15000);
  setInterval(loadIndex, 15000);
  setInterval(loadLiveTable, 15000);
  setInterval(loadTraditionMap, 60000);
})();

window.ntArtState = function () {
  return {
    beliefs: beliefs,
    files: art.map(artFile),
    raw: artRaw.map(artFile)
  };
};
