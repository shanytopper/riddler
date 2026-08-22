import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type EditorTrack } from "../api.ts";

export function TracksList() {
  const [tracks, setTracks] = useState<EditorTrack[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .tracks()
      .then(setTracks)
      .catch(() => setError("Could not load tracks."));
  }, []);

  return (
    <div className="wrap">
      <h1>Tracks</h1>
      <p className="muted">Edit a track's content and publish a new version.</p>
      {error ? <div className="banner err">{error}</div> : null}
      {!tracks ? (
        <p className="muted">Loading…</p>
      ) : tracks.length === 0 ? (
        <p className="muted">No tracks yet.</p>
      ) : (
        <div style={{ marginTop: 12 }}>
          {tracks.map((track) => (
            <Link
              key={track.trackId}
              to={`/tracks/${track.trackId}`}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <strong style={{ flex: 1 }}>{track.name.en ?? track.name.he ?? track.slug}</strong>
              <span className="pill">
                {track.publishedVersion ? `published v${track.publishedVersion}` : "unpublished"}
              </span>
              {track.hasDraft ? <span className="pill warn">draft</span> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
