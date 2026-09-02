import type { Station, TrackContent } from "@riddles/bundle-schema";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Issue, type ValidationReport } from "../api.ts";
import { LocalizedField } from "../components/LocalizedField.tsx";
import { Leaderboard } from "../components/Leaderboard.tsx";
import { StationEditor } from "../components/StationEditor.tsx";
import type { ContextPin } from "../components/StationMap.tsx";
import type { EditStation, Loc } from "../model.ts";
import { blankStation, stationsOf } from "../model.ts";

/** The centre of a leg's map, where a newly added station starts (inside the bounds, so it is valid). */
function legCenter(content: TrackContent): { lat: number; lng: number } {
  const map = content.legs[0]?.map;
  const [west, south, east, north] =
    map && map.kind === "tiles" ? map.bounds : [34.8, 32.09, 34.82, 32.11];
  return { lat: (south + north) / 2, lng: (west + east) / 2 };
}

type Tab = "details" | "stations" | "leaderboard";
type Status = { kind: "ok" | "err" | "warn"; text: string } | null;

/** The other stations, as faint context pins for one station's map. */
function contextPins(content: TrackContent, exceptIndex: number): ContextPin[] {
  return (content.legs[0]?.stations ?? []).flatMap((station, i) => {
    const loc = (station as unknown as EditStation).location;
    return i === exceptIndex || !loc
      ? []
      : [{ id: station.id, number: i + 1, lat: loc.lat, lng: loc.lng }];
  });
}

export function TrackEditor() {
  const { id = "" } = useParams();
  const [content, setContent] = useState<TrackContent | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);

  useEffect(() => {
    void api
      .track(id)
      .then(setContent)
      .catch(() => setStatus({ kind: "err", text: "Could not load this track." }));
  }, [id]);

  const patch = useCallback((fn: (draft: TrackContent) => void) => {
    setContent((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
    setReport(null);
    setStatus(null);
  }, []);

  const save = useCallback(async () => {
    if (!content) return;
    await api.saveDraft(id, content);
    setDirty(false);
  }, [content, id]);

  const onSave = async () => {
    setBusy(true);
    try {
      await save();
      setStatus({ kind: "ok", text: "Draft saved." });
    } catch (e) {
      setStatus({ kind: "err", text: message(e) });
    } finally {
      setBusy(false);
    }
  };

  const onValidate = async () => {
    setBusy(true);
    try {
      if (dirty) await save();
      const r = await api.validate(id);
      setReport(r);
      setStatus(
        r.ok
          ? { kind: "ok", text: "Looks publishable." }
          : { kind: "err", text: "There are problems to fix." },
      );
    } catch (e) {
      setStatus({ kind: "err", text: message(e) });
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    setBusy(true);
    try {
      if (dirty) await save();
      const { version, warnings } = await api.publish(id);
      setReport({ ok: true, errors: [], warnings });
      setStatus({ kind: "ok", text: `Published version ${version}.` });
    } catch (e) {
      setStatus({ kind: "err", text: message(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!content) {
    return (
      <div className="wrap">
        {status ? (
          <div className={`banner ${status.kind}`}>{status.text}</div>
        ) : (
          <p className="muted">Loading…</p>
        )}
        <Link to="/">← Tracks</Link>
      </div>
    );
  }

  const languages = content.languages;
  const stations = stationsOf(content);

  return (
    <div className="wrap wide">
      <Link to="/" className="small">
        ← Tracks
      </Link>
      <h1>{(content.name as Loc).en ?? (content.name as Loc).he ?? content.slug}</h1>

      <div className="tabs">
        {(["details", "stations", "leaderboard"] as Tab[]).map((t) => (
          <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {status ? <div className={`banner ${status.kind}`}>{status.text}</div> : null}
      {report && (report.errors.length > 0 || report.warnings.length > 0) ? (
        <ReportView report={report} />
      ) : null}

      {tab === "details" ? <Details content={content} languages={languages} patch={patch} /> : null}

      {tab === "stations" ? (
        <div>
          {stations.map((station, index) => (
            <StationEditor
              key={station.id}
              station={station as unknown as EditStation}
              index={index}
              count={stations.length}
              languages={languages}
              context={contextPins(content, index)}
              center={legCenter(content)}
              update={(fn) =>
                patch((next) => {
                  const s = next.legs[0]?.stations[index];
                  if (s) fn(s as unknown as EditStation);
                })
              }
              onMove={(dir) =>
                patch((next) => {
                  const arr = next.legs[0]?.stations;
                  if (!arr) return;
                  const j = index + dir;
                  const a = arr[index];
                  const b = arr[j];
                  if (a && b) {
                    arr[index] = b;
                    arr[j] = a;
                  }
                })
              }
              onRemove={() =>
                patch((next) => {
                  const arr = next.legs[0]?.stations;
                  // A leg must keep at least one station (schema minItems: 1).
                  if (arr && arr.length > 1) (arr as Station[]).splice(index, 1);
                })
              }
            />
          ))}
          <div className="actions" style={{ marginTop: 12 }}>
            <button
              className="primary"
              onClick={() =>
                patch((next) => {
                  const leg = next.legs[0];
                  if (!leg) return;
                  // Start the new station a short walk (~35 m) from the previous one, so a track
                  // grows from where the operator is working, not from a fixed default.
                  const last = (
                    leg.stations[leg.stations.length - 1] as unknown as EditStation | undefined
                  )?.location;
                  const start = last
                    ? { lat: last.lat + 0.0003, lng: last.lng + 0.0003 }
                    : legCenter(next);
                  (leg.stations as Station[]).push(blankStation(start));
                })
              }
            >
              Add station
            </button>
            <span className="muted small">
              A new station starts next to the previous one — open it and drag its pin, or use your
              location.
            </span>
          </div>
        </div>
      ) : null}

      {tab === "leaderboard" ? (
        <div className="card">
          <Leaderboard trackId={id} />
        </div>
      ) : null}

      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 24,
          padding: "12px 0",
          background: "var(--bg)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="actions">
          <button onClick={onSave} disabled={busy || !dirty}>
            {dirty ? "Save draft" : "Saved"}
          </button>
          <button onClick={onValidate} disabled={busy}>
            Validate
          </button>
          <div style={{ flex: 1 }} />
          <button className="primary" onClick={onPublish} disabled={busy}>
            Publish new version
          </button>
        </div>
      </div>
    </div>
  );
}

function Details({
  content,
  languages,
  patch,
}: {
  content: TrackContent;
  languages: readonly string[];
  patch: (fn: (draft: TrackContent) => void) => void;
}) {
  const rules = content.rules;
  return (
    <div className="card">
      <LocalizedField
        label="Track name"
        value={content.name as Loc}
        languages={languages}
        onChange={(lang, text) => patch((c) => void ((c.name as Loc)[lang] = text))}
      />
      <LocalizedField
        label="Description"
        value={content.description as Loc}
        languages={languages}
        multiline
        onChange={(lang, text) => patch((c) => void ((c.description as Loc)[lang] = text))}
      />
      <LocalizedField
        label="Safety notes"
        value={content.safetyNotes as Loc}
        languages={languages}
        multiline
        onChange={(lang, text) => patch((c) => void ((c.safetyNotes as Loc)[lang] = text))}
      />

      <h2>Rules</h2>
      <div className="row">
        <div className="field">
          <label>Order</label>
          <select
            value={rules.order}
            onChange={(e) =>
              patch((c) => void (c.rules.order = e.target.value as typeof c.rules.order))
            }
          >
            <option value="linear">Linear (fixed sequence)</option>
            <option value="free">Free (any order)</option>
          </select>
        </div>
        <div className="field">
          <label>Visibility</label>
          <select
            value={rules.visibility}
            onChange={(e) =>
              patch((c) => void (c.rules.visibility = e.target.value as typeof c.rules.visibility))
            }
          >
            <option value="progressive">Progressive (reveal as you go)</option>
            <option value="all">All shown from the start</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Give up available</label>
          <select
            value={rules.revealAndContinue}
            onChange={(e) =>
              patch(
                (c) =>
                  void (c.rules.revealAndContinue = e.target
                    .value as typeof c.rules.revealAndContinue),
              )
            }
          >
            <option value="afterFirstHint">After the first hint</option>
            <option value="immediately">Immediately</option>
          </select>
        </div>
        <div className="field">
          <label>Wrong-choice penalty (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={rules.wrongChoicePenaltyPercent}
            onChange={(e) =>
              patch((c) => void (c.rules.wrongChoicePenaltyPercent = Number(e.target.value)))
            }
          />
        </div>
      </div>
      <label className="actions">
        <input
          type="checkbox"
          checked={rules.leaderboard}
          style={{ width: "auto" }}
          onChange={(e) => patch((c) => void (c.rules.leaderboard = e.target.checked))}
        />
        Leaderboard enabled
      </label>
    </div>
  );
}

function ReportView({ report }: { report: ValidationReport }) {
  const line = (issue: Issue, i: number) => (
    <li key={i}>
      <code className="small">{issue.path}</code> — {issue.message}
    </li>
  );
  return (
    <div className={`banner ${report.errors.length ? "err" : "warn"}`}>
      {report.errors.length > 0 ? (
        <>
          <strong>Fix before publishing:</strong>
          <ul style={{ margin: "6px 0 0" }}>{report.errors.map(line)}</ul>
        </>
      ) : null}
      {report.warnings.length > 0 ? (
        <>
          <strong>Warnings:</strong>
          <ul style={{ margin: "6px 0 0" }}>{report.warnings.map(line)}</ul>
        </>
      ) : null}
    </div>
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
