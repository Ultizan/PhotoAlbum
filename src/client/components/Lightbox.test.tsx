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
});
