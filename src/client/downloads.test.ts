import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadSequentially } from "./downloads";

describe("downloadSequentially", () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("fetches image blobs and clicks one object URL download per item", async () => {
    const clicks: string[] = [];
    const downloads: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("image-one", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response("image-two", { headers: { "content-type": "image/jpeg" } }));
    globalThis.fetch = fetchMock;
    URL.createObjectURL = vi.fn().mockReturnValueOnce("blob:one").mockReturnValueOnce("blob:two");
    URL.revokeObjectURL = vi.fn();
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = createElement(tagName);
      if (tagName === "a") {
        element.click = () => clicks.push((element as HTMLAnchorElement).href);
        Object.defineProperty(element, "download", {
          get: () => downloads[downloads.length - 1],
          set: (value: string) => downloads.push(value),
          configurable: true
        });
      }
      return element;
    });

    await downloadSequentially(
      [
        { url: "/img/album/full/img_001", filename: "img_001.jpg" },
        { url: "/img/album/full/img_002", filename: "img_002.jpg" }
      ],
      0
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/img/album/full/img_001", { credentials: "same-origin" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/img/album/full/img_002", { credentials: "same-origin" });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(clicks).toEqual(["blob:one", "blob:two"]);
    expect(downloads).toEqual(["img_001.jpg", "img_002.jpg"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:two");
  });

  it("throws instead of saving a non-image error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("<Error>AccessDenied</Error>", {
        status: 403,
        headers: { "content-type": "application/xml" }
      })
    );
    URL.createObjectURL = vi.fn();
    URL.revokeObjectURL = vi.fn();
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = createElement(tagName);
      if (tagName === "a") {
        element.click = vi.fn();
      }
      return element;
    });

    await expect(
      downloadSequentially([{ url: "/img/album/full/img_001", filename: "img_001.jpg" }], 0)
    ).rejects.toThrow("Download failed for img_001.jpg");

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("delays only between downloads", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("image", { headers: { "content-type": "image/jpeg" } })));
    URL.createObjectURL = vi.fn().mockReturnValue("blob:image");
    URL.revokeObjectURL = vi.fn();
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = createElement(tagName);
      if (tagName === "a") {
        element.click = () => undefined;
      }
      return element;
    });
    const timeoutSpy = vi.spyOn(window, "setTimeout");

    const promise = downloadSequentially(
      [
        { url: "/img/album/full/img_001", filename: "img_001.jpg" },
        { url: "/img/album/full/img_002", filename: "img_002.jpg" }
      ],
      250
    );

    await vi.runAllTimersAsync();
    await promise;

    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 250);
  });

});
