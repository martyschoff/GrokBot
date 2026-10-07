(function (root) {
  // Sliding fetch window for album stills. The visible slide is index 0 of
  // the window; the page <img> loads that URL. This module only starts
  // fetches for the following slots, and it never walks the rest of the album.
  var DEFAULT_WINDOW = 4;

  function artPrefetchIndexes(length, index, windowSize) {
    var n = length | 0;
    var size = windowSize | 0;
    if (n <= 0 || size <= 0) return [];
    var count = Math.min(size, n);
    var start = ((index % n) + n) % n;
    var out = [];
    var step;
    for (step = 0; step < count; step++) out.push((start + step) % n);
    return out;
  }

  function srcAt(items, idx) {
    var item = items && items[idx];
    if (!item || item.src == null || item.src === "") return "";
    return String(item.src);
  }

  function createArtWindow(options) {
    var windowSize = (options && options.windowSize) || DEFAULT_WINDOW;
    var createImage = options && options.createImage;
    var slots = new Map();

    function release(entry) {
      if (entry && typeof entry.cancel === "function") entry.cancel();
    }

    function reset() {
      slots.forEach(release);
      slots.clear();
    }

    function sync(list, index) {
      var items = list || [];
      var wanted = artPrefetchIndexes(items.length, index, windowSize);
      var start = wanted.length ? wanted[0] : 0;
      var keep = new Set(wanted);
      var keepSrc = new Set();
      var i;
      for (i = 0; i < wanted.length; i++) {
        var kept = srcAt(items, wanted[i]);
        if (kept) keepSrc.add(kept);
      }
      Array.from(slots.keys()).forEach(function (idx) {
        var entry = slots.get(idx);
        var src = srcAt(items, idx);
        var stillAhead = keep.has(idx) && idx !== start && entry && entry.src === src;
        if (stillAhead) return;
        slots.delete(idx);
        // The visible <img> takes over a URL that is still inside the window.
        // Aborting that probe would cancel the slide that is about to show.
        if (entry && keepSrc.has(entry.src)) return;
        release(entry);
      });
      for (i = 0; i < wanted.length; i++) {
        var idx = wanted[i];
        if (idx === start) continue;
        var src = srcAt(items, idx);
        if (!src || slots.has(idx)) continue;
        var cancel = function () {};
        if (typeof createImage === "function") {
          var made = createImage(src) || {};
          if (typeof made.cancel === "function") cancel = made.cancel;
        }
        slots.set(idx, { src: src, cancel: cancel });
      }
      return {
        window: windowSize,
        index: start,
        indexes: wanted,
        srcs: wanted.map(function (idx) { return srcAt(items, idx); }),
        ahead: wanted.filter(function (idx) { return idx !== start; }).map(function (idx) {
          return srcAt(items, idx);
        }).filter(Boolean)
      };
    }

    return { sync: sync, reset: reset };
  }

  var api = {
    windowSize: DEFAULT_WINDOW,
    artPrefetchIndexes: artPrefetchIndexes,
    createArtWindow: createArtWindow
  };
  root.NT_ART_PREFETCH = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
