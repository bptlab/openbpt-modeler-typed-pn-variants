import type { ObjectId } from "./net";

/**
 * A token: one object id per data class of its place's color, keyed by data class id.
 * Key order follows the place's color. Tokens are never mutated once created.
 */
export type ObjectToken = { readonly [dataClassId: string]: ObjectId };

/**
 * The current state: the tokens of each place, keyed by place id.
 * Firing replaces a place's array instead of mutating it.
 */
export type Marking = Map<string, readonly ObjectToken[]>;
