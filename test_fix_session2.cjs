const fs = require('fs');
const file = 'src/components/business/chat/SessionList.vue';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/uni\\.\\('themeUpdate', handleThemeUpdate\\);/g, "uni.$on('themeUpdate', handleThemeUpdate);");
content = content.replace(/onUnmounted\\(\\(\\)\\s*=>\\s*\\{\\s*uni\\.\\('themeUpdate', handleThemeUpdate\\);\\s*\\}\\);/, "onUnmounted(() => { uni.$off('themeUpdate', handleThemeUpdate); });");
fs.writeFileSync(file, content);
