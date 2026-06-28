export type DownloadItem = {
  url: string;
  filename: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function downloadSequentially(items: DownloadItem[], delayMs = 250): Promise<void> {
  for (const [index, item] of items.entries()) {
    const anchor = document.createElement("a");
    anchor.href = item.url;
    anchor.download = item.filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (delayMs > 0 && index < items.length - 1) {
      await delay(delayMs);
    }
  }
}
