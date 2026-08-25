import test from "node:test";
import assert from "node:assert/strict";
import {
  parseYouTubeUrl,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  youtubePlaylistUrl,
} from "../src/lib/youtube.ts";

/**
 * Every id this module extracts is later interpolated into a URL — an iframe
 * src, an <img> src, and the VideoObject JSON-LD on /learn/[slug]. The
 * `/embed/` and `/shorts/` forms were always matched against the YouTube id
 * character set; `?v=`, `?list=` and `youtu.be/<id>` were not, and
 * `searchParams.get()` hands back the *decoded* value. So whatever a URL
 * happened to contain became a stored `videoId`.
 *
 * Nothing escaped to script execution — React escapes attributes and
 * safeJsonLd escapes the structured data — but these tests exist so the
 * validation cannot quietly go missing again from the forms that lacked it.
 */

test("the ordinary forms all resolve to the same video id", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghijklmno&t=42",
  ]) {
    assert.deepEqual(parseYouTubeUrl(url), { type: "video", id: "dQw4w9WgXcQ" }, url);
  }
});

test("playlists and channels are recognised as themselves", () => {
  assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/playlist?list=PLabcdefghijklmno"), {
    type: "playlist",
    id: "PLabcdefghijklmno",
  });
  assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/channel/UCabcdefghijklmnopqrst"), {
    type: "channel",
    id: "UCabcdefghijklmnopqrst",
  });
  assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/@Fireship"), {
    type: "channel",
    id: "@Fireship",
  });
});

test("an id carrying anything outside the YouTube character set is refused", () => {
  const hostile = [
    'https://www.youtube.com/watch?v=x" onload=alert(1)',
    "https://www.youtube.com/watch?v=<script>",
    "https://www.youtube.com/watch?v=../../../../etc/passwd",
    "https://www.youtube.com/watch?v=a%00b",
    "https://youtu.be/x'y",
    "https://youtu.be/..",
    "https://www.youtube.com/playlist?list=PL</script><script>alert(1)",
    "https://www.youtube.com/watch?v=" + "a".repeat(200),
  ];
  for (const url of hostile) {
    assert.equal(parseYouTubeUrl(url), null, `should have been refused: ${url}`);
  }
});

test("a URL that only looks like YouTube is refused", () => {
  for (const url of [
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com@evil.example/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "not a url at all",
  ]) {
    assert.equal(parseYouTubeUrl(url), null, `should have been refused: ${url}`);
  }
});

test("every URL builder emits a URL on the host it claims, with the id encoded", () => {
  const id = "dQw4w9WgXcQ";
  assert.equal(new URL(youtubeEmbedUrl(id)).hostname, "www.youtube-nocookie.com");
  assert.equal(new URL(youtubeThumbnailUrl(id)).hostname, "i.ytimg.com");
  assert.equal(new URL(youtubeWatchUrl(id)).hostname, "www.youtube.com");
  assert.equal(new URL(youtubePlaylistUrl("PLabc")).hostname, "www.youtube.com");

  // Even handed a value parseYouTubeUrl would never produce, the builders must
  // not let it escape its slot in the URL.
  const nasty = 'a"/><script>x</script>';
  const embed = youtubeEmbedUrl(nasty);
  assert.ok(!embed.includes("<"), embed);
  assert.ok(!embed.includes('"'), embed);
  assert.equal(new URL(embed).hostname, "www.youtube-nocookie.com");
});

test("autoplay is on for the player and off for structured data", () => {
  assert.ok(youtubeEmbedUrl("dQw4w9WgXcQ").includes("autoplay=1"));
  assert.ok(!youtubeEmbedUrl("dQw4w9WgXcQ", { autoplay: false }).includes("autoplay"));
});

test("a playlist with no starting video uses the documented videoseries path", () => {
  const url = youtubeEmbedUrl("", { playlistId: "PLabc" });
  assert.ok(url.includes("/embed/videoseries"), url);
  assert.ok(url.includes("list=PLabc"), url);
});
