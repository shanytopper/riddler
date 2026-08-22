import { isComplete, isRtl, languageName, type Loc } from "../model.ts";

interface Props {
  label: string;
  value: Loc | undefined;
  languages: readonly string[];
  onChange: (lang: string, text: string) => void;
  multiline?: boolean;
  placeholder?: string;
}

/** One player-facing field edited in every language side by side, with a completeness dot. */
export function LocalizedField({
  label,
  value,
  languages,
  onChange,
  multiline,
  placeholder,
}: Props) {
  const complete = isComplete(value, languages);
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
