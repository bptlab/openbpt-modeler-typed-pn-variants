/**
 * Intermediate structures of the enablement computation. They mirror the types in the
 * modeler's `moddle/resources/customTypes.d.ts` (named in brackets below).
 */
import type { BindingKey } from "../types/binding";
import type { ObjectId } from "../types/net";

/** A token keyed by binding key instead of data class id (`Token`). */
export type KeyedToken = { [key: BindingKey]: ObjectId };

/** The distinct object ids per binding key (`DataClassInfoDict`). */
export type ValuesPerKey = { [key: BindingKey]: ObjectId[] };

/** What one incoming arc reads from its place (`ArcPlaceInfo`). */
export interface ArcReadInfo {
  arcId: string;
  placeId: string;
  tokens: KeyedToken[];
  isInhibitorArc: boolean;
  /** The arc's inscription covers more than one data class. */
  isLinkingPlace: boolean;
  isExactSyncing: boolean;
  valuesPerKey: ValuesPerKey;
}

/** `ArcPlaceInfoDict` */
export type ArcReadInfoDict = { [arcId: string]: ArcReadInfo };

/** The binding keys joined by one linking place, or by overlapping ones merged together (`Link`). */
export type KeyLink = BindingKey[];

/** `TokenPerLink` */
export type TokensPerLink = { [combinationKey: string]: KeyedToken[] };
