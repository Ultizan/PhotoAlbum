import { Check, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { downloadSequentially } from "../downloads";
import type { AlbumManifest, PhotoManifestItem } from "../types";
import { Lightbox } from "./Lightbox";

function imageUrl(albumId: string, photoId: string, kind: "thumb" | "full", shareToken?: string): string {
  if (shareToken) {
    return `/share-img/${encodeURIComponent(shareToken)}/${kind}/${encodeURIComponent(photoId)}`;
  }
  return `/img/${encodeURIComponent(albumId)}/${kind}/${encodeURIComponent(photoId)}`;
}

export function AlbumGrid({ album, shareToken }: { album: AlbumManifest; shareToken?: string }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePhoto, setActivePhoto] = useState<PhotoManifestItem | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const selectedPhotos = useMemo(
    () => album.photos.filter((photo) => selectedIds.has(photo.id)),
    [album.photos, selectedIds]
  );

  function toggle(photoId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  async function downloadSelected() {
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      await downloadSequentially(
        selectedPhotos.map((photo) => ({
          url: imageUrl(album.albumId, photo.id, "full", shareToken),
          filename: photo.filename
        }))
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <div className="album-header">
        <div>
          <h2>{album.title}</h2>
          <p>{album.photos.length} photos</p>
        </div>
        <button className="primary-button" type="button" disabled={selectedPhotos.length === 0 || isDownloading} onClick={downloadSelected}>
          <Download size={18} />
          Download selected
        </button>
      </div>
      {selectedPhotos.length > 0 && (
        <div className="selected-downloads" aria-label="Selected photo download links">
          {selectedPhotos.map((photo) => (
            <a key={photo.id} href={imageUrl(album.albumId, photo.id, "full", shareToken)} download={photo.filename}>
              Download {photo.filename}
            </a>
          ))}
        </div>
      )}
      <div className="photo-grid">
        {album.photos.map((photo) => {
          const selected = selectedIds.has(photo.id);
          return (
            <div className="photo-tile" key={photo.id}>
              <button className="photo-button" type="button" onClick={() => setActivePhoto(photo)}>
                <img src={imageUrl(album.albumId, photo.id, "thumb", shareToken)} alt={photo.filename} loading="lazy" />
              </button>
              <button
                className={`select-button${selected ? " selected" : ""}`}
                type="button"
                onClick={() => toggle(photo.id)}
                aria-label={selected ? `Deselect ${photo.filename}` : `Select ${photo.filename}`}
              >
                <Check size={16} />
              </button>
            </div>
          );
        })}
      </div>
      {activePhoto && (
        <Lightbox albumId={album.albumId} photo={activePhoto} shareToken={shareToken} onClose={() => setActivePhoto(null)} />
      )}
    </>
  );
}
