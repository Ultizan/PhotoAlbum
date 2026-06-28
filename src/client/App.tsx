export function App() {
  const path = window.location.pathname;
  const isShareRoute = path.startsWith("/share/");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{isShareRoute ? "Shared album" : "Private gallery"}</p>
          <h1>Photo Album</h1>
        </div>
      </header>
      <section className="panel">
        <p>{isShareRoute ? "Loading shared album..." : "Loading albums..."}</p>
      </section>
    </main>
  );
}
