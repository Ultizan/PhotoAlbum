import { render, screen, waitFor } from "@testing-library/react";
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

});
