import type { AlbumIndex, AlbumManifest } from "./types";

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getAlbumIndex(): Promise<AlbumIndex> {
  return readJson<AlbumIndex>("/api/albums");
}

export function getAlbumManifest(albumId: string): Promise<AlbumManifest> {
  return readJson<AlbumManifest>(`/api/albums/${encodeURIComponent(albumId)}`);
}

export function getSharedAlbum(token: string): Promise<AlbumManifest> {
  return readJson<AlbumManifest>(`/share-api/${encodeURIComponent(token)}/album`);
}
