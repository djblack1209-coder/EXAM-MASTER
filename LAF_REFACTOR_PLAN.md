# Plan: Interface Segregation of lafService.js
## 1. Goal
Extract the 2500+ lines of lafService.js into smaller, domain-specific modules while maintaining a facade (or updating imports) so we don't break existing do-quiz.vue or pk-battle.vue logic immediately.
## 2. Directory Structure to Create (src/services/api/)
- core/request.js: Contains the request(), _requestSign(), delay(), and rate-limiting logic.
- domains/ai.service.js: proxyAI, aiFriendChat, photoSearch, etc.
- domains/school.service.js: getSchoolList, getSchoolDetail, etc.
- domains/auth.service.js: login, updateUserProfile, etc.
- domains/favorite.service.js: addFavorite, removeFavorite.
- domains/practice.service.js: submitAnswer, getQuestionBank, mistakeManager functions.
- domains/social.service.js: getRanking, getFriends.
## 3. Migration Strategy
1. Extract Core: Move the actual HTTPS request wrapping, interceptors, and request() method to core/request.js.
2. Extract Domains: Create the domain files and have them import core/request.js.
3. Facade Pattern: Keep lafService.js alive for now. Rewrite it to simply import the domain services and re-export them under the lafService object. This guarantees zero downtime for the 50+ files currently importing lafService.js.
