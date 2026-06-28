import { describe, expect, it } from "vitest";
import { parseAlbumIndex, parseAlbumManifest } from "./validation";

describe("manifest validation", () => {
  it("accepts a valid album index", () => {
    const index = parseAlbumIndex({
      version: 1,
      generatedAt: "2026-06-28T12:00:00-07:00",
      albums: [
        {
          albumId: "2026-family-trip",
          title: "2026 Family Trip",
          createdAt: "2026-06-27",
          coverPhotoId: "img_001",
          photoCount: 1
        }
      ]
    });

    expect(index.albums[0].albumId).toBe("2026-family-trip");
  });

  it("rejects a photo path outside its album prefix", () => {
    expect(() =>
      parseAlbumManifest({
        version: 1,
        albumId: "2026-family-trip",
        title: "2026 Family Trip",
        createdAt: "2026-06-27",
        visibility: "access-controlled",
        photos: [
          {
            id: "img_001",
            filename: "img_001.jpg",
            thumbPath: "albums/other/thumbs/img_001.webp",
            fullPath: "albums/2026-family-trip/full/img_001.jpg",
            width: 6000,
            height: 4000,
            capturedAt: "2026-06-20T19:34:00"
          }
        ]
      })
    ).toThrow("thumbPath must stay within albums/2026-family-trip/thumbs/");
  });
});
