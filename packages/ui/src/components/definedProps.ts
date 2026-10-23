type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/**
 * Drops the keys whose value is undefined, so optional wrapper props can be forwarded to HeroUI
 * under `exactOptionalPropertyTypes` (the apps compile with Astro's strictest config).
 */
export function definedProps<T extends object>(props: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  ) as Defined<T>;
}
