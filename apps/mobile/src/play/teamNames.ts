import type { UiLanguage } from "../i18n/strings.ts";

export const TEAM_NAME_SUGGESTIONS: Record<UiLanguage, readonly string[]> = {
  he: ["הנמרים", "הצפרדעים", "חוקרי המעיין", "הינשופים", "הדורבנים"],
  en: ["The Foxes", "Trailblazers", "Team Oak", "The Owls", "Spring Seekers"],
};

// The length rule and the profanity filter live in game-core so the API applies the same ones.
export { TEAM_NAME_MAX, TEAM_NAME_MIN, validateTeamName } from "@riddles/game-core";
export type { TeamNameVerdict } from "@riddles/game-core";
