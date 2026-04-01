import fs from 'node:fs';
import path from 'node:path';

const PAGES_CONFIG_PATH = (() => {
  const root = path.resolve(process.cwd(), 'pages.json');
  if (fs.existsSync(root)) return root;
  return path.resolve(process.cwd(), 'src', 'pages.json');
})();

const ROUTE_QUERY_MAP = {
  'pages/login/index': 'e2e=1',
  'pages/school-sub/detail': 'id=e2e-school',
  'pages/social/friend-profile':
    'uid=e2e_friend&nickname=E2E%20Friend&score=123&studyDays=15&accuracy=88&lastActive=1730000000000'
};

const ROUTE_EXPECTATION_MAP = {
  'pages/splash/index': ['pages/splash/index', 'pages/index/index'],
  'pages/login/index': ['pages/login/index', 'pages/index/index'],
  'pages/login/wechat-callback': ['pages/login/wechat-callback', 'pages/login/index', 'pages/index/index'],
  'pages/login/qq-callback': ['pages/login/qq-callback', 'pages/login/index', 'pages/index/index']
};

function normalizeRoute(route) {
  return String(route || '').replace(/^\/+/, '');
}

export function loadDeclaredRoutes() {
  const raw = fs.readFileSync(PAGES_CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);

  const rootPages = (config.pages || []).map((item) => normalizeRoute(item.path));
  const subPages = (config.subPackages || []).flatMap((pkg) =>
    (pkg.pages || []).map((subPage) => normalizeRoute(`${pkg.root}/${subPage.path}`))
  );

  return Array.from(new Set([...rootPages, ...subPages]));
}

export function buildH5Route(route) {
  const normalized = normalizeRoute(route);
  const query = ROUTE_QUERY_MAP[normalized];
  return query ? `/${normalized}?${query}` : `/${normalized}`;
}

export function expectedRoutesFor(route) {
  const normalized = normalizeRoute(route);
  return ROUTE_EXPECTATION_MAP[normalized] || [normalized];
}

export function routeSnapshotSlug(route) {
  return normalizeRoute(route)
    .replace(/[^a-zA-Z0-9/_-]/g, '_')
    .replace(/\//g, '-');
}
