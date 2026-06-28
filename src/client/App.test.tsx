import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const albumIndex = {
  version: 1,
  generatedAt: "2026-06-28T00:00:00.000Z",
  albums: [
    {
      albumId: "family-trip",
      title: "2026 Family Trip",
      createdAt: "2026-06-01T00:00:00.000Z",
      coverPhotoId: "photo-1",
      photoCount: 12
    }
  ]
};

const albumManifest = {
  version: 1,
  albumId: "family-trip",
  title: "2026 Family Trip",
  createdAt: "2026-06-01T00:00:00.000Z",
  visibility: "access-controlled",
  photos: []
};

describe("App", () => {
  const originalPath = window.location.pathname;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.history.pushState({}, "", originalPath);
  });

  it("fetches and renders the private album index", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(albumIndex)
    });
    globalThis.fetch = fetchMock;
    window.history.pushState({}, "", "/");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("2026 Family Trip")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/albums");
  });

  it("fetches and renders a shared album", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(albumManifest)
    });
    globalThis.fetch = fetchMock;
    window.history.pushState({}, "", "/share/sample-token");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("2026 Family Trip")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/share-api/sample-token/album");
  });

  it("fetches and renders a private album route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(albumManifest)
    });
    globalThis.fetch = fetchMock;
    window.history.pushState({}, "", "/albums/family-trip");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("2026 Family Trip")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/albums/family-trip");
  });

  it("shows an error instead of crashing for malformed route encoding", async () => {
    globalThis.fetch = vi.fn();
    window.history.pushState({}, "", "/share/%");

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("This album could not be loaded.");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });


  it("shows direct download links for selected photos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...albumManifest,
          photos: [
            {
              id: "img_001",
              filename: "img_001.jpg",
              thumbPath: "albums/family-trip/thumbs/img_001.webp",
              fullPath: "albums/family-trip/full/img_001.jpg",
              width: 1600,
              height: 1200
            }
          ]
        })
    });
    globalThis.fetch = fetchMock;
    window.history.pushState({}, "", "/albums/family-trip");

    render(<App />);

    await userEvent.click(await screen.findByLabelText("Select img_001.jpg"));

    const directLink = screen.getByRole("link", { name: "Download img_001.jpg" });
    expect(directLink).toHaveAttribute("href", "/img/family-trip/full/img_001");
    expect(directLink).toHaveAttribute("download", "img_001.jpg");
  });

  it("uses share image routes for selected downloads and lightbox originals", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...albumManifest,
          photos: [
            {
              id: "img_001",
              filename: "img_001.jpg",
              thumbPath: "albums/family-trip/thumbs/img_001.webp",
              fullPath: "albums/family-trip/full/img_001.jpg",
              width: 1600,
              height: 1200
            }
          ]
        })
    });
    globalThis.fetch = fetchMock;
    window.history.pushState({}, "", "/share/sample-token");

    render(<App />);

    await userEvent.click(await screen.findByLabelText("Select img_001.jpg"));
    const directLink = screen.getByRole("link", { name: "Download img_001.jpg" });
    expect(directLink).toHaveAttribute("href", "/share-img/sample-token/full/img_001");

    await userEvent.click(screen.getByRole("img", { name: "img_001.jpg" }));
    const dialog = screen.getByRole("dialog", { name: "img_001.jpg" });
    const originalLink = within(dialog).getByRole("link", { name: "Download original" });
    expect(originalLink).toHaveAttribute("href", "/share-img/sample-token/full/img_001");
    expect(originalLink).toHaveAttribute("download", "img_001.jpg");
  });

  it("makes the lightbox modal, closes on Escape, and restores focus", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...albumManifest,
          photos: [
            {
              id: "img_001",
              filename: "img_001.jpg",
              thumbPath: "albums/family-trip/thumbs/img_001.webp",
              fullPath: "albums/family-trip/full/img_001.jpg",
              width: 1600,
              height: 1200
            }
          ]
        })
    });
    globalThis.fetch = fetchMock;
    window.history.pushState({}, "", "/albums/family-trip");

    render(<App />);

    const thumbnail = await screen.findByRole("img", { name: "img_001.jpg" });
    const opener = thumbnail.closest("button");
    expect(opener).not.toBeNull();
    await userEvent.click(thumbnail);

    const dialog = screen.getByRole("dialog", { name: "img_001.jpg" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "img_001.jpg" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

});
