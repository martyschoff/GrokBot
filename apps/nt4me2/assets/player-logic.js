(function (root) {
  const NT_FALLBACK = {
    version: "KJV",
    books: [
      {id:"matthew",label:"Matthew",live:false,chapters:0},
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

  function expandChapters(row) {
    if (Array.isArray(row)) return row.slice();
    if (row && Array.isArray(row.chapters)) return row.chapters.slice();
    const n = Number(row && row.chapters);
    if (n >= 1) {
      const out = [];
      for (let i = 1; i <= n; i++) out.push(i);
      return out;
    }
    return [];
  }

  function cleanChapterNums(list) {
    return list.map(Number).filter((n) => n >= 1).sort((a, b) => a - b);
  }

  function normalizeLiveTable(data) {
    const out = {};
    if (!data || typeof data !== "object") return out;
    const books = (data.books && typeof data.books === "object") ? data.books : data;
    if (Array.isArray(books)) {
      books.forEach((row) => {
        if (!row || !row.id) return;
        if (row.live === false) return;
        const nums = cleanChapterNums(expandChapters(row));
        if (nums.length) out[String(row.id)] = nums;
      });
      return out;
    }
    Object.keys(books).forEach((id) => {
      const row = books[id];
      if (row && row.live === false) return;
      const nums = cleanChapterNums(expandChapters(row));
      if (nums.length) out[id] = nums;
    });
    return out;
  }

  function liveChapters(table, book) {
    const row = table && table[book];
    return Array.isArray(row) ? row.slice() : [];
  }

  function isLiveBook(table, book) {
    return liveChapters(table, book).length > 0;
  }

  function isLiveChapter(table, book, n) {
    return liveChapters(table, book).indexOf(Number(n)) >= 0;
  }

  function nextLiveChapter(table, book, cur) {
    const live = liveChapters(table, book);
    if (!live.length) return null;
    const n = Number(cur);
    const idx = live.indexOf(n);
    if (idx >= 0) return idx < live.length - 1 ? live[idx + 1] : null;
    const after = live.find((c) => c > n);
    return after == null ? null : after;
  }

  function prevLiveChapter(table, book, cur) {
    const live = liveChapters(table, book);
    if (!live.length) return null;
    const n = Number(cur);
    const idx = live.indexOf(n);
    if (idx > 0) return live[idx - 1];
    if (idx === 0) return null;
    const before = live.filter((c) => c < n);
    return before.length ? before[before.length - 1] : null;
  }

  function audioStem(book) {
    if (book === "romans") return "romans-";
    if (book === "1corinthians") return "1cor-";
    if (book === "hebrews") return "hebrews-";
    return "";
  }

  function bookLabel(id) {
    if (id === "romans") return "Romans";
    if (id === "1corinthians") return "1 Corinthians";
    if (id === "hebrews") return "Hebrews";
    return id || "";
  }

  function artFile(item) {
    if (!item) return "";
    if (item.file) return item.file;
    const src = String(item.src || "");
    const i = src.lastIndexOf("/");
    return i >= 0 ? src.slice(i + 1) : src;
  }

  function artListKey(list) {
    return (list || []).map(artFile).join("|");
  }

  function citeLine(c) {
    if (!c || typeof c !== "object") return "";
    const bits = [c.author, c.title, c.publication, c.date].filter(Boolean);
    return bits.join(", ");
  }

  function hasMediaSrc(el) {
    if (!el) return false;
    const attr = typeof el.getAttribute === "function" ? el.getAttribute("src") : el.src;
    return !!(attr && String(attr).trim());
  }

  function mediaUrl(path, pack) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const base = String(pack || "").replace(/\/$/, "");
    if (base && String(path).startsWith("/")) return base + path;
    return path;
  }

  function chapterFromPayload(data, nowPick) {
    let book = "";
    if (data && data.book) book = String(data.book);
    if (data && Number(data.chapter)) {
      return { book: book, chapter: Number(data.chapter) };
    }
    const title = String((data && data.title) || "");
    let m = title.match(/1\s*corinthians\s+(\d+)/i);
    if (m) return { book: "1corinthians", chapter: Number(m[1]) };
    m = title.match(/hebrews\s+(\d+)/i);
    if (m) return { book: "hebrews", chapter: Number(m[1]) };
    m = title.match(/romans\s+(\d+)/i);
    if (m) return { book: "romans", chapter: Number(m[1]) };
    const p = String(nowPick || "").match(/kjv\/([^/]+)\/(\d+)\//);
    if (p) return { book: p[1], chapter: Number(p[2]) };
    const r = String(nowPick || "").match(/romans\/(\d+)\//);
    if (r) return { book: book || "romans", chapter: Number(r[1]) };
    return { book: book, chapter: 0 };
  }

  const api = {
    NT_FALLBACK,
    normalizeLiveTable,
    liveChapters,
    isLiveBook,
    isLiveChapter,
    nextLiveChapter,
    prevLiveChapter,
    audioStem,
    bookLabel,
    artFile,
    artListKey,
    citeLine,
    hasMediaSrc,
    mediaUrl,
    chapterFromPayload
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NT4 = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
