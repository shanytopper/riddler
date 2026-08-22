import type { EditStation, Loc } from "../model.ts";
import { ChallengeEditor } from "./ChallengeEditor.tsx";
import { LocalizedField } from "./LocalizedField.tsx";

interface Props {
  station: EditStation;
  index: number;
  count: number;
  languages: readonly string[];
  update: (fn: (station: EditStation) => void) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/** Editor for a single station: title, intro, challenge, hints, points, and how it is revealed. */
export function StationEditor({
  station,
  index,
  count,
  languages,
  update,
  onMove,
  onRemove,
}: Props) {
  const paragraphs = (station.intro ?? []).filter((b) => b.type === "paragraph");

  return (
    <details className="station" open={index === 0}>
      <summary>
        <span className="num">{index + 1}</span>
        <strong>{station.title.en || station.title.he || "Untitled station"}</strong>
        <span className="pill">{station.challenge ? station.challenge.type : "info"}</span>
        <span className="pill">{station.points} pts</span>
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
