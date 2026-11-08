/**
 * The object attributes of state-aware logs, written by the state-aware log mode of the
 * event log generation and read by the OPID discovery. Writing and reading live here
 * together, so the two cannot drift apart:
 * - `state transition`: `({p1, p2}, {p3})`, the places an object was consumed from and the
 *   places it was produced into in one firing (`{}` for none),
 * - `initialState`: `{p1, p2}`, the places an object of the initial marking starts in
 *   (`{}` for none),
 * - `linkedTypes`: `Order, Item`, the object types a link object links.
 *
 * Place and type names are separated by ", " and not escaped, so names that contain ", "
 * (or "}, {" in a state transition) cannot be read back unambiguously.
 */
import { OcelFormatError } from "./errors";

export const STATE_TRANSITION = "state transition";
export const INITIAL_STATE = "initialState";
export const LINKED_TYPES = "linkedTypes";

const SEPARATOR = ", ";
const STATE_TRANSITION_PATTERN = /^\(\{(.*?)\}, \{(.*)\}\)$/;
const SET_PATTERN = /^\{(.*)\}$/;

export interface StateTransitionValue {
  /** The places the object was consumed from. */
  from: string[];
  /** The places the object was produced into. */
  to: string[];
}

export function formatStateTransition(
  from: Iterable<string>,
  to: Iterable<string>,
): string {
  return `(${formatSet(from)}, ${formatSet(to)})`;
}

/** @throws OcelFormatError if the value is not of the form `({…}, {…})` */
export function parseStateTransition(value: string): StateTransitionValue {
  const match = STATE_TRANSITION_PATTERN.exec(value.trim());
  if (!match) {
    throw new OcelFormatError(
      `Invalid ${STATE_TRANSITION} value "${value}", expected e.g. "({p1, p2}, {p3})".`,
    );
  }
  return { from: splitList(match[1]), to: splitList(match[2]) };
}

export function formatInitialState(places: Iterable<string>): string {
  return formatSet(places);
}

/** @throws OcelFormatError if the value is not of the form `{…}` */
export function parseInitialState(value: string): string[] {
  const match = SET_PATTERN.exec(value.trim());
  if (!match) {
    throw new OcelFormatError(
      `Invalid ${INITIAL_STATE} value "${value}", expected e.g. "{p1, p2}".`,
    );
  }
  return splitList(match[1]);
}

export function formatLinkedTypes(typeNames: readonly string[]): string {
  return typeNames.join(SEPARATOR);
}

export function parseLinkedTypes(value: string): string[] {
  return splitList(value.trim());
}

/** `{a, b}`, or `{}` if empty. */
function formatSet(names: Iterable<string>): string {
  return `{${Array.from(names).join(SEPARATOR)}}`;
}

function splitList(text: string): string[] {
  return text === "" ? [] : text.split(SEPARATOR);
}
