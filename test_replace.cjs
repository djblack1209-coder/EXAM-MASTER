const fs = require('fs');
const file = 'src/pages/practice-sub/do-quiz.vue';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import QuestionChoice from ')) {
  content = content.replace(/import CustomModal from '@\/components\/common\/CustomModal\.vue';/, "import CustomModal from '@/components/common/CustomModal.vue';\nimport QuestionChoice from './components/QuestionChoice.vue';");
}

if (!content.includes('QuestionChoice,')) {
  content = content.replace(/components: \\{/, "components: {\n    QuestionChoice,");
}

const templateRegex = /<view v-if="currentQuestion && currentQuestion\.options" class="options-list">[\\s\\S]*?<\/view>\n      <\/view>/;

const replacement = `<view v-if="currentQuestion && currentQuestion.options" class="options-wrapper">
        <QuestionChoice 
          :options="currentQuestion.options"
          :userChoice="userChoice"
          :hasAnswered="hasAnswered"
          :isAnalyzing="isAnalyzing"
          :isCorrectOption="isCorrectOption"
          :getOptionLabel="getOptionLabel"
          @select="selectOption"
        />
      </view>`;

content = content.replace(templateRegex, replacement);

fs.writeFileSync(file, content);
console.log("Successfully extracted options list to QuestionChoice component in do-quiz.vue");
