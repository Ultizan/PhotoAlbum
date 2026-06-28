import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlbumGrid } from "./AlbumGrid";
import { downloadSequentially } from "../downloads";
import type { AlbumManifest } from "../types";

vi.mock("../downloads", () => ({
  downloadSequentially: vi.fn()
}));

const album: AlbumManifest = {
  version: 1,
  albumId: "family-trip",
  title: "2026 Family Trip",
  createdAt: "2026-06-01T00:00:00.000Z",
  visibility: "access-controlled",
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
};

describe("AlbumGrid", () => {
  it("does not start a second selected-download queue while one is pending", async () => {
    let resolveDownload: () => void = () => undefined;
    vi.mocked(downloadSequentially).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDownload = resolve;
        })
    );

    render(<AlbumGrid album={album} />);

    await userEvent.click(screen.getByLabelText("Select img_001.jpg"));
    const button = screen.getByRole("button", { name: "Download selected" });

    await userEvent.click(button);
    await userEvent.click(button);

    expect(downloadSequentially).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    resolveDownload();
  });
});
