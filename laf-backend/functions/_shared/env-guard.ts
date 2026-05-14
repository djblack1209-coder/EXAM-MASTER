/**
 * Environment guard — shared module
 *
 * Prevents dev/mock data from leaking into production responses.
 * All cloud functions that serve user-facing data should apply
 * the category allowlist before returning content.
 *
 * @version 1.0.0
 */

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Categories that are approved for production release.
 * Each entry is a human-readable category label stored on
 * the `category` field in the `questions` collection.
 *
 * Any category NOT on this list will be filtered OUT from
 * stats, browse, random, and search results in production mode.
 */
export const PRODUCTION_CATEGORY_ALLOWLIST: ReadonlySet<string> = new Set([
  '政治',
  '英语',
  '数学'
]);

/**
 * Check whether a category label is safe to serve in production.
 * In dev mode all categories pass through for testing convenience.
 */
export function isCategoryProductionSafe(category: string): boolean {
  if (!IS_PRODUCTION) return true;
  return PRODUCTION_CATEGORY_ALLOWLIST.has(String(category || '').trim());
}

/**
 * Filter an array of category-stat records, keeping only
 * production-approved categories.
 *
 * @param categories - The stats array produced by getCategoryStats
 * @returns The filtered array (pass-through in dev)
 */
export function filterCategoryStats(categories: Array<Record<string, any>>): Array<Record<string, any>> {
  if (!IS_PRODUCTION) return categories;
  return categories.filter((item) => PRODUCTION_CATEGORY_ALLOWLIST.has(String(item.category || '').trim()));
}

/**
 * Filter a list of question documents, dropping items whose
 * category is not production-approved.
 */
export function filterQuestionList(list: Array<Record<string, any>>): Array<Record<string, any>> {
  if (!IS_PRODUCTION) return list;
  return list.filter((item) => PRODUCTION_CATEGORY_ALLOWLIST.has(String(item.category || '').trim()));
}

/**
 * Build a MongoDB $in query for production-safe categories.
 * In dev mode returns undefined so no filter is applied.
 */
export function getCategoryAllowlistQuery(): Record<string, any> | undefined {
  if (!IS_PRODUCTION) return undefined;
  return { category: { $in: Array.from(PRODUCTION_CATEGORY_ALLOWLIST) } };
}
