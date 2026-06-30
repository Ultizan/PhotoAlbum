export type DownloadItem = {
  url: string;
  filename: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isErrorLikeContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("text/html") ||
    normalized.includes("application/json") ||
    normalized.includes("application/xml") ||
    normalized.includes("text/xml")
  );
}

async function fetchDownload(item: DownloadItem): Promise<Blob> {
  const response = await fetch(item.url, { credentials: "same-origin" });
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || isErrorLikeContentType(contentType)) {
    const suffix = response.ok ? `received ${contentType || "an unexpected response"}` : `HTTP ${response.status}`;
    throw new Error(`Download failed for ${item.filename}: ${suffix}`);
  }

  return response.blob();
}

function saveBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

export async function downloadSequentially(items: DownloadItem[], delayMs = 250): Promise<void> {
  for (const [index, item] of items.entries()) {
    const blob = await fetchDownload(item);
    saveBlob(blob, item.filename);
    if (delayMs > 0 && index < items.length - 1) {
      await delay(delayMs);
    }
  }
}
