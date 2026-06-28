import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  const originalPath = window.location.pathname;

  afterEach(() => {
    window.history.pushState({}, "", originalPath);
  });

  it("labels the normal route as a private gallery", () => {
    window.history.pushState({}, "", "/");

    render(<App />);

    expect(screen.getByText("Private gallery")).toBeInTheDocument();
    expect(screen.getByText("Loading albums...")).toBeInTheDocument();
  });

  it("labels a share route as a shared album", () => {
    window.history.pushState({}, "", "/share/sample-token");

    render(<App />);

    expect(screen.getByText("Shared album")).toBeInTheDocument();
    expect(screen.getByText("Loading shared album...")).toBeInTheDocument();
  });
});
