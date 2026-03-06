# Git Cleanup Plan

## Goal

Keep repository history clean by committing cleanup work in focused batches.

> Note: repository currently contains unrelated ongoing changes; review each batch with `git diff --staged` before committing.

## Safety gate (run before batch commits)

```bash
git status --short
git diff --name-only
git ls-files --others --exclude-standard
```

Expected: many unrelated changes may still exist; only stage the exact pathspecs in each batch below.

## Batch 1: docs structure + naming

```bash
git add \
  docs/README.md \
  docs/SCRIPTS.md \
  docs/archive/README.md \
  docs/archive/2026-03-review/ \
  docs/releases/ \
  docs/reports/README.md \
  docs/reports/current/ \
  docs/reports/history/
```

Suggested commit message:

`docs: reorganize report directories and normalize naming`

## Batch 2: moved baseline docs + reference link fixes

```bash
git add -A docs/archive/2026-02-reset docs/archive/2026-03-review docs/releases
git add README.md CHANGELOG.md laf-backend/DEPLOYMENT_GUIDE.md
```

Suggested commit message:

`docs: archive legacy baseline docs and fix references`

## Batch 3: source deduplication shims

```bash
git add -A \
  src/utils/learning/smart-question-picker.js \
  src/pages/practice-sub/do-quiz.vue \
  src/pages/practice-sub/quiz-analytics-recorder.js \
  src/pages/practice-sub/composables/learning-stats-mixin.js \
  src/pages/plan/intelligent-plan-manager.js \
  src/pages/favorite/index.vue \
  src/pages/mistake/MistakeCard.vue \
  src/pages/settings/PosterModal.vue \
  src/pages/favorite/utils/question-favorite.js \
  src/pages/practice-sub/utils/question-favorite.js \
  src/pages/plan/utils/learning-analytics.js \
  src/pages/practice-sub/utils/learning-analytics.js \
  src/pages/plan/utils/smart-question-picker.js \
  src/pages/practice-sub/utils/smart-question-picker.js \
  src/pages/settings/utils/permission-handler.js \
  src/pages/mistake/utils/adaptive-learning-engine.js \
  src/pages/plan/utils/adaptive-learning-engine.js \
  src/pages/practice-sub/utils/adaptive-learning-engine.js
```

Suggested commit message:

`refactor: deduplicate shared utility implementations`

## Batch 4: ignore runtime artifacts

```bash
git add .gitignore
```

Suggested commit message:

`chore: ignore generated qa runtime artifacts`
