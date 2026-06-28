import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadSequentially } from "./downloads";

describe("downloadSequentially", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("clicks one download anchor per URL in order", async () => {
    const clicks: string[] = [];
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = createElement(tagName);
      if (tagName === "a") {
        element.click = () => clicks.push((element as HTMLAnchorElement).href);
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

    expect(clicks).toEqual([
      "http://localhost:3000/img/album/full/img_001",
      "http://localhost:3000/img/album/full/img_002"
    ]);
  });

  it("delays only between downloads", async () => {
    vi.useFakeTimers();
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
