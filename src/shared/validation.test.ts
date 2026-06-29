import { describe, expect, it } from "vitest";
import { parseAlbumIndex, parseAlbumManifest } from "./validation";

describe("manifest validation", () => {
  function validAlbumManifest() {
    return {
      version: 1,
      albumId: "2026-family-trip",
      title: "2026 Family Trip",
      createdAt: "2026-06-27",
      visibility: "access-controlled",
      photos: [
        {
          id: "img_001",
          filename: "img_001.jpg",
          thumbPath: "albums/2026-family-trip/thumbs/img_001.webp",
          fullPath: "albums/2026-family-trip/full/img_001.jpg",
          width: 6000,
          height: 4000,
          capturedAt: "2026-06-20T19:34:00"
        }
      ]
    };
  }

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

  it("accepts a valid album manifest and preserves capturedAt", () => {
    const manifest = parseAlbumManifest(validAlbumManifest());

    expect(manifest.photos[0].capturedAt).toBe("2026-06-20T19:34:00");
  });

  it("accepts a manifest that points full-size images at existing synced originals", () => {
    const manifest = validAlbumManifest();
    manifest.photos[0].filename = "3W7A1320.JPG";
    manifest.photos[0].fullPath = "50thCelebration/2026_06_26/3W7A1320.JPG";

    expect(parseAlbumManifest(manifest).photos[0]).toMatchObject({
      filename: "3W7A1320.JPG",
      fullPath: "50thCelebration/2026_06_26/3W7A1320.JPG"
    });
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

  it("rejects an unsafe album id", () => {
    const manifest = validAlbumManifest();
    manifest.albumId = "../private";
    manifest.photos[0].thumbPath = "albums/../private/thumbs/img_001.webp";
    manifest.photos[0].fullPath = "albums/../private/full/img_001.jpg";

    expect(() => parseAlbumManifest(manifest)).toThrow(
      "albumId must use lowercase letters, numbers, and hyphens"
    );
  });

  it("rejects a thumbnail path with traversal after the album prefix", () => {
    const manifest = validAlbumManifest();
    manifest.photos[0].thumbPath = "albums/2026-family-trip/thumbs/../img_001.webp";

    expect(() => parseAlbumManifest(manifest)).toThrow(
      "thumbPath must be the canonical thumbnail path for img_001"
    );
  });

  it("rejects an unsafe full path with traversal", () => {
    const manifest = validAlbumManifest();
    manifest.photos[0].fullPath = "50thCelebration/../private/secret.JPG";

    expect(() => parseAlbumManifest(manifest)).toThrow(
      "fullPath must be a safe relative object key"
    );
  });

  it("rejects a filename with path separators", () => {
    const manifest = validAlbumManifest();
    manifest.photos[0].filename = "../other.jpg";

    expect(() => parseAlbumManifest(manifest)).toThrow("filename must be a basename");
  });

  it("rejects a photo id outside img_### format", () => {
    const manifest = validAlbumManifest();
    manifest.photos[0].id = "photo_001";
    manifest.photos[0].filename = "photo_001.jpg";
    manifest.photos[0].thumbPath = "albums/2026-family-trip/thumbs/photo_001.webp";
    manifest.photos[0].fullPath = "albums/2026-family-trip/full/photo_001.jpg";

    expect(() => parseAlbumManifest(manifest)).toThrow("photo id must use img_### format");
  });
});
