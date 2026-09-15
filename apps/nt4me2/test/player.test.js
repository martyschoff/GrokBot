const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { jsonResponse, loadPlayer, notFound, textResponse } = require("./harness");

describe("normalizeLiveTable", () => {
  let app;

  beforeEach(() => {
    ({ app } = loadPlayer());
  });

  it("returns an empty object for missing or non-object input", () => {
    assert.deepEqual(app.normalizeLiveTable(null), {});
    assert.deepEqual(app.normalizeLiveTable("romans"), {});
    assert.deepEqual(app.normalizeLiveTable(undefined), {});
  });

  it("accepts a wrapped books object or a flat book map", () => {
    assert.deepEqual(
      app.normalizeLiveTable({ books: { romans: [3, 1, 2] } }),
      { romans: [1, 2, 3] }
    );
    assert.deepEqual(
      app.normalizeLiveTable({ romans: { chapters: ["2", "1"] } }),
      { romans: [1, 2] }
    );
  });

  it("drops invalid chapter numbers and books with no live chapters", () => {
    assert.deepEqual(
      app.normalizeLiveTable({
        romans: [0, -4, 8, "9", "nope"],
        hebrews: [],
        acts: { chapters: null },
      }),
      { romans: [8, 9] }
    );
  });
});

describe("live chapter helpers", () => {
  let app;

  beforeEach(() => {
    ({ app } = loadPlayer({
      state: { liveTable: { romans: [1, 3, 8], "1corinthians": [13] } },
    }));
  });

  it("copies live rows and reports live books/chapters", () => {
    const row = app.liveChapters("romans");
    assert.deepEqual(row, [1, 3, 8]);
    row.push(16);
    assert.deepEqual(app.liveChapters("romans"), [1, 3, 8]);
    assert.equal(app.isLiveBook("romans"), true);
    assert.equal(app.isLiveBook("hebrews"), false);
    assert.equal(app.isLiveChapter("romans", "3"), true);
    assert.equal(app.isLiveChapter("romans", 2), false);
  });
});

describe("audio and media URLs", () => {
  it("maps known books to audio stems and leaves others blank", () => {
    const { app } = loadPlayer();
    assert.equal(app.audioStem("romans"), "romans-");
    assert.equal(app.audioStem("1corinthians"), "1cor-");
    assert.equal(app.audioStem("hebrews"), "");
  });

  it("labels known books and falls back to the raw id", () => {
    const { app } = loadPlayer();
    assert.equal(app.bookLabel("romans"), "Romans");
    assert.equal(app.bookLabel("1corinthians"), "1 Corinthians");
    assert.equal(app.bookLabel("jude"), "jude");
    assert.equal(app.bookLabel(""), "");
  });

  it("strips a trailing slash from PACK_BASE", () => {
    const { app } = loadPlayer({ PACK_BASE: "/pack/" });
    assert.equal(app.packBase(), "/pack");
  });

  it("rewrites pack-relative media and leaves absolute URLs alone", () => {
    const { app } = loadPlayer({ PACK_BASE: "/pack/" });
    assert.equal(app.mediaUrl(""), "");
    assert.equal(app.mediaUrl("https://cdn.example/a.mp3"), "https://cdn.example/a.mp3");
    assert.equal(app.mediaUrl("http://cdn.example/a.mp3"), "http://cdn.example/a.mp3");
    assert.equal(app.mediaUrl("/data/audio/romans-8.mp3"), "/pack/data/audio/romans-8.mp3");
    assert.equal(app.mediaUrl("relative.jpg"), "relative.jpg");
  });

  it("does not prefix root-relative paths when PACK_BASE is empty", () => {
    const { app } = loadPlayer({ PACK_BASE: "" });
    assert.equal(app.mediaUrl("/data/audio/romans-8.mp3"), "/data/audio/romans-8.mp3");
  });
});

describe("decorateNow and synthesizeNow", () => {
  it("rewrites audio and art sources through mediaUrl", () => {
    const { app } = loadPlayer({ PACK_BASE: "/pack" });
    const out = app.decorateNow({
      audio: "/data/audio/romans-1.mp3",
      art: [
        { src: "/data/art/a.jpg", title: "A" },
        { title: "no src" },
      ],
    });
    assert.equal(out.audio, "/pack/data/audio/romans-1.mp3");
    assert.equal(out.art[0].src, "/pack/data/art/a.jpg");
    assert.equal(out.art[0].title, "A");
    assert.equal(out.art[1].title, "no src");
  });

  it("returns an empty object for non-object payloads", () => {
    const { app } = loadPlayer();
    assert.deepEqual(app.decorateNow(null), {});
    assert.deepEqual(app.decorateNow("x"), {});
  });

  it("synthesizes live audio only when the book has a stem and the chapter is live", () => {
    const { app } = loadPlayer({
      state: {
        savedBook: "romans",
        currentChapter: 8,
        liveTable: { romans: [8], hebrews: [3] },
        art: [{ src: "/a.jpg" }],
      },
    });
    const live = app.synthesizeNow();
    assert.equal(live.title, "Romans 8");
    assert.equal(live.audio, "/data/audio/romans-8.mp3");
    assert.equal(live.waiting_art, false);
    assert.equal(live.waiting_hymn, true);

    app.setState({ savedBook: "hebrews", currentChapter: 3 });
    const noStem = app.synthesizeNow();
    assert.equal(noStem.title, "hebrews 3");
    assert.equal(noStem.audio, "");

    app.setState({ savedBook: "romans", currentChapter: 2 });
    const notLive = app.synthesizeNow();
    assert.equal(notLive.audio, "");
    assert.equal(notLive.waiting_art, false);
  });
});

describe("art helpers", () => {
  let app;

  beforeEach(() => {
    ({ app } = loadPlayer());
  });

  it("prefers an explicit file name and otherwise takes the src basename", () => {
    assert.equal(app.artFile(null), "");
    assert.equal(app.artFile({ file: "kept.jpg", src: "/other/x.jpg" }), "kept.jpg");
    assert.equal(app.artFile({ src: "/data/art/scene.jpg" }), "scene.jpg");
    assert.equal(app.artFile({ src: "plain.png" }), "plain.png");
  });

  it("builds a stable key from art files", () => {
    assert.equal(app.artListKey(null), "");
    assert.equal(
      app.artListKey([{ src: "/a/one.jpg" }, { file: "two.jpg" }]),
      "one.jpg|two.jpg"
    );
  });

  it("shuffles a copy and keeps the same members", () => {
    const list = [{ file: "a" }, { file: "b" }, { file: "c" }];
    const shuffled = app.shuffleArt(list);
    assert.notEqual(shuffled, list);
    assert.deepEqual(list, [{ file: "a" }, { file: "b" }, { file: "c" }]);
    assert.deepEqual(
      shuffled.map((item) => item.file).sort(),
      ["a", "b", "c"]
    );
    assert.deepEqual(app.shuffleArt([]), []);
    assert.deepEqual(app.shuffleArt(null), []);
  });

  it("only exposes approved interpretation cards with text", () => {
    app.setState({
      interpretIndex: {
        "scene.jpg": { status: "approved", card: " cards/scene.json " },
        "draft.jpg": { status: "draft", card: "cards/draft.json" },
        "empty.jpg": { status: "approved", card: "   " },
      },
    });
    assert.deepEqual(app.cardMeta({ src: "/art/scene.jpg" }), {
      file: "scene.jpg",
      card: "cards/scene.json",
    });
    assert.equal(app.cardMeta({ file: "draft.jpg" }), null);
    assert.equal(app.cardMeta({ file: "empty.jpg" }), null);
    assert.equal(app.cardMeta({ file: "missing.jpg" }), null);
  });

  it("joins citation fields and skips blanks", () => {
    assert.equal(
      app.citeLine({
        author: "Spurgeon",
        title: "Take Heed",
        publication: "",
        date: "1884",
      }),
      "Spurgeon, Take Heed, 1884"
    );
    assert.equal(app.citeLine({}), "");
  });
});

describe("chapterFromData", () => {
  it("uses an explicit numeric chapter and book", () => {
    const { app } = loadPlayer();
    assert.equal(app.chapterFromData({ book: "1corinthians", chapter: "4" }), 4);
    assert.equal(app.getState().savedBook, "1corinthians");
  });

  it("parses 1 Corinthians and Romans titles", () => {
    const { app } = loadPlayer();
    assert.equal(app.chapterFromData({ title: "1 Corinthians 13" }), 13);
    assert.equal(app.getState().savedBook, "1corinthians");
    assert.equal(app.chapterFromData({ title: "Romans 8" }), 8);
    assert.equal(app.getState().savedBook, "romans");
  });

  it("reads a kjv nowPick path, then a romans-only path", () => {
    const { app } = loadPlayer({
      state: { nowPick: "/data/kjv/1corinthians/13/now-live.json" },
    });
    assert.equal(app.chapterFromData({}), 13);
    assert.equal(app.getState().savedBook, "1corinthians");

    app.setState({ nowPick: "/legacy/romans/5/now-live.json" });
    assert.equal(app.chapterFromData({}), 5);
  });

  it("returns 0 when nothing can be parsed", () => {
    const { app } = loadPlayer();
    assert.equal(app.chapterFromData(null), 0);
    assert.equal(app.chapterFromData({ title: "Daily reading" }), 0);
  });
});

describe("chapter navigation", () => {
  let app;

  beforeEach(() => {
    ({ app } = loadPlayer({
      state: { liveTable: { romans: [1, 3, 8] } },
    }));
  });

  it("moves only to an adjacent live chapter and does not wrap", () => {
    assert.equal(app.nextLiveChapterNumber("romans", 1), 3);
    assert.equal(app.nextLiveChapterNumber("romans", 8), null);
    assert.equal(app.nextLiveChapterNumber("romans", 2), null);
    assert.equal(app.nextLiveChapterNumber("hebrews", 1), null);
    assert.equal(app.prevLiveChapterNumber("romans", 8), 3);
    assert.equal(app.prevLiveChapterNumber("romans", 1), null);
    assert.equal(app.prevLiveChapterNumber("romans", 2), null);
  });

  it("rejects pickChapter for chapters that are not live", async () => {
    app.setState({ currentChapter: 1, savedBook: "romans", nowPick: "" });
    await app.pickChapter(2, "romans");
    assert.equal(app.getState().currentChapter, 1);
    assert.equal(app.getState().nowPick, "");
  });

  it("records an explicit nowPick path for a live chapter", async () => {
    const fetched = [];
    const { app: player } = loadPlayer({
      PACK_BASE: "/pack/",
      state: { liveTable: { romans: [1, 8] } },
      fetch: async (url) => {
        fetched.push(String(url));
        return notFound();
      },
    });
    player.bindPlayerUi();
    await player.pickChapter(8, "romans");
    assert.equal(player.getState().currentChapter, 8);
    assert.equal(player.getState().savedBook, "romans");
    assert.equal(player.getState().nowPick, "/pack/data/kjv/romans/8/now-live.json");
    assert.ok(fetched.includes("/pack/data/kjv/romans/8/now-live.json"));
  });
});

describe("fetchNow", () => {
  it("uses a successful explicit chapter payload", async () => {
    const { app } = loadPlayer({
      state: { nowPick: "/data/kjv/romans/8/now-live.json" },
      fetch: async (url) => {
        if (url === "/data/kjv/romans/8/now-live.json") {
          return jsonResponse({ title: "Romans 8", audio: "https://cdn.example/r8.mp3" });
        }
        return notFound();
      },
    });
    const data = await app.fetchNow();
    assert.equal(data.title, "Romans 8");
    assert.equal(data.audio, "https://cdn.example/r8.mp3");
  });

  it("does not fall back to root now-live when an explicit pick fails", async () => {
    const fetched = [];
    const { app } = loadPlayer({
      state: {
        nowPick: "/data/kjv/1corinthians/13/now-live.json",
        savedBook: "1corinthians",
        currentChapter: 13,
        liveTable: { "1corinthians": [13] },
      },
      fetch: async (url) => {
        fetched.push(String(url));
        return notFound();
      },
    });
    const data = await app.fetchNow();
    assert.equal(data.book, "1corinthians");
    assert.equal(data.chapter, 13);
    assert.equal(data.audio, "/data/audio/1cor-13.mp3");
    assert.deepEqual(fetched, ["/data/kjv/1corinthians/13/now-live.json"]);
    assert.ok(!fetched.some((url) => url === "/api/now" || url === "/data/now-live.json"));
  });

  it("walks /api/now then /data/now-live.json when no chapter is picked", async () => {
    const fetched = [];
    const { app } = loadPlayer({
      fetch: async (url) => {
        fetched.push(String(url));
        if (url === "/data/now-live.json") {
          return jsonResponse({ title: "Romans 1", audio: "/data/audio/romans-1.mp3" });
        }
        return notFound();
      },
    });
    const data = await app.fetchNow();
    assert.deepEqual(fetched, ["/api/now", "/data/now-live.json"]);
    assert.equal(data.title, "Romans 1");
    assert.equal(data.audio, "/data/audio/romans-1.mp3");
  });
});

describe("voice volume and completed chapters", () => {
  it("clamps volume and persists it", () => {
    const { app, window } = loadPlayer();
    app.bindPlayerUi();
    app.setVoiceVolume(1.8);
    assert.equal(app.getState().voiceVolume, 1);
    app.setVoiceVolume(-2);
    assert.equal(app.getState().voiceVolume, 0);
    app.setVoiceVolume("0.25");
    assert.equal(app.getState().voiceVolume, 0.25);
    assert.equal(window.localStorage.getItem(app.VOL_KEY), "0.25");
    app.setVoiceVolume("nope");
    assert.equal(app.getState().voiceVolume, 1);
  });

  it("reads only valid completed book/chapter pairs", () => {
    const { app, window } = loadPlayer();
    assert.equal(app.readCompleted(), null);
    window.localStorage.setItem(app.DONE_KEY, "{not-json");
    assert.equal(app.readCompleted(), null);
    window.localStorage.setItem(app.DONE_KEY, JSON.stringify({ book: "romans", chapter: 0 }));
    assert.equal(app.readCompleted(), null);
    window.localStorage.setItem(app.DONE_KEY, JSON.stringify({ book: "", chapter: 8 }));
    assert.equal(app.readCompleted(), null);
    window.localStorage.setItem(app.DONE_KEY, JSON.stringify({ book: "romans", chapter: 8 }));
    assert.deepEqual(app.readCompleted(), { book: "romans", chapter: 8 });
  });

  it("writes completed progress and restores it only when that chapter is live", () => {
    const { app, window } = loadPlayer({
      PACK_BASE: "/pack",
      state: { liveTable: { romans: [8] } },
    });
    app.writeCompleted("", 8);
    assert.equal(window.localStorage.getItem(app.DONE_KEY), null);
    app.writeCompleted("romans", 0);
    assert.equal(window.localStorage.getItem(app.DONE_KEY), null);
    app.writeCompleted("romans", 8);
    assert.deepEqual(JSON.parse(window.localStorage.getItem(app.DONE_KEY)), {
      book: "romans",
      chapter: 8,
    });

    app.resetForTests();
    app.setState({ liveTable: { romans: [1] } });
    window.localStorage.setItem(app.DONE_KEY, JSON.stringify({ book: "romans", chapter: 8 }));
    app.restoreCompleted();
    assert.equal(app.getState().currentChapter, 0);

    app.setState({ liveTable: { romans: [8] } });
    app.restoreCompleted();
    assert.equal(app.getState().savedBook, "romans");
    assert.equal(app.getState().currentChapter, 8);
    assert.equal(app.getState().nowPick, "/pack/data/kjv/romans/8/now-live.json");
  });

  it("lets /api/prefs override a stored Greek preference", async () => {
    const { app, window } = loadPlayer({
      fetch: async (url) => {
        if (url === "/api/prefs") return jsonResponse({ hearGreek: false });
        return notFound();
      },
    });
    window.localStorage.setItem(app.PREF_KEY, "1");
    app.bindPlayerUi();
    await app.loadPrefs();
    assert.equal(app.getState().hearGreek, false);
    assert.equal(window.document.getElementById("ur-greek").textContent, "Greek: off");
  });
});

describe("load audio selection", () => {
  it("uses the no-Greek stem when hearGreek is off", async () => {
    const { app, document } = loadPlayer({
      state: {
        hearGreek: false,
        savedBook: "romans",
        currentChapter: 8,
        liveTable: { romans: [8] },
        nowPick: "/data/kjv/romans/8/now-live.json",
      },
      fetch: async (url) => {
        if (url === "/data/kjv/romans/8/now-live.json") {
          return jsonResponse({
            title: "Romans 8",
            book: "romans",
            chapter: 8,
            audio: "/data/audio/romans-8.mp3",
          });
        }
        return notFound();
      },
    });
    app.bindPlayerUi();
    await app.load(false);
    assert.equal(document.getElementById("voice").getAttribute("src"), "/data/audio/romans-8-nogrk.mp3");
    assert.equal(document.getElementById("title").textContent, "Romans 8");
  });

  it("fills waiting audio from the live stem when Greek is on", async () => {
    const { app, document } = loadPlayer({
      state: {
        hearGreek: true,
        savedBook: "romans",
        currentChapter: 8,
        liveTable: { romans: [8] },
        nowPick: "/data/kjv/romans/8/now-live.json",
      },
      fetch: async (url) => {
        if (url === "/data/kjv/romans/8/now-live.json") {
          return jsonResponse({
            title: "Romans 8",
            book: "romans",
            chapter: 8,
            waiting_audio: true,
          });
        }
        return notFound();
      },
    });
    app.bindPlayerUi();
    await app.load(false);
    assert.equal(document.getElementById("voice").getAttribute("src"), "/data/audio/romans-8.mp3");
  });

  it("shows a waiting hint when no audio is available", async () => {
    const { app, document } = loadPlayer({
      fetch: async () => jsonResponse({ title: "Daily reading" }),
    });
    app.bindPlayerUi();
    await app.load(false);
    assert.equal(document.getElementById("voice").getAttribute("src"), null);
    assert.equal(document.getElementById("hint").textContent, "Waiting on the audio.");
    assert.equal(document.getElementById("title").textContent, "Daily reading");
  });
});

describe("art captions and interpretations", () => {
  it("hides the image and shows the empty state when there is no art", () => {
    const { app, document } = loadPlayer();
    app.bindPlayerUi();
    app.setState({ art: [] });
    app.showArt(0);
    assert.equal(document.getElementById("art").hidden, true);
    assert.equal(document.getElementById("art-empty").hidden, false);
    assert.equal(document.getElementById("caption").hidden, true);
  });

  it("wraps the art index and normalizes an unknown artist", () => {
    const { app, document } = loadPlayer();
    app.bindPlayerUi();
    app.setState({
      art: [
        { src: "/one.jpg", title: "One", place: "Rome", artist: "Unknown" },
        { src: "/two.jpg", title: "Two", place: "Corinth", artist: "Raphael" },
      ],
      artIndex: 0,
    });
    app.showArt(-1);
    assert.equal(app.getState().artIndex, 1);
    assert.equal(document.getElementById("art").src, "https://player.test/two.jpg");
    assert.equal(document.getElementById("cap-artist").textContent, "Raphael");
    app.showArt(0);
    assert.equal(document.getElementById("cap-title").textContent, "One");
    assert.equal(document.getElementById("cap-artist").textContent, "unknown");
    assert.equal(document.getElementById("caption").hidden, false);
  });

  it("renders interpretation text safely and only linkifies http(s) citations", () => {
    const { app, document } = loadPlayer();
    app.bindPlayerUi();
    app.setState({
      interpretIndex: { "scene.jpg": { status: "approved", card: "scene.json" } },
      cardCache: {
        "scene.jpg": {
          status: "approved",
          sources_header: ["<script>bad()</script> KJV"],
          body: "First paragraph\n\nSecond <img src=x>",
          citations: [
            {
              author: "Spurgeon",
              title: "Take Heed",
              url: "https://www.spurgeon.org/sermons/take-heed-brethren",
            },
            { author: "Local note", url: "javascript:alert(1)" },
          ],
        },
      },
    });
    app.fillInterpret({ file: "scene.jpg" });
    const box = document.getElementById("interpret-scroll");
    assert.equal(box.querySelector(".interpret-sources p").textContent, "<script>bad()</script> KJV");
    assert.equal(box.querySelector(".interpret-sources p").innerHTML.includes("<script>"), false);
    const body = [...box.querySelectorAll(".interpret-body p")].map((p) => p.textContent);
    assert.deepEqual(body, ["First paragraph", "Second <img src=x>"]);
    const cites = box.querySelectorAll(".interpret-cites p");
    const link = cites[0].querySelector("a");
    assert.equal(link.href, "https://www.spurgeon.org/sermons/take-heed-brethren");
    assert.equal(link.target, "_blank");
    assert.equal(link.rel, "noopener noreferrer");
    assert.equal(cites[1].querySelector("a"), null);
    assert.equal(cites[1].textContent, "Local note");
  });

  it("shows empty and loading interpretation states", () => {
    const { app, document } = loadPlayer();
    app.bindPlayerUi();
    app.fillInterpret({ file: "missing.jpg" });
    assert.match(
      document.getElementById("interpret-scroll").textContent,
      /No interpretation is available/
    );
    app.setState({
      interpretIndex: { "scene.jpg": { status: "approved", card: "scene.json" } },
      cardCache: {},
    });
    app.fillInterpret({ file: "scene.jpg" });
    assert.match(document.getElementById("interpret-scroll").textContent, /Loading the interpretation/);
  });
});

describe("book panel", () => {
  it("marks only live catalog books as choosable", () => {
    const { app, document } = loadPlayer({
      state: { liveTable: { romans: [1] } },
    });
    app.bindPlayerUi();
    app.showBooks({
      books: [
        { id: "romans", label: "Romans" },
        { id: "hebrews", label: "Hebrews" },
      ],
    });
    const panel = document.getElementById("ur-panel");
    assert.equal(panel.hidden, false);
    assert.equal(panel.querySelector('[data-book="romans"]').classList.contains("ur-live"), true);
    assert.equal(panel.querySelector(".ur-book-off").disabled, true);
    assert.equal(panel.querySelector(".ur-book-off").textContent, "Hebrews");
  });

  it("lists live chapters as ur-live and others as ur-wait", () => {
    const { app, document } = loadPlayer({
      state: { liveTable: { romans: [1, 8] } },
    });
    app.bindPlayerUi();
    app.showChapters({ id: "romans", label: "Romans", chapters: 8 });
    const buttons = [...document.querySelectorAll("#ur-panel [data-chapter]")];
    assert.equal(buttons.length, 8);
    assert.equal(buttons[0].className, "ur-live");
    assert.equal(buttons[1].className, "ur-wait");
    assert.equal(buttons[7].className, "ur-live");
    assert.equal(app.getState().viewingBook, "romans");
  });

  it("falls back to the built-in NT catalog when books.json is missing", async () => {
    const { app } = loadPlayer({ fetch: async () => notFound() });
    const catalog = await app.loadCatalog();
    assert.equal(catalog, app.NT_FALLBACK);
    const live = catalog.books.filter((b) => b.live).map((b) => b.id);
    assert.deepEqual(live, ["romans", "1corinthians"]);
  });
});

describe("loadLiveTable", () => {
  it("loads and normalizes /data/live.json from the pack", async () => {
    const { app } = loadPlayer({
      PACK_BASE: "/pack/",
      fetch: async (url) => {
        if (url === "/pack/data/live.json") {
          return jsonResponse({ books: { romans: [8, 1] } });
        }
        return notFound();
      },
    });
    await app.loadLiveTable();
    assert.deepEqual(app.getState().liveTable, { romans: [1, 8] });
  });
});
