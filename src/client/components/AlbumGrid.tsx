import { Check, Download, X } from "lucide-react";
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

function SelectionPanel({
  selectedPhotos,
  isDownloading,
  downloadError,
  onDownloadSelected,
  onDownloadPhoto,
  onClearSelection
}: {
  selectedPhotos: PhotoManifestItem[];
  isDownloading: boolean;
  downloadError: string | null;
  onDownloadSelected: () => void;
  onDownloadPhoto: (photo: PhotoManifestItem) => void;
  onClearSelection: () => void;
}) {
  if (selectedPhotos.length === 0) {
    return null;
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-20 rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/15 lg:sticky lg:top-6 lg:inset-auto lg:self-start lg:shadow-sm"
      role="complementary"
      aria-label="Download selection"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-bold uppercase text-slate-500">Download selection</p>
          <p className="m-0 text-lg font-bold text-slate-950">
            {selectedPhotos.length} selected
          </p>
        </div>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={onClearSelection}
          aria-label="Clear selection"
        >
          <X size={18} />
        </button>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto] lg:grid-cols-1">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          disabled={isDownloading}
          onClick={onDownloadSelected}
        >
          <Download size={18} />
          Download selected
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={onClearSelection}
        >
          Clear
        </button>
      </div>
      {downloadError && (
        <p className="mb-3 mt-0 text-sm font-bold text-red-700" role="alert">
          {downloadError}
        </p>
      )}
      <ul className="m-0 grid max-h-48 list-none gap-2 overflow-auto p-0 lg:max-h-[calc(100vh-18rem)]">
        {selectedPhotos.map((photo) => (
          <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-slate-50 px-3 py-2" key={photo.id}>
            <span className="truncate text-sm font-semibold text-slate-700">{photo.filename}</span>
            <button
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              disabled={isDownloading}
              onClick={() => onDownloadPhoto(photo)}
            >
              <Download size={15} />
              Download {photo.filename}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function AlbumGrid({ album, shareToken }: { album: AlbumManifest; shareToken?: string }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePhoto, setActivePhoto] = useState<PhotoManifestItem | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const selectedPhotos = useMemo(
    () => album.photos.filter((photo) => selectedIds.has(photo.id)),
    [album.photos, selectedIds]
  );
  const activeIndex = activePhoto ? album.photos.findIndex((photo) => photo.id === activePhoto.id) : -1;

  function toggle(photoId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setDownloadError(null);
  }

  async function downloadPhotos(photos: PhotoManifestItem[], delayMs = 250) {
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadSequentially(
        photos.map((photo) => ({
          url: imageUrl(album.albumId, photo.id, "full", shareToken),
          filename: photo.filename
        })),
        delayMs
      );
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  }

  function downloadSelected() {
    void downloadPhotos(selectedPhotos);
  }

  function downloadOne(photo: PhotoManifestItem) {
    void downloadPhotos([photo], 0);
  }

  function showPreviousPhoto() {
    if (activeIndex > 0) {
      setActivePhoto(album.photos[activeIndex - 1]);
    }
  }

  function showNextPhoto() {
    if (activeIndex >= 0 && activeIndex < album.photos.length - 1) {
      setActivePhoto(album.photos[activeIndex + 1]);
    }
  }

  return (
    <div className={`grid gap-6 ${selectedPhotos.length > 0 ? "pb-44 lg:grid-cols-[minmax(0,1fr)_20rem] lg:pb-0" : ""}`}>
      <div>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="m-0 text-2xl font-bold tracking-normal text-slate-950">{album.title}</h2>
            <p className="m-0 mt-1 text-slate-500">{album.photos.length} photos</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
          {album.photos.map((photo) => {
            const selected = selectedIds.has(photo.id);
            return (
              <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-200" key={photo.id}>
                <button className="block h-full w-full cursor-zoom-in border-0 bg-transparent p-0" type="button" onClick={() => setActivePhoto(photo)}>
                  <img
                    className="block h-full w-full object-cover"
                    src={imageUrl(album.albumId, photo.id, "thumb", shareToken)}
                    alt={photo.filename}
                    loading="lazy"
                  />
                </button>
                <button
                  className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border text-white ${
                    selected
                      ? "border-emerald-700 bg-emerald-700"
                      : "border-slate-900/15 bg-white/90 text-transparent hover:text-slate-500"
                  }`}
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
      </div>
      <SelectionPanel
        selectedPhotos={selectedPhotos}
        isDownloading={isDownloading}
        downloadError={downloadError}
        onDownloadSelected={downloadSelected}
        onDownloadPhoto={downloadOne}
        onClearSelection={clearSelection}
      />
      {activePhoto && (
        <Lightbox
          albumId={album.albumId}
          photo={activePhoto}
          shareToken={shareToken}
          isSelected={selectedIds.has(activePhoto.id)}
          hasPrevious={activeIndex > 0}
          hasNext={activeIndex >= 0 && activeIndex < album.photos.length - 1}
          onToggleSelected={() => toggle(activePhoto.id)}
          onPrevious={showPreviousPhoto}
          onNext={showNextPhoto}
          onClose={() => setActivePhoto(null)}
        />
      )}
    </div>
  );
}
