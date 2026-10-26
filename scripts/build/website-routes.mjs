import { WEBSITE_ROUTES } from '../../src/config/website.js';
export { WEBSITE_ROUTES };
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
