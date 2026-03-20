const fs = require('fs');
const content = fs.readFileSync('src/App.vue', 'utf8');
const lines = content.split('\n');
const insertIndex = lines.findIndex(line => line.includes("@import 'wot-design-uni/components/common/abstracts/variable.scss';"));
lines.splice(insertIndex + 1, 0, "/* Wot Design Uni Theme Mapping */", "@use './styles/_wot-theme.scss';");
fs.writeFileSync('src/App.vue', lines.join('\n'));
