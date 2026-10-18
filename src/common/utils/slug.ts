/** Upper bound shared with `CreateOrganizationDto.slug`'s `@MaxLength`. */
export const SLUG_MAX_LENGTH = 128;

/**
 * Turns free text into a lowercase, hyphen-separated slug
 * (`/^[a-z0-9]+(-[a-z0-9]+)*$/`). Returns `fallback` when nothing usable is left.
 */
export function slugify(
  text: string,
  maxLength: number = SLUG_MAX_LENGTH,
  fallback: string = 'org',
): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/**
 * Returns `base` if it is not in `taken`, otherwise the first of `base-2`,
 * `base-3`, … that is free. Deterministic for a given `taken` set; `base` is
 * trimmed so the suffixed result never exceeds `maxLength`.
 */
export function nextAvailableSlug(
  base: string,
  taken: ReadonlySet<string>,
  maxLength: number = SLUG_MAX_LENGTH,
): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const stem = base.slice(0, maxLength - suffix.length).replace(/-+$/, '');
    const candidate = `${stem}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
