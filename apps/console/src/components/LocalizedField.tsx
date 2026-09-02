import { isComplete, isRtl, languageName, type Loc } from "../model.ts";

interface Props {
  label: string;
  value: Loc | undefined;
  languages: readonly string[];
  onChange: (lang: string, text: string) => void;
  multiline?: boolean;
  placeholder?: string;
  /** The field may be left out entirely; blank in every language is then fine, not "incomplete". */
  optional?: boolean;
}

/** One player-facing field edited in every language side by side, with a completeness dot. */
export function LocalizedField({
  label,
  value,
  languages,
  onChange,
  multiline,
  placeholder,
  optional,
}: Props) {
  const blank = languages.every((l) => (value?.[l] ?? "").trim().length === 0);
  const complete = (optional && blank) || isComplete(value, languages);
  return (
    <div className="field">
      <label>
        {label} {complete ? null : <span className="pill warn">incomplete</span>}
      </label>
      <div
        className="bilingual"
        style={{ gridTemplateColumns: `repeat(${languages.length}, 1fr)` }}
      >
        {languages.map((lang) => {
          const v = value?.[lang] ?? "";
          const dir = isRtl(lang) ? "rtl" : "ltr";
          return (
            <div key={lang}>
              <div className="lang">{languageName(lang)}</div>
              {multiline ? (
                <textarea
                  dir={dir}
                  value={v}
                  placeholder={placeholder}
                  onChange={(e) => onChange(lang, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  dir={dir}
                  value={v}
                  placeholder={placeholder}
                  onChange={(e) => onChange(lang, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
