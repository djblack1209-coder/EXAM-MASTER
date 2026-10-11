import { translateRegisteredText } from './index.js';
// Translate known interface labels/receipts from the existing domain. Never call
// this on questions, original answers, model replies or user-authored materials.
export function learningText(value) {
  return translateRegisteredText('learning', value);
}
