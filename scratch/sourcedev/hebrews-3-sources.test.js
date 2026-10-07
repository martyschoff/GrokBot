const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "hebrews-3-sources.txt"), "utf8");

function quoted(blockStart) {
  const i = SRC.indexOf(blockStart);
  assert.ok(i >= 0, "missing block: " + blockStart);
  const slice = SRC.slice(i, i + 800);
  const m = slice.match(/—\s*"([^"]+)"/);
  assert.ok(m, "missing quotation after " + blockStart);
  return m[1];
}

test("OT citations use Psalm 95 KJV wording, not the Hebrews restatement", () => {
  const psalm78 = quoted("Psalm 95:7–8");
  assert.match(psalm78, /Harden not your heart,/);
  assert.match(psalm78, /and as in the day of temptation/);
  assert.doesNotMatch(psalm78, /Harden not your hearts, as in the provocation, in the day/);

  const psalm911 = quoted("Psalm 95:9–11");
  assert.match(psalm911, /saw my work\./);
  assert.match(psalm911, /Forty years long was I grieved with this generation/);
  assert.match(psalm911, /Unto whom I sware in my wrath that they should not enter into my rest/);
  assert.doesNotMatch(psalm911, /saw my works forty years/);
  assert.doesNotMatch(psalm911, /They do alway err/);
});

test("OT list is marked citations only: no implied Exodus padding", () => {
  assert.doesNotMatch(SRC, /Exodus 17/);
  assert.doesNotMatch(SRC, /implied through wilderness/);
  assert.match(SRC, /Psalm 95:7–8 \(Heb 3:7–8\)/);
  assert.match(SRC, /Psalm 95:9–11 \(Heb 3:9–11\)/);
  assert.match(SRC, /Psalm 95:7 \(Heb 3:15\)/);
});

test("CCC records the Hebrews 3 citation instead of claiming silence", () => {
  assert.match(SRC, /CCC:\s*1165/);
  assert.match(SRC, /Heb 3:7/);
  assert.doesNotMatch(SRC, /CCC:\s*silent/);
});

test("KJV chapter has 19-verse substance and no emoticons", () => {
  const chapter = SRC.split("KJV CHAPTER:")[1] || "";
  assert.doesNotMatch(chapter, /;\)|\(:|:\(|:\)/);
  assert.match(chapter, /consider the Apostle and High Priest of our profession, Christ Jesus/);
  assert.match(chapter, /So we see that they could not enter in because of unbelief/);
  assert.match(SRC, /apostolos = Apostle \(v\.1\)/);
  assert.match(SRC, /pistos = faithful \(v\.2\)/);
});
