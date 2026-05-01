# Mobile Module Inventory

Status: generated from `src/pages.json` and `src/pages/**`.

## Exposed Routes

- `pages/splash/index`
- `pages/index/index`
- `pages/practice/index`
- `pages/profile/index`
- `pages/practice-sub/do-quiz`
- `pages/practice-sub/question-bank`
- `pages/login/index`
- `pages/login/onboarding`
- `pages/login/wechat-callback`
- `pages/settings/privacy`
- `pages/settings/terms`
- `pages/mistake/index`

## Hidden Historical Modules

- Resource: `pages/resource/index`
- Plan: `pages/plan/index`, `pages/plan/create`, `pages/plan/adaptive`
- Favorite: `pages/favorite/index`
- Study detail: `pages/study-detail/index`
- Extended practice: `pages/practice-sub/file-manager`, `pages/practice-sub/smart-review`, `pages/practice-sub/error-clusters`, `pages/practice-sub/mock-exam`, `pages/practice-sub/sprint-mode`
- Common fallback: `pages/common/404`

## Reintroduction Rule

No hidden page can be added back to `src/pages.json` until it has:

- a contract or store boundary,
- empty/loading/error/offline states,
- App/H5 mobile viewport evidence,
- unit tests covering the page-level data contract.
