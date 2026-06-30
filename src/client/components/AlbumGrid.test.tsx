import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
      displayPath: "albums/family-trip/display/img_001.webp",
      fullPath: "albums/family-trip/full/img_001.jpg",
      width: 1600,
      height: 1200
    },
    {
      id: "img_002",
      filename: "img_002.jpg",
      thumbPath: "albums/family-trip/thumbs/img_002.webp",
      displayPath: "albums/family-trip/display/img_002.webp",
      fullPath: "albums/family-trip/full/img_002.jpg",
      width: 1600,
      height: 1200
    }
  ]
};

describe("AlbumGrid", () => {
  beforeEach(() => {
    vi.mocked(downloadSequentially).mockReset();
  });

  it("downloads a selected direct link through the checked downloader", async () => {
    vi.mocked(downloadSequentially).mockResolvedValue();

    render(<AlbumGrid album={album} />);

    await userEvent.click(screen.getByLabelText("Select img_001.jpg"));
    await userEvent.click(screen.getByRole("button", { name: "Download img_001.jpg" }));

    expect(downloadSequentially).toHaveBeenCalledWith(
      [{ url: "/img/family-trip/full/img_001", filename: "img_001.jpg" }],
      0
    );
  });

  it("shows the selection in a side panel and clears it", async () => {
    render(<AlbumGrid album={album} />);

    await userEvent.click(screen.getByLabelText("Select img_001.jpg"));

    const selectionPanel = screen.getByRole("complementary", { name: "Download selection" });
    expect(selectionPanel).toHaveTextContent("1 selected");
    expect(selectionPanel).toHaveTextContent("img_001.jpg");

    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(screen.queryByRole("complementary", { name: "Download selection" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select img_001.jpg")).toBeInTheDocument();
  });

  it("adds and removes the active lightbox photo from the selection", async () => {
    render(<AlbumGrid album={album} />);

    await userEvent.click(screen.getByRole("img", { name: "img_001.jpg" }));
    await userEvent.click(screen.getByRole("button", { name: "Add to selection" }));

    expect(screen.getByRole("complementary", { name: "Download selection" })).toHaveTextContent("1 selected");
    expect(screen.getByLabelText("Deselect img_001.jpg")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove from selection" }));

    expect(screen.queryByRole("complementary", { name: "Download selection" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select img_001.jpg")).toBeInTheDocument();
  });

  it("navigates between photos in the lightbox without leaving the album", async () => {
    render(<AlbumGrid album={album} />);

    await userEvent.click(screen.getByRole("img", { name: "img_001.jpg" }));
    await userEvent.click(screen.getByRole("button", { name: "Next photo" }));

    const dialog = screen.getByRole("dialog", { name: "img_002.jpg" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "img_002.jpg" })).toHaveAttribute("src", "/img/family-trip/display/img_002");

    await userEvent.click(screen.getByRole("button", { name: "Previous photo" }));

    expect(screen.getByRole("dialog", { name: "img_001.jpg" })).toBeInTheDocument();
  });

  it("resets the lightbox image to fit when navigating", async () => {
    render(<AlbumGrid album={album} />);

    await userEvent.click(screen.getByRole("img", { name: "img_001.jpg" }));
    await userEvent.click(screen.getByRole("button", { name: "Zoom to full size" }));
    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next photo" }));

    expect(screen.getByRole("dialog", { name: "img_002.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom to full size" })).toBeInTheDocument();
  });

  it("shows a download error when the selected-download queue fails", async () => {
    vi.mocked(downloadSequentially).mockRejectedValue(new Error("Download failed for img_001.jpg: HTTP 403"));

    render(<AlbumGrid album={album} />);

    await userEvent.click(screen.getByLabelText("Select img_001.jpg"));
    await userEvent.click(screen.getByRole("button", { name: "Download selected" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Download failed for img_001.jpg");
  });

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
