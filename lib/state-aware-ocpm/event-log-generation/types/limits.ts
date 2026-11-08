/**
 * Maximum number of objects to create per object type, keyed by data class name or id,
 * e.g. `{ Order: 3, Item: 10 }`. Types that are not listed are only limited by `maxObjects`.
 */
export type ObjectTypeLimits = { [dataClassNameOrId: string]: number };
