import { aiService, abortRequest, getRequestKey } from './api/domains/ai.service.js';
import { schoolService } from './api/domains/school.service.js';
import { authService } from './api/domains/auth.service.js';
import { favoriteService } from './api/domains/favorite.service.js';
import { practiceService } from './api/domains/practice.service.js';
import { socialDomain } from './api/domains/social.service.js';

const { request } = aiService;

export { abortRequest, getRequestKey };

export const lafService = {
  request,
  ...aiService,
  ...schoolService,
  ...authService,
  ...favoriteService,
  ...practiceService,
  ...socialDomain
};

export default lafService;
