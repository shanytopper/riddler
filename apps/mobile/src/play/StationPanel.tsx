import type { Challenge, ContentBlock, Station, TrackContent } from "@riddles/bundle-schema";
import type { AnswerInput, SessionState } from "@riddles/game-core";
import { canRevealAndContinue, stationState } from "@riddles/game-core";
import { useState } from "react";
import { Image, View } from "react-native";
import { bundleMediaUri, type InstalledBundle } from "../bundles/bundleStore.ts";
import { Button } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { ThemedText } from "../components/ThemedText.tsx";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { formatDistance } from "../i18n/strings.ts";
import { distanceMeters } from "../map/geo.ts";
import type { Position } from "../map/types.ts";
import { useTheme } from "../theme/index.ts";
import { ChallengeInput } from "./ChallengeInput.tsx";

export interface StationPanelProps {
  bundle: InstalledBundle;
  content: TrackContent;
  state: SessionState;
  station: Station;
  stationNumber: number;
  position: Position | null;
  onArrive: (method: "manual" | "gps") => void;
  onRevealHint: () => void;
  onSubmit: (input: AnswerInput) => { correct: boolean };
  onRevealAndContinue: () => void;
}

/** Everything below the map for the station in play: the clue, then the station itself. */
export function StationPanel(props: StationPanelProps) {
  const s = stationState(props.state, props.station.id);
  if (s.status === "revealed") return <CluePanel {...props} />;
  if (s.status === "arrived") return <ArrivedPanel {...props} />;
  return null;
}

function CluePanel({ station, stationNumber, position, onArrive }: StationPanelProps) {
  const { space } = useTheme();
  const { t, language, localized } = useLanguage();
  const showClue = station.reveal.as === "clue" || station.reveal.as === "both";
  const distance = position && station.location ? distanceMeters(position, station.location) : null;
  const withinRadius =
    distance !== null &&
    station.arrival.methods.includes("gps") &&
    distance <= (station.arrival.radiusMeters ?? 30) &&
    (position?.accuracy ?? Infinity) <= Math.max(station.arrival.radiusMeters ?? 30, 50);
  return (
    <View style={{ gap: space(2) }}>
      <ThemedText variant="label" tone="muted">
        {t("stationNumber", { n: stationNumber })}
      </ThemedText>
      {showClue && station.reveal.clue ? (
        <ThemedText variant="heading">{localized(station.reveal.clue.text)}</ThemedText>
      ) : (
        <ThemedText variant="heading">{t("headToPin")}</ThemedText>
      )}
      {station.reveal.distanceFeedback && distance !== null ? (
        <ThemedText tone="muted">
          {t("distanceAway", { distance: formatDistance(language, distance) })}
        </ThemedText>
      ) : null}
      {withinRadius ? (
        <Button
          label={t("youveReached", { station: localized(station.title) })}
          variant="accent"
          onPress={() => onArrive("gps")}
        />
      ) : null}
      <Button
        label={t("weAreHere")}
        variant={withinRadius ? "secondary" : "primary"}
        onPress={() => onArrive("manual")}
      />
    </View>
  );
}

function ArrivedPanel(props: StationPanelProps) {
  const {
    bundle,
    content,
    state,
    station,
    stationNumber,
    onRevealHint,
    onSubmit,
    onRevealAndContinue,
  } = props;
  const { colors, space } = useTheme();
  const { t, localized } = useLanguage();
  const s = stationState(state, station.id);
  const [wrongOptionIds, setWrongOptionIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"idle" | "wrong">("idle");
  const challenge = station.challenge;
  const penalty = Math.round((station.points * content.rules.wrongChoicePenaltyPercent) / 100);

  const submit = (input: AnswerInput) => {
    const { correct } = onSubmit(input);
    if (correct) return;
    setFeedback("wrong");
    if (input.kind === "choice") setWrongOptionIds((ids) => [...ids, input.optionId]);
  };

  return (
    <View style={{ gap: space(2.5) }}>
      <View style={{ gap: space(0.5) }}>
        <ThemedText variant="label" tone="muted">
          {t("stationNumber", { n: stationNumber })}
        </ThemedText>
        <ThemedText variant="title">{localized(station.title)}</ThemedText>
      </View>
      <Blocks bundle={bundle} blocks={station.intro ?? []} />

      {challenge ? (
        <Card>
          <View style={{ gap: space(2) }}>
            <ThemedText variant="heading">{localized(challenge.prompt)}</ThemedText>
            <ChallengeInput
              challenge={challenge}
              stationId={station.id}
              wrongOptionIds={wrongOptionIds}
              onSubmit={submit}
            />
            {feedback === "wrong" ? (
              <ThemedText tone="danger">
                {challenge.type === "choice" || challenge.type === "multi_choice"
                  ? t("wrongChoice", { penalty })
                  : t("wrongTryAgain")}
              </ThemedText>
            ) : null}
          </View>
        </Card>
      ) : null}

      {challenge && station.hints.length > 0 ? (
        <View style={{ gap: space(1) }}>
          <ThemedText variant="label" tone="muted">
            {t("hints")}
          </ThemedText>
          {station.hints.slice(0, s.hintsRevealed).map((hint, index) => (
            <View
              key={index}
              style={{
                flexDirection: "row",
                gap: space(1),
                padding: space(1.5),
                borderRadius: 12,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <ThemedText variant="label" tone="muted">
                {index + 1}
              </ThemedText>
              <ThemedText style={{ flex: 1 }}>{localized(hint.text)}</ThemedText>
            </View>
          ))}
          {s.hintsRevealed < station.hints.length ? (
            <Button
              label={t("revealHint", {
                n: s.hintsRevealed + 1,
                cost: station.hints[s.hintsRevealed]?.cost ?? 0,
              })}
              variant="secondary"
              onPress={onRevealHint}
            />
          ) : null}
        </View>
      ) : null}

      {challenge && canRevealAndContinue(content, state, station.id) ? (
        <View style={{ gap: space(1) }}>
          <ThemedText variant="label" tone="muted">
            {t("stuck")}
          </ThemedText>
          <Button label={t("revealAnswer")} variant="ghost" onPress={onRevealAndContinue} />
        </View>
      ) : null}
    </View>
  );
}

function Blocks({ bundle, blocks }: { bundle: InstalledBundle; blocks: ContentBlock[] }) {
  const { radius, space } = useTheme();
  const { localized } = useLanguage();
  if (blocks.length === 0) return null;
  return (
    <View style={{ gap: space(1.5) }}>
      {blocks.map((block, index) => {
        if (block.type === "paragraph")
          return <ThemedText key={index}>{localized(block.text)}</ThemedText>;
        const media = bundle.content.media.find((m) => m.id === block.mediaId);
        if (!media) return null;
        return (
          <View key={index} style={{ gap: space(0.5) }}>
            <Image
              source={{ uri: bundleMediaUri(bundle, media.path) }}
              style={{ width: "100%", aspectRatio: 3 / 2, borderRadius: radius.md }}
              resizeMode="cover"
              accessibilityLabel={media.alt ? localized(media.alt) : undefined}
            />
            {block.caption ? (
              <ThemedText variant="caption" tone="muted">
                {localized(block.caption)}
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** The answer to show when a party gives up, in the UI language. */
export function answerText(
  challenge: Challenge,
  localized: (value: Record<string, string | undefined> | undefined, fallback?: string) => string,
  language: string,
): string {
  switch (challenge.type) {
    case "text":
      return challenge.accepted[language]?.[0] ?? Object.values(challenge.accepted).flat()[0] ?? "";
    case "number":
      return String(challenge.answer);
    case "choice":
      return localized(
        challenge.options.find((option) => option.id === challenge.correctOptionId)?.text,
      );
    case "multi_choice":
      return challenge.options
        .filter((option) => challenge.correctOptionIds.includes(option.id))
        .map((option) => localized(option.text))
        .join(", ");
  }
}
