import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PhotoManifestItem } from "../types";

export function Lightbox({
  albumId,
  photo,
  shareToken,
  onClose
}: {
  albumId: string;
  photo: PhotoManifestItem;
  shareToken?: string;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const imageUrl = shareToken
    ? `/share-img/${encodeURIComponent(shareToken)}/full/${encodeURIComponent(photo.id)}`
    : `/img/${encodeURIComponent(albumId)}/full/${encodeURIComponent(photo.id)}`;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.filename}>
      <button ref={closeButtonRef} className="icon-button lightbox-close" type="button" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>
      <img src={imageUrl} alt={photo.filename} />
      <a className="download-link" href={imageUrl} download={photo.filename}>
        Download original
      </a>
    </div>
  );
}
