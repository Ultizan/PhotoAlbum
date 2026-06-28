import { useEffect, useMemo, useState } from "react";
import { getAlbumIndex, getAlbumManifest, getSharedAlbum } from "./api";
import type { AlbumIndex, AlbumManifest } from "./types";

type AppRoute =
  | { kind: "index" }
  | { kind: "album"; albumId: string }
  | { kind: "sharedAlbum"; token: string }
  | { kind: "invalid" };

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "index"; index: AlbumIndex }
  | { status: "album"; album: AlbumManifest };

function safeDecodePathSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function getRoute(pathname: string): AppRoute {
  const shareMatch = pathname.match(/^\/share\/([^/]+)$/);
  if (shareMatch) {
    const token = safeDecodePathSegment(shareMatch[1]);
    return token ? { kind: "sharedAlbum", token } : { kind: "invalid" };
  }

  const albumMatch = pathname.match(/^\/albums\/([^/]+)$/);
  if (albumMatch) {
    const albumId = safeDecodePathSegment(albumMatch[1]);
    return albumId ? { kind: "album", albumId } : { kind: "invalid" };
  }

  return { kind: "index" };
}

function loadingMessage(route: AppRoute): string {
  if (route.kind === "sharedAlbum") {
    return "Loading shared album...";
  }
  if (route.kind === "album") {
    return "Loading album...";
  }
  return "Loading albums...";
}

function renderContent(state: LoadState, route: AppRoute) {
  if (state.status === "loading") {
    return <p>{loadingMessage(route)}</p>;
  }

  if (state.status === "error") {
    return <p role="alert">This album could not be loaded.</p>;
  }

  if (state.status === "album") {
    return <h2>{state.album.title}</h2>;
  }

  return (
    <div>
      {state.index.albums.map((album) => (
        <a className="album-row" href={`/albums/${album.albumId}`} key={album.albumId}>
          <span>{album.title}</span>
          <span>{album.photoCount} photos</span>
        </a>
      ))}
    </div>
  );
}

export function App() {
  const route = useMemo(() => getRoute(window.location.pathname), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const isShareRoute = route.kind === "sharedAlbum";

  useEffect(() => {
    let canceled = false;

    async function loadRoute() {
      setState({ status: "loading" });
      try {
        if (route.kind === "invalid") {
          if (!canceled) {
            setState({ status: "error" });
          }
          return;
        }

        if (route.kind === "index") {
          const index = await getAlbumIndex();
          if (!canceled) {
            setState({ status: "index", index });
          }
          return;
        }

        const album =
          route.kind === "sharedAlbum"
            ? await getSharedAlbum(route.token)
            : await getAlbumManifest(route.albumId);

        if (!canceled) {
          setState({ status: "album", album });
        }
      } catch {
        if (!canceled) {
          setState({ status: "error" });
        }
      }
    }

    void loadRoute();

    return () => {
      canceled = true;
    };
  }, [route]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{isShareRoute ? "Shared album" : "Private gallery"}</p>
          <h1>Photo Album</h1>
        </div>
      </header>
      <section className="panel">{renderContent(state, route)}</section>
    </main>
  );
}
