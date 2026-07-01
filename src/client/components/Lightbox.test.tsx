import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadSequentially } from "../downloads";
import { Lightbox } from "./Lightbox";

const zoomPanPinchMock = vi.hoisted(() => ({
  centerView: vi.fn(),
  resetTransform: vi.fn(),
  transformComponent: vi.fn(
    ({
      children,
      contentClass,
      contentStyle,
      wrapperClass,
      wrapperStyle
    }: {
      children: React.ReactNode;
      contentClass?: string;
      contentStyle?: React.CSSProperties;
      wrapperClass?: string;
      wrapperStyle?: React.CSSProperties;
    }) => (
      <div data-testid="zoom-component-wrapper" className={wrapperClass} style={wrapperStyle}>
        <div data-testid="zoom-content" className={contentClass} style={contentStyle}>
          {children}
        </div>
      </div>
    )
  ),
  transformWrapper: vi.fn(
    ({
      children
    }: {
      children:
        | React.ReactNode
        | ((controls: {
            centerView: (scale?: number, animationTime?: number) => void;
            resetTransform: (animationTime?: number) => void;
            state: { scale: number };
          }) => React.ReactNode);
      onPinchStart?: () => void;
      onTransform?: (_ref: unknown, state: { scale: number }) => void;
    }) => (
      <div data-testid="zoom-wrapper">
        {typeof children === "function"
          ? children({ centerView: zoomPanPinchMock.centerView, resetTransform: zoomPanPinchMock.resetTransform, state: { scale: 1 } })
          : children}
      </div>
    )
  )
}));

vi.mock("../downloads", () => ({
  downloadSequentially: vi.fn()
}));

vi.mock("react-zoom-pan-pinch", () => ({
  TransformComponent: zoomPanPinchMock.transformComponent,
  TransformWrapper: zoomPanPinchMock.transformWrapper
}));

const photo = {
  id: "img_001",
  filename: "img_001.jpg",
  thumbPath: "albums/family-trip/thumbs/img_001.webp",
  displayPath: "albums/family-trip/display/img_001.webp",
  fullPath: "albums/family-trip/full/img_001.jpg",
  width: 1600,
  height: 1200
};

describe("Lightbox", () => {
  beforeEach(() => {
    vi.mocked(downloadSequentially).mockReset();
    zoomPanPinchMock.centerView.mockReset();
    zoomPanPinchMock.resetTransform.mockReset();
    zoomPanPinchMock.transformComponent.mockClear();
    zoomPanPinchMock.transformWrapper.mockClear();
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
    expect(image).toHaveAttribute("src", "/img/family-trip/display/img_001");
    expect(zoomButton).toHaveClass("min-h-0");
    expect(zoomButton).toHaveClass("min-w-0");
    expect(image).toHaveClass("h-full");
    expect(image).toHaveClass("w-full");
    expect(image).toHaveClass("min-h-0");
    expect(image).toHaveClass("min-w-0");
    expect(image).toHaveClass("object-contain");
  });

  it("does not let large image intrinsic dimensions force the fit surface past the viewport", () => {
    render(<Lightbox albumId="family-trip" photo={{ ...photo, width: 6960, height: 4640 }} onClose={vi.fn()} />);

    const image = screen.getByRole("img", { name: "img_001.jpg" });
    const zoomComponentWrapper = screen.getByTestId("zoom-component-wrapper");

    expect(zoomComponentWrapper).toHaveClass("h-full");
    expect(zoomComponentWrapper).toHaveClass("w-full");
    expect(zoomComponentWrapper).toHaveStyle({ width: "100%", height: "100%" });
    expect(image).toHaveClass("max-h-full");
    expect(image).toHaveClass("max-w-full");
  });

  it("toggles between fit and full-size image views", async () => {
    render(<Lightbox albumId="family-trip" photo={photo} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Zoom to full size" }));

    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveAttribute("src", "/img/family-trip/full/img_001");
    expect(zoomPanPinchMock.centerView).toHaveBeenCalledWith(2, 200);

    await userEvent.click(screen.getByRole("button", { name: "Fit to screen" }));

    expect(screen.getByRole("button", { name: "Zoom to full size" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveClass("w-full");
    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveAttribute("src", "/img/family-trip/display/img_001");
    expect(zoomPanPinchMock.resetTransform).toHaveBeenCalledWith(200);
  });

  it("falls back to the full route for fit mode when a manifest has no display image", () => {
    const { displayPath: _displayPath, ...legacyPhoto } = photo;

    render(<Lightbox albumId="family-trip" photo={legacyPhoto} onClose={vi.fn()} />);

    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveAttribute("src", "/img/family-trip/full/img_001");
  });

  it("uses share display image routes for shared fit images", () => {
    render(<Lightbox albumId="family-trip" photo={photo} shareToken="sample-token" onClose={vi.fn()} />);

    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveAttribute("src", "/share-img/sample-token/display/img_001");
  });

  it("delegates zoom gestures to the zoom component and resets when the photo changes", () => {
    const secondPhoto = { ...photo, id: "img_002", filename: "img_002.jpg" };
    const { rerender } = render(<Lightbox albumId="family-trip" photo={photo} onClose={vi.fn()} />);

    expect(screen.getByTestId("zoom-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-content")).toContainElement(screen.getByRole("img", { name: "img_001.jpg" }));
    expect(zoomPanPinchMock.transformWrapper).toHaveBeenCalled();
    expect(zoomPanPinchMock.transformWrapper.mock.calls[0]?.[0]).toMatchObject({
      centerOnInit: true,
      centerZoomedOut: true,
      initialScale: 1,
      maxScale: 4,
      minScale: 1,
      doubleClick: { disabled: true },
      pinch: { allowPanning: true }
    });

    rerender(<Lightbox albumId="family-trip" photo={secondPhoto} onClose={vi.fn()} />);

    expect(zoomPanPinchMock.resetTransform).toHaveBeenCalledWith(0);
  });

  it("uses the full image route when a zoom gesture starts", () => {
    render(<Lightbox albumId="family-trip" photo={photo} onClose={vi.fn()} />);

    const wrapperProps = zoomPanPinchMock.transformWrapper.mock.calls[0]?.[0];

    act(() => {
      wrapperProps.onPinchStart?.();
    });

    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveAttribute("src", "/img/family-trip/full/img_001");
  });

  it("updates zoom state when the zoom component transforms", () => {
    render(<Lightbox albumId="family-trip" photo={photo} onClose={vi.fn()} />);

    const wrapperProps = zoomPanPinchMock.transformWrapper.mock.calls[0]?.[0];

    act(() => {
      wrapperProps.onTransform?.({}, { scale: 1.8 });
    });

    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "img_001.jpg" })).toHaveAttribute("src", "/img/family-trip/full/img_001");
  });

  it("resets package zoom state when the photo changes", () => {
    const secondPhoto = { ...photo, id: "img_002", filename: "img_002.jpg" };
    const { rerender } = render(<Lightbox albumId="family-trip" photo={photo} onClose={vi.fn()} />);

    const wrapperProps = zoomPanPinchMock.transformWrapper.mock.calls[0]?.[0];

    act(() => {
      wrapperProps.onPinchStart?.();
    });

    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeInTheDocument();

    rerender(<Lightbox albumId="family-trip" photo={secondPhoto} onClose={vi.fn()} />);

    expect(zoomPanPinchMock.resetTransform).toHaveBeenCalledWith(0);
    expect(screen.getByRole("button", { name: "Zoom to full size" })).toBeInTheDocument();
  });
});
