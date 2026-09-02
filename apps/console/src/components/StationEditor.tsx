import { useState } from "react";
import type { EditStation, Loc } from "../model.ts";
import { RADIUS_DEFAULT, RADIUS_MAX, RADIUS_MIN, clampRadius, hasGps, setGps } from "../model.ts";
import { ChallengeEditor } from "./ChallengeEditor.tsx";
import { LocalizedField } from "./LocalizedField.tsx";
import { StationMap, type ContextPin } from "./StationMap.tsx";

interface Props {
  station: EditStation;
  index: number;
  count: number;
  languages: readonly string[];
  /** The other stations, for orientation on this station's map. */
  context: ContextPin[];
  /** A fallback position (the leg's centre) for a station that has no location yet. */
  center: { lat: number; lng: number };
  update: (fn: (station: EditStation) => void) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/** Editor for a single station: title, location, arrival, intro, challenge, hints, points, and reveal. */
export function StationEditor({
  station,
  index,
  count,
  languages,
  context,
  center,
  update,
  onMove,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(index === 0);
  const paragraphs = (station.intro ?? []).filter((b) => b.type === "paragraph");
  const loc = station.location ?? center;
  const radius = hasGps(station) ? (station.arrival.radiusMeters ?? RADIUS_DEFAULT) : null;

  return (
    <details
      className="station"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="num">{index + 1}</span>
        <strong>{station.title.en || station.title.he || "Untitled station"}</strong>
        <span className="pill">{station.challenge ? station.challenge.type : "info"}</span>
        <span className="pill">{station.points} pts</span>
        {radius !== null ? <span className="pill">GPS {radius} m</span> : null}
        <div style={{ flex: 1 }} />
        <span className="list-controls" onClick={(e) => e.preventDefault()}>
          <button
            type="button"
            className="small ghost"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="small ghost"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="small ghost"
            disabled={count === 1}
            title={count === 1 ? "A track needs at least one station" : "Remove this station"}
            onClick={() => onRemove()}
          >
            Remove
          </button>
        </span>
      </summary>

      <div className="body">
        <LocalizedField
          label="Title"
          value={station.title}
          languages={languages}
          onChange={(lang, text) => update((s) => void (s.title[lang] = text))}
        />

        <h2>Location</h2>
        <div className="row">
          <div className="field">
            <label>Latitude</label>
            <input
              type="number"
              step="0.0001"
              value={loc.lat}
              onChange={(e) => {
                // Ignore an empty/partial field so it never coerces the station to latitude 0.
                const lat = e.target.valueAsNumber;
                if (Number.isFinite(lat)) update((s) => void (s.location = { lat, lng: loc.lng }));
              }}
            />
          </div>
          <div className="field">
            <label>Longitude</label>
            <input
              type="number"
              step="0.0001"
              value={loc.lng}
              onChange={(e) => {
                const lng = e.target.valueAsNumber;
                if (Number.isFinite(lng)) update((s) => void (s.location = { lat: loc.lat, lng }));
              }}
            />
          </div>
        </div>
        {open ? (
          <StationMap
            label={String(index + 1)}
            location={loc}
            context={context}
            radiusMeters={radius}
            onMove={(lat, lng) => update((s) => void (s.location = { lat, lng }))}
          />
        ) : null}
        <p className="muted small">
          Drag the pin or click the map, or type coordinates above. Switch to Satellite to place it
          on the ground.
        </p>

        <h2>Arrival</h2>
        <ArrivalEditor station={station} update={update} />

        <div className="field">
          <label>Intro paragraphs (shown on arrival)</label>
          {paragraphs.map((block, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <LocalizedField
                label={`Paragraph ${i + 1}`}
                value={block.text as Loc}
                languages={languages}
                multiline
                onChange={(lang, text) =>
                  update((s) => {
                    const p = (s.intro ?? []).filter((b) => b.type === "paragraph")[i];
                    if (p) (p.text ??= {})[lang] = text;
                  })
                }
              />
              <button
                type="button"
                className="small ghost"
                onClick={() =>
                  update((s) => {
                    const blocks = s.intro ?? [];
                    let seen = -1;
                    s.intro = blocks.filter((b) => !(b.type === "paragraph" && ++seen === i));
                  })
                }
              >
                Remove paragraph
              </button>
            </div>
          ))}
          <button
            type="button"
            className="small"
            onClick={() =>
              update(
                (s) =>
                  void (s.intro = [
                    ...(s.intro ?? []),
                    { type: "paragraph", text: { he: "", en: "" } },
                  ]),
              )
            }
          >
            Add paragraph
          </button>
        </div>

        <h2>Challenge</h2>
        <ChallengeEditor
          challenge={station.challenge}
          languages={languages}
          update={(fn) => update((s) => s.challenge && fn(s.challenge))}
          setChallenge={(next) =>
            update((s) => {
              s.challenge = next;
              if (next === null) {
                s.points = 0;
                s.hints = [];
              }
            })
          }
        />

        {station.challenge ? (
          <>
            <div className="field" style={{ maxWidth: 160 }}>
              <label>Points</label>
              <input
                type="number"
                min={0}
                value={station.points}
                onChange={(e) => update((s) => void (s.points = Number(e.target.value)))}
              />
            </div>

            <div className="field">
              <label>
                Hints (each costs points when revealed; a station with no hints lets a party give up
                immediately)
              </label>
              {station.hints.map((hint, i) => (
                <div className="hintrow" key={i}>
                  <LocalizedField
                    label={`Hint ${i + 1}`}
                    value={hint.text}
                    languages={languages}
                    onChange={(lang, text) =>
                      update(
                        (s) => void ((s.hints[i] as (typeof s.hints)[number]).text[lang] = text),
                      )
                    }
                  />
                  <div>
                    <label>Cost</label>
                    <input
                      type="number"
                      min={0}
                      value={hint.cost}
                      onChange={(e) =>
                        update(
                          (s) =>
                            void ((s.hints[i] as (typeof s.hints)[number]).cost = Number(
                              e.target.value,
                            )),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="small ghost"
                    style={{ marginTop: 22 }}
                    onClick={() =>
                      update((s) => void (s.hints = s.hints.filter((_, j) => j !== i)))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              {station.hints.length < 3 ? (
                <button
                  type="button"
                  className="small"
                  onClick={() =>
                    update(
                      (s) => void (s.hints = [...s.hints, { text: { he: "", en: "" }, cost: 20 }]),
                    )
                  }
                >
                  Add hint
                </button>
              ) : (
                <span className="small muted">Up to three hints.</span>
              )}
            </div>
          </>
        ) : null}

        <h2>Reveal</h2>
        <RevealEditor station={station} languages={languages} update={update} />
      </div>
    </details>
  );
}

function ArrivalEditor({
  station,
  update,
}: {
  station: EditStation;
  update: (fn: (station: EditStation) => void) => void;
}) {
  const gps = hasGps(station);
  const radius = station.arrival.radiusMeters ?? RADIUS_DEFAULT;
  // What the operator is typing, while the field has focus. Clamping every keystroke would turn
  // "150" into 500 (the "1" becomes 10, then "105", then "1050"), so an out-of-range partial value
  // stays on screen and is clamped into the model on blur; in-range values apply as typed.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div>
      <label className="actions">
        <input
          type="checkbox"
          checked={gps}
          style={{ width: "auto" }}
          onChange={(e) => update((s) => setGps(s, e.target.checked))}
        />
        Verify arrival by GPS
      </label>
      {gps ? (
        <div className="field" style={{ maxWidth: 160, marginTop: 8 }}>
          <label>Radius (m)</label>
          <input
            type="number"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={5}
            value={draft ?? radius}
            onChange={(e) => {
              setDraft(e.target.value);
              const r = e.target.valueAsNumber;
              if (Number.isFinite(r) && r >= RADIUS_MIN && r <= RADIUS_MAX)
                update((s) => void (s.arrival.radiusMeters = clampRadius(r)));
            }}
            onBlur={(e) => {
              setDraft(null);
              const r = e.target.valueAsNumber;
              // Only write a real change — a plain focus/blur must not dirty the draft or clear
              // a validation report.
              if (Number.isFinite(r) && clampRadius(r) !== radius)
                update((s) => void (s.arrival.radiusMeters = clampRadius(r)));
            }}
          />
        </div>
      ) : null}
      <p className="muted small">
        When the party is within the radius the app offers “You've reached …”. The manual “We're
        here” check-in stays available as a backup either way. 30 m suits a courtyard or a street
        corner; use 100–500 m for an area-scale station.
      </p>
    </div>
  );
}

function RevealEditor({
  station,
  languages,
  update,
}: {
  station: EditStation;
  languages: readonly string[];
  update: (fn: (station: EditStation) => void) => void;
}) {
  return (
    <div>
      <div className="row">
        <div className="field">
          <label>Shown as</label>
          <select
            value={station.reveal.as}
            onChange={(e) =>
              update((s) => void (s.reveal.as = e.target.value as EditStation["reveal"]["as"]))
            }
          >
            <option value="pin">Pin on the map</option>
            <option value="clue">Clue text</option>
            <option value="both">Both</option>
          </select>
        </div>
        <label className="actions" style={{ alignSelf: "end", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={station.reveal.distanceFeedback ?? false}
            style={{ width: "auto" }}
            onChange={(e) => update((s) => void (s.reveal.distanceFeedback = e.target.checked))}
          />
          Show distance while approaching
        </label>
      </div>
      {station.reveal.as !== "pin" ? (
        <LocalizedField
          label="Clue"
          value={station.reveal.clue?.text}
          languages={languages}
          multiline
          onChange={(lang, text) =>
            update((s) => void ((s.reveal.clue ??= { text: {} }).text[lang] = text))
          }
        />
      ) : null}
      <p className="small muted">The first station of a leg is always a pin, whatever this says.</p>
    </div>
  );
}
