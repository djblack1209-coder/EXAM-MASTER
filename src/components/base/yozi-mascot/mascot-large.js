// 512px source is outside static; WeChat conditional compilation excludes every import.
let large = {};
// #ifndef MP-WEIXIN
import portrait from '@/assets/brand/mascot-512.webp';
large = {
  '00-reference-front': portrait,
  '01-wave': portrait,
  '02-think': portrait,
  '03-celebrate': portrait,
  '04-encourage': portrait,
  '05-read': portrait,
  '06-sleep': portrait,
  '07-point': portrait,
  '08-curious': portrait,
  '09-blink': portrait,
  '10-wave-b': portrait
};
// #endif
export default large;
