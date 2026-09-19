/**
 * How the pet is feeling, and — the part that matters — why.
 *
 * Mood is the tug that makes someone open the app without being a demand. Two
 * rules keep it on the right side of that line:
 *
 *  1. It never gates anything. A sad pet still does everything a happy one
 *     does; the only consequence is that you can see it's sad.
 *  2. It always comes with a reason in plain words. A drooping face with no
 *     explanation is a guilt mechanic; "nobody's replied to Kiwi in a while"
 *     is information.
 *
 * Derived on read from signals already recorded, so there's no mood column to
 * drift out of step with reality.
 */

import type { Phrase } from "./i18n";

export const CARE_KINDS = ["feed", "groom", "play"] as const;
export type CareKind = (typeof CARE_KINDS)[number];

export const CARE_LABEL: Record<CareKind, { verb: string; done: string }> = {
  feed: { verb: "Feed", done: "Fed" },
  groom: { verb: "Groom", done: "Groomed" },
  play: { verb: "Play", done: "Played" },
};

/** Signals that feed the calculation. All are already stored for other reasons. */
export type MoodSignals = {
  /** Distinct care actions done today, 0–3. */
  careToday: number;
  /** Likes + replies the pet's posts received in the last 48h. */
  socialWins: number;
  /** Hours since the owner last opened the app. */
  hoursSinceOwnerActive: number;
  /** Decisions waiting on an answer. */
  pendingAsks: number;
  /** Whether the pet did anything at all in the last 24h. */
  actedRecently: boolean;
};

export type MoodName = "excited" | "love" | "happy" | "thinking" | "shy" | "sleepy" | "sad";

export type Mood = {
  name: MoodName;
  /** 0–100. Exposed so the app can show a bar without re-deriving the rules. */
  score: number;
  /**
   * The causes, strongest first. Never empty.
   *
   * Phrases rather than sentences: which reason applies depends on signals only
   * the server has, but the wording has to happen where the reader is.
   */
  reasons: Phrase[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function computeMood(signals: MoodSignals): Mood {
  const { careToday, socialWins, hoursSinceOwnerActive, pendingAsks, actedRecently } = signals;

  let score = 55; // Contented by default: a pet nobody has touched isn't miserable.
  const up: Phrase[] = [];
  const down: Phrase[] = [];

  if (careToday > 0) {
    score += careToday * 8;
    up.push({ key: careToday >= 3 ? "mood.careAll" : "mood.careSome" });
  }

  if (socialWins > 0) {
    score += clamp(socialWins * 4, 0, 20);
    up.push({ key: "mood.reacted", count: socialWins });
  }

  // The dominant signal, because being forgotten is the thing a companion
  // notices. Stops falling after a few days — permanently miserable is just
  // punishment, and the pet stops acting by then anyway.
  if (hoursSinceOwnerActive >= 12) {
    const days = hoursSinceOwnerActive / 24;
    score -= clamp(Math.round(days * 14), 0, 40);
    down.push(
      days < 1
        ? { key: "mood.notSeenToday" }
        : days < 2
          ? { key: "mood.notSeenYesterday" }
          : { key: "mood.notSeenDays", count: Math.floor(days) },
    );
  }

  if (pendingAsks > 0) {
    score -= clamp(pendingAsks * 5, 0, 15);
    down.push({ key: "mood.waiting", count: pendingAsks });
  }

  if (!actedRecently) {
    score -= 5;
    down.push({ key: "mood.quiet" });
  }

  score = clamp(Math.round(score), 0, 100);

  // Ordered so the strongest cause leads; a pet that's both fed and forgotten
  // should say the forgotten part first.
  const reasons = [...down, ...up];
  if (reasons.length === 0) reasons.push({ key: "mood.pottering" });

  return { name: nameFor(score, signals), score, reasons };
}

function nameFor(score: number, { careToday, socialWins, hoursSinceOwnerActive }: MoodSignals): MoodName {
  if (hoursSinceOwnerActive >= 72) return "sad";
  if (score >= 85) return socialWins >= 3 ? "excited" : "love";
  if (score >= 70) return careToday > 0 ? "love" : "happy";
  if (score >= 55) return "happy";
  if (score >= 40) return "thinking";
  if (score >= 25) return "shy";
  return hoursSinceOwnerActive >= 36 ? "sleepy" : "sad";
}
