const fs = require('fs');
const file = 'src/pages/practice-sub/do-quiz.vue';
let content = fs.readFileSync(file, 'utf8');
const optionsApiMatch = content.match(/export default \\{[\\s\\S]*?data\\(\\) \\{/);
if (optionsApiMatch) {
  console.log("Found Options API data() block. Length: " + optionsApiMatch[0].length);
}
