export const WEBSITE_ROUTES = Object.freeze([
  'pages/index/index',
  'pages/login/index',
  'pages/login/wechat-callback',
  'pages/settings/privacy',
  'pages/settings/terms'
]);
export function websiteRoutes(source) {
  const allowed = new Set(WEBSITE_ROUTES);
  const result = {
    ...source,
    pages: source.pages.filter((page) => allowed.has(page.path)),
    subPackages: (source.subPackages || [])
      .map((group) => ({ ...group, pages: group.pages.filter((page) => allowed.has(`${group.root}/${page.path}`)) }))
      .filter((group) => group.pages.length)
  };
  delete result.tabBar;
  delete result.preloadRule;
  return result;
}
