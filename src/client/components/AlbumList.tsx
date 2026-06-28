import type { AlbumIndex } from "../types";

export function AlbumList({ index }: { index: AlbumIndex }) {
  return (
    <div className="album-list">
      {index.albums.map((album) => (
        <a className="album-card" href={`/albums/${album.albumId}`} key={album.albumId}>
          <div>
            <h2>{album.title}</h2>
            <p>{album.createdAt}</p>
          </div>
          <span>{album.photoCount} photos</span>
        </a>
      ))}
    </div>
  );
}
