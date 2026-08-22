import type { ChallengeType, EditChallenge, Loc } from "../model.ts";
import { blankChallenge, languageName } from "../model.ts";
import { LocalizedField } from "./LocalizedField.tsx";

interface Props {
  challenge: EditChallenge | null;
  languages: readonly string[];
  update: (fn: (challenge: EditChallenge) => void) => void;
  setChallenge: (challenge: EditChallenge | null) => void;
}

/** Edits one station's challenge; switching the type replaces it with a blank of that type. */
export function ChallengeEditor({ challenge, languages, update, setChallenge }: Props) {
  return (
    <div>
      <div className="field">
        <label>Challenge type</label>
        <select
          value={challenge?.type ?? "none"}
          onChange={(e) => {
            const t = e.target.value;
            setChallenge(
              t === "none"
                ? null
                : (blankChallenge(t as ChallengeType) as unknown as EditChallenge),
            );
          }}
        >
          <option value="none">None (info station, no points)</option>
          <option value="number">Number</option>
          <option value="text">Text</option>
          <option value="choice">Single choice</option>
          <option value="multi_choice">Multiple choice</option>
        </select>
      </div>

      {challenge ? (
        <>
          <LocalizedField
            label="Question"
            value={challenge.prompt}
            languages={languages}
            onChange={(lang, text) => update((c) => void (c.prompt[lang] = text))}
            multiline
          />

          {challenge.type === "number" ? (
            <div className="row">
              <div className="field">
                <label>Answer</label>
                <input
                  type="number"
                  value={challenge.answer}
                  onChange={(e) =>
                    update((c) => c.type === "number" && void (c.answer = Number(e.target.value)))
                  }
                />
              </div>
              <div className="field">
                <label>Tolerance (±)</label>
                <input
                  type="number"
                  min={0}
                  value={challenge.tolerance?.value ?? 0}
                  onChange={(e) =>
                    update(
                      (c) =>
                        c.type === "number" &&
                        void (c.tolerance = { kind: "absolute", value: Number(e.target.value) }),
                    )
                  }
                />
              </div>
            </div>
          ) : null}

          {challenge.type === "text" ? (
            <div className="stack">
              {languages.map((lang) => (
                <div className="field" key={lang}>
                  <label>Accepted answers · {languageName(lang)} (comma-separated)</label>
                  <input
                    type="text"
                    dir={lang === "he" ? "rtl" : "ltr"}
                    value={(challenge.accepted[lang] ?? []).join(", ")}
                    onChange={(e) =>
                      update(
                        (c) =>
                          c.type === "text" &&
                          void (c.accepted[lang] = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)),
                      )
                    }
                  />
                </div>
              ))}
              <label className="actions">
                <input
                  type="checkbox"
                  checked={challenge.closeMatch ?? false}
                  style={{ width: "auto" }}
                  onChange={(e) =>
                    update((c) => c.type === "text" && void (c.closeMatch = e.target.checked))
                  }
                />
                Accept small typos
              </label>
            </div>
          ) : null}

          {challenge.type === "choice" || challenge.type === "multi_choice" ? (
            <ChoiceEditor challenge={challenge} languages={languages} update={update} />
          ) : null}
        </>
      ) : (
        <p className="muted small">
          An info station shows its intro and reveals the next station immediately. Points are 0 and
          hints are removed.
        </p>
      )}
    </div>
  );
}

function ChoiceEditor({
  challenge,
  languages,
  update,
}: {
  challenge: Extract<EditChallenge, { type: "choice" | "multi_choice" }>;
  languages: readonly string[];
  update: (fn: (challenge: EditChallenge) => void) => void;
}) {
  const multi = challenge.type === "multi_choice";
  const isCorrect = (id: string) =>
    challenge.type === "multi_choice"
      ? challenge.correctOptionIds.includes(id)
      : challenge.correctOptionId === id;

  const toggleCorrect = (id: string) =>
    update((c) => {
      if (c.type === "choice") c.correctOptionId = id;
      else if (c.type === "multi_choice")
        c.correctOptionIds = c.correctOptionIds.includes(id)
          ? c.correctOptionIds.filter((x) => x !== id)
          : [...c.correctOptionIds, id];
    });

  return (
    <div className="stack">
      <label>Options (tick the correct {multi ? "ones" : "one"})</label>
      {challenge.options.map((option) => (
        <div className="card" key={option.id} style={{ padding: 10 }}>
          <div className="actions" style={{ marginBottom: 6 }}>
            <input
              type={multi ? "checkbox" : "radio"}
              checked={isCorrect(option.id)}
              style={{ width: "auto" }}
              onChange={() => toggleCorrect(option.id)}
            />
            <span className="small muted">correct</span>
            <div className="spacer" style={{ flex: 1 }} />
            <button
              type="button"
              className="small ghost"
              disabled={challenge.options.length <= 2}
              onClick={() =>
                update((c) => {
                  if (c.type !== "choice" && c.type !== "multi_choice") return;
                  c.options = c.options.filter((o) => o.id !== option.id);
                  if (c.type === "choice" && c.correctOptionId === option.id)
                    c.correctOptionId = c.options[0]?.id ?? "";
                  if (c.type === "multi_choice")
                    c.correctOptionIds = c.correctOptionIds.filter((x) => x !== option.id);
                })
              }
            >
              Remove
            </button>
          </div>
          <LocalizedField
            label="Option text"
            value={option.text as Loc}
            languages={languages}
            onChange={(lang, text) =>
              update((c) => {
                if (c.type !== "choice" && c.type !== "multi_choice") return;
                const target = c.options.find((o) => o.id === option.id);
                if (target) target.text[lang] = text;
              })
            }
          />
        </div>
      ))}
      <div className="actions">
        <button
          type="button"
          className="small"
          onClick={() =>
            update((c) => {
              if (c.type !== "choice" && c.type !== "multi_choice") return;
              const id = nextOptionId(c.options.map((o) => o.id));
              c.options = [...c.options, { id, text: { he: "", en: "" } }];
            })
          }
        >
          Add option
        </button>
        <label className="actions" style={{ marginInlineStart: 8 }}>
          <input
            type="checkbox"
            checked={challenge.shuffle ?? true}
            style={{ width: "auto" }}
            onChange={(e) =>
              update(
                (c) =>
                  (c.type === "choice" || c.type === "multi_choice") &&
                  void (c.shuffle = e.target.checked),
              )
            }
          />
          Shuffle order
        </label>
      </div>
    </div>
  );
}

function nextOptionId(existing: string[]): string {
  for (let i = 0; i < 26; i++) {
    const id = String.fromCharCode(97 + i);
    if (!existing.includes(id)) return id;
  }
  return `opt-${existing.length + 1}`;
}
