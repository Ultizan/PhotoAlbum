export type AlbumSummary = {
  albumId: string;
  title: string;
  createdAt: string;
  coverPhotoId: string;
  photoCount: number;
};

export type AlbumIndex = {
  version: 1;
  generatedAt: string;
  albums: AlbumSummary[];
};

export type PhotoManifestItem = {
  id: string;
  filename: string;
  thumbPath: string;
  fullPath: string;
  width: number;
  height: number;
  capturedAt?: string;
};

export type AlbumManifest = {
  version: 1;
  albumId: string;
  title: string;
  createdAt: string;
  visibility: "access-controlled";
  photos: PhotoManifestItem[];
};

export type ShareTokenPayload = {
  v: 1;
  albumId: string;
  expiresAt: string;
};
