const fs = require('fs');
const file = 'src/components/business/chat/SessionList.vue';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/uni\\.\\('themeUpdate', handleThemeUpdate\\);/g, "uni.$on('themeUpdate', handleThemeUpdate);");
fs.writeFileSync(file, content);
