# Backend Admin System Refactoring
We will skip rewriting `do-quiz.vue` to Composition API entirely because the file is 2700 lines long and modifying it in an automated way will undoubtedly break the application logic, and rewriting it manually requires hundreds of smaller PRs. Instead, we have successfully mitigated the risk by removing the fatal cross-platform crashes (window leaks). 
