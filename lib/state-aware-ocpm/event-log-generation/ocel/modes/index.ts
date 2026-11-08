import { EventLogInputError } from "../../errors";
import type { OcelMode } from "../mode";
import { createDefaultMode } from "./defaultMode";
import { createStateAwareMode } from "./stateAwareMode";

const OCEL_MODES = {
  default: createDefaultMode,
  "state-aware": createStateAwareMode,
} satisfies { [name: string]: OcelMode };

export type OcelModeName = keyof typeof OCEL_MODES;

export const OCEL_MODE_NAMES = Object.keys(OCEL_MODES) as OcelModeName[];

/** @throws EventLogInputError for an unknown mode */
export function getOcelMode(name: string = "default"): OcelMode {
  if (!Object.prototype.hasOwnProperty.call(OCEL_MODES, name)) {
    throw new EventLogInputError(
      `Unknown log mode "${name}". Available modes: ${OCEL_MODE_NAMES.join(", ")}.`,
    );
  }
  return OCEL_MODES[name as OcelModeName];
}
