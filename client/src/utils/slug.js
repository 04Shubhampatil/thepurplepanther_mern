/**
 * Str::slug — used only for the product page's `category-<slug>` body class.
 *
 * Laravel slugged the category TITLE rather than using the stored slug column, and the two
 * can differ, so the same transformation is applied here: lower-case, accents stripped,
 * everything that is not a letter or digit collapsed to a single hyphen.
 */
export function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default slugify
