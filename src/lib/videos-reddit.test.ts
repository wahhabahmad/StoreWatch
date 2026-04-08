import { describe, expect, it } from "vitest";

import {
  dedupeNormalizedVideos,
  normalizeRedditPostToVideo,
  parseRedditSubreddits,
  type NormalizedRedditVideo,
} from "./videos-reddit";

describe("parseRedditSubreddits", () => {
  it("parses, trims, strips r/ prefix, and deduplicates", () => {
    expect(parseRedditSubreddits("r/gamedev, indiegames  , /r/gamedev")).toEqual([
      "gamedev",
      "indiegames",
    ]);
  });
});

describe("normalizeRedditPostToVideo", () => {
  it("keeps video-capable posts", () => {
    const row = normalizeRedditPostToVideo({
      id: "abc123",
      subreddit: "gamedev",
      title: "Launch trailer",
      permalink: "/r/gamedev/comments/abc123/launch_trailer/",
      is_video: true,
      created_utc: 1712400000,
      media: { reddit_video: { fallback_url: "https://v.redd.it/foo/DASH_720.mp4" } },
      over_18: false,
    });

    expect(row).toMatchObject({
      sourceId: "abc123",
      subreddit: "gamedev",
      embedUrl: "https://v.redd.it/foo/DASH_720.mp4",
      nsfw: false,
    });
  });

  it("drops non-video posts", () => {
    const row = normalizeRedditPostToVideo({
      id: "abc124",
      subreddit: "gamedev",
      title: "Screenshot only",
      permalink: "/r/gamedev/comments/abc124/screenshot_only/",
      is_video: false,
      post_hint: "image",
    });

    expect(row).toBeNull();
  });
});

describe("dedupeNormalizedVideos", () => {
  it("keeps first item per sourceId", () => {
    const a: NormalizedRedditVideo = {
      sourceId: "same",
      subreddit: "a",
      title: "first",
      postUrl: "https://reddit.com/a",
      embedUrl: "https://video.example/1.mp4",
      thumbnailUrl: null,
      author: null,
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      score: 1,
      nsfw: false,
    };
    const b: NormalizedRedditVideo = { ...a, title: "second", subreddit: "b" };

    expect(dedupeNormalizedVideos([a, b])).toEqual([a]);
  });
});
