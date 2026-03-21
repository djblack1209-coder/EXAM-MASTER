const fs = require('fs');
const file = 'src/components/business/chat/SessionList.vue';
let content = fs.readFileSync(file, 'utf8');

const old1 = "uni.('themeUpdate', handleThemeUpdate);";
const new1 = "uni.$on('themeUpdate', handleThemeUpdate);";
content = content.split(old1).join(new1);

const old2 = "onUnmounted(() => { uni.$on('themeUpdate', handleThemeUpdate); });";
const new2 = "onUnmounted(() => { uni.$off('themeUpdate', handleThemeUpdate); });";
content = content.split(old2).join(new2);

fs.writeFileSync(file, content);
