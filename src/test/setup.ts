import "@testing-library/jest-dom/vitest";

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class TestResizeObserver implements ResizeObserver {
    disconnect() {}

    observe() {}

    unobserve() {}
  };
}
