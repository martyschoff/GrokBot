(function (root) {
  function fileName(item) {
    if (!item) return "";
    if (typeof item === "string") {
      const i = item.lastIndexOf("/");
      return i >= 0 ? item.slice(i + 1) : item;
    }
    if (item.file) return String(item.file);
    const src = String(item.src || item.name || item.path || "");
    const i = src.lastIndexOf("/");
    return i >= 0 ? src.slice(i + 1) : src;
  }

  function albumPictures(album) {
    if (!album) return [];
    if (Array.isArray(album)) return album;
    if (Array.isArray(album.pictures)) return album.pictures;
    if (Array.isArray(album.art)) return album.art;
    if (Array.isArray(album.items)) return album.items;
    return [];
  }

  function albumLabel(album) {
    if (!album || typeof album !== "object" || Array.isArray(album)) return "";
    return String(album.name || album.id || album.album || album.slug || "").trim();
  }

  function preferredAlbumName(data) {
    if (!data || typeof data !== "object") return "religious";
    const albums = data.albums;
    if (albums && !Array.isArray(albums) && albums.religious) return "religious";
    if (Array.isArray(albums)) {
      const hit = albums.find((a) => /religious/i.test(albumLabel(a)));
      if (hit) return albumLabel(hit) || "religious";
    }
    const current = String(data.current_album || "").trim();
    if (current) return current;
    if (albums && !Array.isArray(albums)) {
      const keys = Object.keys(albums);
      if (keys.indexOf("religious") >= 0) return "religious";
      if (keys.length) return keys[0];
    }
    return "religious";
  }

  function picturesFromCatalog(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    const albums = data.albums;
    if (!albums) {
      if (Array.isArray(data.pictures)) return data.pictures;
      if (Array.isArray(data.art)) return data.art;
      return [];
    }
    if (!Array.isArray(albums)) {
      if (albums.religious) return albumPictures(albums.religious);
      const name = preferredAlbumName(data);
      if (name && albums[name]) return albumPictures(albums[name]);
      const keys = Object.keys(albums);
      return keys.length ? albumPictures(albums[keys[0]]) : [];
    }
    const religious = albums.find((a) => /religious/i.test(albumLabel(a)));
    if (religious) return albumPictures(religious);
    const currentName = String(data.current_album || "").trim();
    const current = albums.find((a) => albumLabel(a) === currentName);
    if (current) return albumPictures(current);
    return albumPictures(albums[0]);
  }

  function albumArtFromPictures(data, options) {
    const album = preferredAlbumName(data);
    const media = (options && options.mediaUrl) || function (p) { return p; };
    const out = [];
    const seen = {};
    picturesFromCatalog(data).forEach((pic) => {
      if (typeof pic === "string") {
        const file = fileName(pic);
        if (!file || seen[file]) return;
        seen[file] = true;
        const src = /^\//.test(pic) || /^https?:/i.test(pic)
          ? media(pic)
          : media("/data/pictures/" + album + "/" + file);
        out.push({ file: file, src: src, title: "", place: "", artist: "" });
        return;
      }
      if (!pic || typeof pic !== "object") return;
      const file = fileName(pic);
      if (!file && !pic.src) return;
      const src = pic.src
        ? media(pic.src)
        : media("/data/pictures/" + album + "/" + (file || ""));
      const key = file || src;
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push({
        file: file || fileName(src),
        src: src,
        title: pic.title || "",
        place: pic.place || "",
        artist: pic.artist || "",
        tradition: pic.tradition || ""
      });
    });
    return out;
  }

  const api = {
    preferredAlbumName: preferredAlbumName,
    picturesFromCatalog: picturesFromCatalog,
    albumArtFromPictures: albumArtFromPictures,
    fileName: fileName
  };
  root.NT_ART_ALBUM = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
