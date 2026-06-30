import { Check, ChevronLeft, ChevronRight, Download, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadSequentially } from "../downloads";
import type { PhotoManifestItem } from "../types";

export function Lightbox({
  albumId,
  photo,
  shareToken,
  isSelected = false,
  hasPrevious = false,
  hasNext = false,
  onToggleSelected,
  onPrevious,
  onNext,
  onClose
}: {
  albumId: string;
  photo: PhotoManifestItem;
  shareToken?: string;
  isSelected?: boolean;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onToggleSelected?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const imageUrl = shareToken
    ? `/share-img/${encodeURIComponent(shareToken)}/full/${encodeURIComponent(photo.id)}`
    : `/img/${encodeURIComponent(albumId)}/full/${encodeURIComponent(photo.id)}`;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    return () => {
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && hasPrevious) {
        onPrevious?.();
      } else if (event.key === "ArrowRight" && hasNext) {
        onNext?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious]);

  async function downloadOriginal() {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadSequentially([{ url: imageUrl, filename: photo.filename }], 0);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid grid-rows-[auto_1fr_auto] gap-3 bg-slate-950/95 p-4" role="dialog" aria-modal="true" aria-label={photo.filename}>
      <div className="flex items-center justify-between gap-3">
        <button
          ref={closeButtonRef}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <p className="m-0 min-w-0 truncate text-sm font-bold text-white">{photo.filename}</p>
        <button
          className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-white px-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          onClick={onToggleSelected}
          disabled={!onToggleSelected}
        >
          {isSelected ? <Check size={18} /> : <Plus size={18} />}
          {isSelected ? "Remove from selection" : "Add to selection"}
        </button>
      </div>
      <div className="relative grid min-h-0 place-items-center">
        <button
          className="absolute left-0 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-950 disabled:cursor-not-allowed disabled:opacity-30"
          type="button"
          disabled={!hasPrevious}
          onClick={onPrevious}
          aria-label="Previous photo"
        >
          <ChevronLeft size={24} />
        </button>
        <img className="max-h-full max-w-full object-contain" src={imageUrl} alt={photo.filename} />
        <button
          className="absolute right-0 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-950 disabled:cursor-not-allowed disabled:opacity-30"
          type="button"
          disabled={!hasNext}
          onClick={onNext}
          aria-label="Next photo"
        >
          <ChevronRight size={24} />
        </button>
      </div>
      <div className="grid justify-items-center gap-2">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={isDownloading}
          onClick={downloadOriginal}
        >
          <Download size={18} />
          Download original
        </button>
        {downloadError && (
          <p className="m-0 max-w-[min(90vw,36rem)] text-center font-bold text-red-200" role="alert">
            {downloadError}
          </p>
        )}
      </div>
    </div>
  );
}
