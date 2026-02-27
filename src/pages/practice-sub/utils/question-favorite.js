/**
 * Re-export shim — 实际实现已合并至 @/utils/favorite/question-favorite.js
 * 请勿在此文件中添加任何逻辑。
 */
export {
  questionFavoriteManager,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  isFavorited,
  getFavorites,
  getFolders,
  getFavoriteFolders,
  createFolder,
  moveToFolder,
  updateNote,
  getFavoriteStats,
  updateFavoriteNote
} from '@/utils/favorite/question-favorite.js';

export { default } from '@/utils/favorite/question-favorite.js';
