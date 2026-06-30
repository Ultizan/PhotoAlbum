import type { AlbumIndex, AlbumManifest, AlbumSummary, PhotoManifestItem } from "./types";

const ALBUM_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const PHOTO_ID_PATTERN = /^img_[0-9]{3,}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`);
  }
  return value;
}

function requireVersion(record: Record<string, unknown>): 1 {
  if (record.version !== 1) {
    throw new Error("version must be 1");
  }
  return 1;
}

export function validateAlbumId(albumId: string): void {
  if (!ALBUM_ID_PATTERN.test(albumId)) {
    throw new Error("albumId must use lowercase letters, numbers, and hyphens");
  }
}

function validatePhotoId(id: string): void {
  if (!PHOTO_ID_PATTERN.test(id)) {
    throw new Error("photo id must use img_### format");
  }
}

function validateFilename(filename: string): void {
  if (
    filename === "." ||
    filename === ".." ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0")
  ) {
    throw new Error("filename must be a basename");
  }
}

function validateObjectKey(key: string, fieldName: string): void {
  if (key.startsWith("/") || key.includes("\\") || key.includes("\0")) {
    throw new Error(`${fieldName} must be a safe relative object key`);
  }
  const parts = key.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new Error(`${fieldName} must be a safe relative object key`);
  }
}

function parseAlbumSummary(value: unknown): AlbumSummary {
  if (!isRecord(value)) {
    throw new Error("album summary must be an object");
  }

  return {
    albumId: requireString(value, "albumId"),
    title: requireString(value, "title"),
    createdAt: requireString(value, "createdAt"),
    coverPhotoId: requireString(value, "coverPhotoId"),
    photoCount: requireNumber(value, "photoCount")
  };
}

export function parseAlbumIndex(value: unknown): AlbumIndex {
  if (!isRecord(value)) {
    throw new Error("album index must be an object");
  }
  requireVersion(value);
  if (!Array.isArray(value.albums)) {
    throw new Error("albums must be an array");
  }

  return {
    version: 1,
    generatedAt: requireString(value, "generatedAt"),
    albums: value.albums.map(parseAlbumSummary)
  };
}

function parsePhoto(value: unknown, albumId: string): PhotoManifestItem {
  if (!isRecord(value)) {
    throw new Error("photo must be an object");
  }

  const id = requireString(value, "id");
  validatePhotoId(id);
  const filename = requireString(value, "filename");
  validateFilename(filename);

  const thumbPrefix = `albums/${albumId}/thumbs/`;
  const expectedThumbPath = `${thumbPrefix}${id}.webp`;
  const displayPrefix = `albums/${albumId}/display/`;
  const expectedDisplayPath = `${displayPrefix}${id}.webp`;
  const thumbPath = requireString(value, "thumbPath");
  const fullPath = requireString(value, "fullPath");
  if (!thumbPath.startsWith(thumbPrefix)) {
    throw new Error(`thumbPath must stay within ${thumbPrefix}`);
  }
  if (thumbPath !== expectedThumbPath) {
    throw new Error(`thumbPath must be the canonical thumbnail path for ${id}`);
  }
  const displayPath = value.displayPath;
  if (displayPath !== undefined) {
    if (typeof displayPath !== "string" || displayPath.length === 0) {
      throw new Error("displayPath must be a non-empty string when provided");
    }
    if (!displayPath.startsWith(displayPrefix)) {
      throw new Error(`displayPath must stay within ${displayPrefix}`);
    }
    if (displayPath !== expectedDisplayPath) {
      throw new Error(`displayPath must be the canonical display path for ${id}`);
    }
  }
  validateObjectKey(fullPath, "fullPath");

  const capturedAt = value.capturedAt;
  return {
    id,
    filename,
    thumbPath,
    ...(displayPath !== undefined ? { displayPath } : {}),
    fullPath,
    width: requireNumber(value, "width"),
    height: requireNumber(value, "height"),
    ...(typeof capturedAt === "string" && capturedAt.length > 0 ? { capturedAt } : {})
  };
}

export function parseAlbumManifest(value: unknown): AlbumManifest {
  if (!isRecord(value)) {
    throw new Error("album manifest must be an object");
  }
  requireVersion(value);
  const albumId = requireString(value, "albumId");
  validateAlbumId(albumId);
  if (value.visibility !== "access-controlled") {
    throw new Error("visibility must be access-controlled");
  }
  if (!Array.isArray(value.photos)) {
    throw new Error("photos must be an array");
  }

  return {
    version: 1,
    albumId,
    title: requireString(value, "title"),
    createdAt: requireString(value, "createdAt"),
    visibility: "access-controlled",
    photos: value.photos.map((photo) => parsePhoto(photo, albumId))
  };
}
