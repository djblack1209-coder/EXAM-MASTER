export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const PRODUCTION_CATEGORY_ALLOWLIST = new Set([
    '政治',
    '英语',
    '数学'
]);
export function isCategoryProductionSafe(category) {
    if (!IS_PRODUCTION)
        return true;
    return PRODUCTION_CATEGORY_ALLOWLIST.has(String(category || '').trim());
}
export function filterCategoryStats(categories) {
    if (!IS_PRODUCTION)
        return categories;
    return categories.filter((item) => PRODUCTION_CATEGORY_ALLOWLIST.has(String(item.category || '').trim()));
}
export function filterQuestionList(list) {
    if (!IS_PRODUCTION)
        return list;
    return list.filter((item) => PRODUCTION_CATEGORY_ALLOWLIST.has(String(item.category || '').trim()));
}
export function getCategoryAllowlistQuery() {
    if (!IS_PRODUCTION)
        return undefined;
    return { category: { $in: Array.from(PRODUCTION_CATEGORY_ALLOWLIST) } };
}
