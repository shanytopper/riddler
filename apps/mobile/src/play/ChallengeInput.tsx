import type { Challenge, ChoiceOption } from "@riddles/bundle-schema";
import type { AnswerInput } from "@riddles/game-core";
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button } from "../components/Button.tsx";
import { ThemedText } from "../components/ThemedText.tsx";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { useTheme } from "../theme/index.ts";

interface ChallengeInputProps {
  challenge: Challenge;
  stationId: string;
  /** Option ids already tried and wrong, so they render disabled. */
  wrongOptionIds: readonly string[];
  onSubmit: (input: AnswerInput) => void;
  disabled?: boolean;
}

/** The answer controls for each challenge type (design.md §4.4). */
export function ChallengeInput({
  challenge,
  stationId,
  wrongOptionIds,
  onSubmit,
  disabled,
}: ChallengeInputProps) {
  switch (challenge.type) {
    case "text":
    case "number":
      return (
        <TypedAnswer
          kind={challenge.type}
          placeholder={challenge.type === "text" ? challenge.placeholder : undefined}
          unit={challenge.type === "number" ? challenge.unit : undefined}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      );
    case "choice":
      return (
        <Choices
          stationId={stationId}
          options={challenge.options}
          shuffle={challenge.shuffle ?? true}
          wrong={wrongOptionIds}
          disabled={disabled}
          onPick={(id) => onSubmit({ kind: "choice", optionId: id })}
        />
      );
    case "multi_choice":
      return (
        <MultiChoices
          stationId={stationId}
          options={challenge.options}
          shuffle={challenge.shuffle ?? true}
          disabled={disabled}
          onSubmit={(ids) => onSubmit({ kind: "multi_choice", optionIds: ids })}
        />
      );
  }
}

function TypedAnswer({
  kind,
  placeholder,
  unit,
  onSubmit,
  disabled,
}: {
  kind: "text" | "number";
  placeholder?: Record<string, string | undefined>;
  unit?: Record<string, string | undefined>;
  onSubmit: (input: AnswerInput) => void;
  disabled?: boolean;
}) {
  const { colors, fonts, radius, space } = useTheme();
  const { t, localized } = useLanguage();
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onSubmit({ kind, text });
  };
  return (
    <View style={{ gap: space(1) }}>
      <ThemedText variant="label" tone="muted">
        {t("yourAnswer")}
      </ThemedText>
      <View style={{ flexDirection: "row", gap: space(1), alignItems: "center" }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          editable={!disabled}
          placeholder={placeholder ? localized(placeholder) : undefined}
          placeholderTextColor={colors.textMuted}
          keyboardType={kind === "number" ? "numeric" : "default"}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={t("yourAnswer")}
          style={{
            flex: 1,
            minHeight: 52,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: space(1.5),
            color: colors.text,
            backgroundColor: colors.background,
            fontSize: 18,
            fontFamily: fonts.regular,
          }}
        />
        {unit ? <ThemedText tone="muted">{localized(unit)}</ThemedText> : null}
        <Button
          label={t("check")}
          variant="accent"
          onPress={submit}
          disabled={disabled || !text.trim()}
        />
      </View>
    </View>
  );
}

/** Stable per-station shuffle, so a re-render never reorders the options under a finger. */
function orderOptions(
  options: readonly ChoiceOption[],
  stationId: string,
  shuffle: boolean,
): ChoiceOption[] {
  const list = [...options];
  if (!shuffle) return list;
  let seed = 0;
  for (const char of stationId) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  for (let i = list.length - 1; i > 0; i--) {
    seed = (seed * 1_103_515_245 + 12_345) >>> 0;
    const j = seed % (i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

function OptionRow({
  option,
  state,
  onPress,
  disabled,
}: {
  option: ChoiceOption;
  state: "idle" | "wrong" | "selected";
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, radius, space } = useTheme();
  const { localized } = useLanguage();
  const blocked = disabled || state === "wrong";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, selected: state === "selected" }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: space(1.5),
        paddingHorizontal: space(2),
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: state === "selected" ? colors.primary : colors.border,
        backgroundColor: state === "selected" ? colors.surfaceAlt : colors.background,
        opacity: state === "wrong" ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      <ThemedText style={state === "wrong" ? { textDecorationLine: "line-through" } : undefined}>
        {localized(option.text)}
      </ThemedText>
    </Pressable>
  );
}

function Choices({
  stationId,
  options,
  shuffle,
  wrong,
  onPick,
  disabled,
}: {
  stationId: string;
  options: readonly ChoiceOption[];
  shuffle: boolean;
  wrong: readonly string[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const { space } = useTheme();
  const { t } = useLanguage();
  const ordered = useMemo(
    () => orderOptions(options, stationId, shuffle),
    [options, stationId, shuffle],
  );
  return (
    <View style={{ gap: space(1) }}>
      <ThemedText variant="label" tone="muted">
        {t("chooseAnswer")}
      </ThemedText>
      {ordered.map((option) => (
        <OptionRow
          key={option.id}
          option={option}
          state={wrong.includes(option.id) ? "wrong" : "idle"}
          onPress={() => onPick(option.id)}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

function MultiChoices({
  stationId,
  options,
  shuffle,
  onSubmit,
  disabled,
}: {
  stationId: string;
  options: readonly ChoiceOption[];
  shuffle: boolean;
  onSubmit: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { space } = useTheme();
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const ordered = useMemo(
    () => orderOptions(options, stationId, shuffle),
    [options, stationId, shuffle],
  );
  return (
    <View style={{ gap: space(1) }}>
      <ThemedText variant="label" tone="muted">
        {t("chooseAnswer")}
      </ThemedText>
      {ordered.map((option) => (
        <OptionRow
          key={option.id}
          option={option}
          state={selected.includes(option.id) ? "selected" : "idle"}
          disabled={disabled}
          onPress={() =>
            setSelected((ids) =>
              ids.includes(option.id) ? ids.filter((id) => id !== option.id) : [...ids, option.id],
            )
          }
        />
      ))}
      <Button
        label={t("check")}
        variant="accent"
        onPress={() => onSubmit(selected)}
        disabled={disabled || selected.length === 0}
      />
    </View>
  );
}
