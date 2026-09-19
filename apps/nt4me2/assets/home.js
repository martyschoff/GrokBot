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
    {id:"hebrews",label:"Hebrews",live:false,chapters:0},
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

let liveTable = {};
let fragmentTable = {};

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
  const urls = [(pack || "") + "/data/live.json?v=20260919e"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      liveTable = normalizeLiveTable(data);
      if (data && data.fragments) mergeHomeFragments(data.fragments);
      applyCatalogLiveFallback(NT_FALLBACK);
      return;
    } catch (e) {}
  }
  applyCatalogLiveFallback(NT_FALLBACK);
}

function applyCatalogLiveFallback(catalog) {
  (catalog && catalog.books ? catalog.books : []).forEach((b) => {
    if (!b || !b.live || liveTable[b.id]) return;
    const n = Number(b.chapters || 0);
    if (n < 1) return;
    const chs = [];
    for (let i = 1; i <= n; i++) chs.push(i);
    liveTable[b.id] = chs;
  });
}

async function loadFragmentOverlay() {
  const pack = packBase();
  try {
    const res = await fetch((pack || "") + "/data/fragments.json?v=20260919e", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    mergeHomeFragments((data && data.fragments) || data);
  } catch (e) {}
}

function mergeHomeFragments(raw) {
  if (!raw || typeof raw !== "object") return;
  Object.keys(raw).forEach((book) => {
    const chs = raw[book];
    if (!chs || typeof chs !== "object") return;
    fragmentTable[book] = Object.assign({}, fragmentTable[book] || {}, chs);
  });
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

function packBase() {
  return (window.PACK_BASE || "").replace(/\/$/, "");
}

async function loadCatalog() {
  const pack = packBase();
  const urls = pack ? [pack + "/data/books.json?v=20260919e"] : ["/data/books.json?v=20260919e"];
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

async function renderBooks() {
  await loadLiveTable();
  await loadFragmentOverlay();
  const catalog = await loadCatalog();
  const nav = document.getElementById("books-nav");
  
  if (!nav) return;
  
  const liveBooks = (catalog.books || [])
    .filter((b) => isLiveBook(b.id));
  
  liveBooks.forEach((book) => {
    const a = document.createElement("a");
    a.href = `player.html?book=${book.id}&chapter=1`;
    a.textContent = book.label || book.id;
    nav.appendChild(a);
  });
}

(async function boot() {
  await renderBooks();
})();
