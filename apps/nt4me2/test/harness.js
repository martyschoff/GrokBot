const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const APP_JS = path.resolve(__dirname, "../assets/app.js");
const INDEX_HTML = path.resolve(__dirname, "../index.html");

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function textResponse(text, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("not json");
    },
    text: async () => String(text),
  };
}

function notFound() {
  return {
    ok: false,
    status: 404,
    json: async () => ({}),
    text: async () => "",
  };
}

function stubMedia(el) {
  if (!el) return;
  el.play = async () => {};
  el.pause = () => {};
  if (typeof el.volume !== "number") el.volume = 1;
}

function loadPlayer(options = {}) {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const dom = new JSDOM(html, {
    url: options.url || "https://player.test/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.PACK_BASE = options.PACK_BASE != null ? options.PACK_BASE : "";
  const fetchImpl = options.fetch || (async () => notFound());
  window.fetch = fetchImpl;

  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  global.fetch = fetchImpl;
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.Event = window.Event;

  delete require.cache[require.resolve(APP_JS)];
  const app = require(APP_JS);
  app.resetForTests();
  if (options.state) app.setState(options.state);
  stubMedia(window.document.getElementById("voice"));
  stubMedia(window.document.getElementById("hymn"));
  return { app, window, document: window.document, dom };
}

module.exports = {
  jsonResponse,
  loadPlayer,
  notFound,
  textResponse,
};
