import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadSequentially } from "../downloads";
import { Lightbox } from "./Lightbox";

vi.mock("../downloads", () => ({
  downloadSequentially: vi.fn()
}));

const photo = {
  id: "img_001",
  filename: "img_001.jpg",
  thumbPath: "albums/family-trip/thumbs/img_001.webp",
  fullPath: "albums/family-trip/full/img_001.jpg",
  width: 1600,
  height: 1200
};

describe("Lightbox", () => {
  beforeEach(() => {
    vi.mocked(downloadSequentially).mockReset();
  });

  it("downloads the original through the checked downloader", async () => {
    vi.mocked(downloadSequentially).mockResolvedValue();

    render(<Lightbox albumId="family-trip" photo={photo} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Download original" }));

    expect(downloadSequentially).toHaveBeenCalledWith(
      [{ url: "/img/family-trip/full/img_001", filename: "img_001.jpg" }],
      0
    );
  });

  it("uses the share image route for shared original downloads", async () => {
    vi.mocked(downloadSequentially).mockResolvedValue();

    render(<Lightbox albumId="family-trip" photo={photo} shareToken="sample-token" onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Download original" }));

    expect(downloadSequentially).toHaveBeenCalledWith(
      [{ url: "/share-img/sample-token/full/img_001", filename: "img_001.jpg" }],
      0
    );
  });

  it("fits the image to the viewport by default", () => {
    render(<Lightbox albumId="family-trip" photo={photo} onClose={vi.fn()} />);

    const zoomButton = screen.getByRole("button", { name: "Zoom to full size" });
    const image = screen.getByRole("img", { name: "img_001.jpg" });

    expect(zoomButton).toContainElement(image);
    expect(image).toHaveClass("max-h-full");
    expect(image).toHaveClass("max-w-full");
    expect(image).toHaveClass("object-contain");
  });

  it("toggles between fit and full-size image views", async () => {
    render(<Lightbox albumId="family-trip" photo={photo} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Zoom to full size" }));

    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveClass("max-w-none");

    await userEvent.click(screen.getByRole("button", { name: "Fit to screen" }));

    expect(screen.getByRole("button", { name: "Zoom to full size" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveClass("max-w-full");
  });
});
