/**
 * 图标注册表 - 映射图标名称到 SVG 文件路径
 * 统一管理所有图标，替代散落在各处的 Emoji
 */

const BASE = '/static/icons/ui';

// 自动生成路径映射
const ICON_NAMES = [
  'check',
  'cross',
  'close',
  'edit',
  'delete',
  'search',
  'refresh',
  'star',
  'star-outline',
  'lock',
  'copy',
  'link',
  'arrow-right',
  'book',
  'books',
  'notebook',
  'note',
  'pen',
  'graduation',
  'trophy',
  'target',
  'flame',
  'lightning',
  'timer',
  'clock',
  'calendar',
  'chart-up',
  'chart-bar',
  'brain',
  'formula',
  'sparkle',
  'celebrate',
  'rocket',
  'medal',
  'crown',
  'muscle',
  'bulb',
  'file',
  'file-pdf',
  'file-doc',
  'file-xls',
  'file-ppt',
  'file-image',
  'folder',
  'info',
  'success',
  'warning',
  'error',
  'question',
  'empty',
  'upload',
  'download',
  'offline',
  'loading',
  'heart',
  'heart-outline',
  'comment',
  'globe',
  'image',
  'camera',
  'email',
  'settings',
  'moon',
  'sun',
  'robot',
  'sword',
  'bookmark',
  'tag',
  'key',
  'compass',
  'ruler',
  'shield',
  'ticket',
  'path'
];

export const ICON_MAP = {};
ICON_NAMES.forEach((name) => {
  ICON_MAP[name] = `${BASE}/${name}.svg`;
});

// 别名映射（emoji 语义 -> 图标名）
const ALIASES = {
  'category-mistakes': 'target',
  'category-hot': 'flame',
  'category-practice': 'note',
  'category-concept': 'brain',
  'category-formula': 'formula',
  'category-reading': 'book',
  'tag-keypoint': 'key',
  'tag-formula': 'ruler',
  'tag-trick': 'bulb',
  'tag-trap': 'warning',
  'tag-summary': 'note',
  'tag-link': 'link',
  'mode-sequential': 'books',
  'mode-targeted': 'target',
  'mode-timed': 'timer',
  'mode-review': 'refresh',
  'mode-reading': 'book',
  'fav-default': 'star',
  'fav-important': 'flame',
  'fav-review': 'book',
  'fav-difficult': 'muscle',
  'achieve-first': 'target',
  'achieve-10': 'note',
  'achieve-100': 'books',
  'achieve-streak3': 'flame',
  'achieve-streak7': 'muscle',
  'achieve-streak30': 'crown',
  'achieve-accuracy': 'sparkle',
  'mood-happy': 'heart',
  'mood-thinking': 'brain',
  'mood-sleepy': 'moon',
  'mood-anxious': 'warning',
  'mood-tired': 'clock',
  'mood-celebrate': 'celebrate'
};

Object.keys(ALIASES).forEach((alias) => {
  ICON_MAP[alias] = ICON_MAP[ALIASES[alias]];
});

/**
 * 获取图标路径
 * @param {string} name - 图标名称
 * @param {string} [fallback] - 未找到时的备选路径
 * @returns {string} SVG 文件路径
 */
export function getIconPath(name, fallback) {
  return ICON_MAP[name] || fallback || `${BASE}/info.svg`;
}
