import { EventLogInputError } from "../errors";

export const DEFAULT_START_TIME = "2025-01-01T00:00:00Z";
export const DEFAULT_TIME_STEP_SECONDS = 60;

export interface ClockOptions {
  /** Time of the first firing (ISO 8601). Default: 2025-01-01T00:00:00Z. */
  startTime?: string | Date;
  /** Time between consecutive firings in seconds; silent firings advance the clock too. Default: 60. */
  timeStepSeconds?: number;
}

/** Assigns a time to each firing: firing n (1-based) happens at `startTime + (n - 1) * step`. */
export interface FiringClock {
  timeOfStep(step: number): string;
}

/** @throws EventLogInputError if the start time or the time step is invalid */
export function createFiringClock(options: ClockOptions = {}): FiringClock {
  const start = new Date(options.startTime ?? DEFAULT_START_TIME);
  if (Number.isNaN(start.getTime())) {
    throw new EventLogInputError(
      `The start time must be an ISO 8601 date and time, got "${String(options.startTime)}".`,
    );
  }
  const stepSeconds = options.timeStepSeconds ?? DEFAULT_TIME_STEP_SECONDS;
  if (
    typeof stepSeconds !== "number" ||
    !Number.isFinite(stepSeconds) ||
    stepSeconds <= 0
  ) {
    throw new EventLogInputError(
      `The time step must be a positive number of seconds, got ${String(stepSeconds)}.`,
    );
  }

  const startMs = start.getTime();
  const stepMs = stepSeconds * 1000;
  return {
    timeOfStep: (step) => formatTime(new Date(startMs + (step - 1) * stepMs)),
  };
}

/** ISO 8601 in UTC, without milliseconds when they are zero (as in the OCEL examples). */
export function formatTime(date: Date): string {
  return date.toISOString().replace(/\.000Z$/, "Z");
}
