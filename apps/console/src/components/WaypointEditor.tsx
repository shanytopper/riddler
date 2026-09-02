import type { EditWaypoint } from "../model.ts";
import { blankWaypoint } from "../model.ts";
import { LocalizedField } from "./LocalizedField.tsx";
import { StationMap, type ContextPin } from "./StationMap.tsx";

interface Props {
  kind: "start" | "end";
  /** Absent while the leg has no explicit point — the first/last station plays the part. */
  waypoint: EditWaypoint | undefined;
  /** Where the pin lands when the point is switched on (station 1, or the last station). */
  defaultLocation: { lat: number; lng: number };
  /** The stations and the leg's other end, for orientation on this point's map. */
  context: ContextPin[];
  languages: readonly string[];
  /** The whole point, replaced on every edit; `undefined` switches it off. */
  onChange: (waypoint: EditWaypoint | undefined) => void;
  /**
   * Finish only: mirror the start point, for a circular route. The parent copies the start's
   * location on toggle and keeps the finish in step while checked; the pin is read-only meanwhile.
   */
  sameAsStart?: { available: boolean; checked: boolean; onToggle: (checked: boolean) => void };
}

/**
 * Editor for a leg's start or finish point: a pin the party sees with a one-line note, with no
 * arrival step and no events. Off by default, when the first or last station plays the part.
 */
export function WaypointEditor({
  kind,
  waypoint,
  defaultLocation,
  context,
  languages,
  onChange,
  sameAsStart,
}: Props) {
  const isStart = kind === "start";
  const loc = waypoint?.location ?? defaultLocation;
  // While the finish mirrors the start, its position is edited on the start's card instead.
  const locked = sameAsStart?.checked === true;

  const move = (lat: number, lng: number) => onChange({ ...waypoint, location: { lat, lng } });
  const setNote = (lang: string, text: string) => {
    // Keep only the languages that have text: the schema rejects an empty string, so a language
    // cleared back to blank is omitted (the validator then reports it as missing, which is the
    // right place for that), and a note blank in every language is dropped altogether.
    const note: Record<string, string> = {};
    for (const [l, t] of Object.entries({ ...waypoint?.note, [lang]: text }))
      if ((t ?? "").trim().length > 0) note[l] = t as string;
    const next: EditWaypoint = { ...waypoint, note };
    if (Object.keys(note).length === 0) delete next.note;
    onChange(next);
  };

  return (
    <div className="card" style={isStart ? { marginBottom: 10 } : { marginTop: 12 }}>
      <label className="actions">
        <input
          type="checkbox"
          checked={waypoint !== undefined}
          style={{ width: "auto" }}
          onChange={(e) => onChange(e.target.checked ? blankWaypoint(defaultLocation) : undefined)}
        />
        {isStart
          ? "Set an explicit start point (otherwise the first station is the meeting point)"
          : "Set an explicit finish point (otherwise the last station is the finish)"}
      </label>

      {waypoint ? (
        <>
          {sameAsStart ? (
            <label
              className="actions"
              style={{ marginTop: 8 }}
              title={sameAsStart.available ? undefined : "Set an explicit start point first"}
            >
              <input
                type="checkbox"
                checked={sameAsStart.checked}
                disabled={!sameAsStart.available}
                style={{ width: "auto" }}
                onChange={(e) => sameAsStart.onToggle(e.target.checked)}
              />
              Same as start (a circular route)
            </label>
          ) : null}

          <div className="row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={loc.lat}
                disabled={locked}
                onChange={(e) => {
                  // Ignore an empty/partial field so it never coerces the point to latitude 0.
                  const lat = e.target.valueAsNumber;
                  if (Number.isFinite(lat)) move(lat, loc.lng);
                }}
              />
            </div>
            <div className="field">
              <label>Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={loc.lng}
                disabled={locked}
                onChange={(e) => {
                  const lng = e.target.valueAsNumber;
                  if (Number.isFinite(lng)) move(loc.lat, lng);
                }}
              />
            </div>
          </div>
          <div style={locked ? { opacity: 0.6 } : undefined}>
            <StationMap
              label={isStart ? "S" : "F"}
              location={loc}
              context={context}
              disabled={locked}
              onMove={move}
            />
          </div>
          <p className="muted small">
            {locked
              ? "The finish follows the start point — move it there, or untick “Same as start” to place the finish on its own."
              : "Drag the pin or click the map, or type coordinates above. The party sees this pin with the note; there is no check-in here."}
          </p>

          <LocalizedField
            label="Note (one line, e.g. next to the kiosk)"
            value={waypoint.note}
            languages={languages}
            optional
            onChange={setNote}
          />
        </>
      ) : null}
    </div>
  );
}
