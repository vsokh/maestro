# Versioning Strategy

**Date**: 2026-03-28
**Status**: Accepted

## Context

Projects managed by Dev Manager have no release process — no git tags, no changelog, no version tracking. The orchestrator and codehealth skills handle development and quality, but there's no way to mark stable points or communicate what changed between releases.

## Decision

### Git Flow: Trunk-Based with Release Tags

Keep linear master workflow. Layer versioning via annotated tags.

| Branch | Purpose | Lifetime |
|--------|---------|----------|
| master | Trunk. All merges land here. | Permanent |
| task-{id}-{slug} | Feature/fix work via orchestrator | Hours-days |
| release/{version} | Optional stabilization (only when gate fails + dev continues) | Days max |
| hotfix/{version}-{desc} | Urgent fix against tagged release | Hours |

Most releases = tag directly on master. No develop branch.

### Semver (Pre-1.0)

| Bump | When |
|------|------|
| Minor 0.x.0 | New user-facing features, architectural milestones |
| Patch 0.x.y | Bug fixes, quality improvements, refactoring, tests |

Breaking changes noted in changelog but don't trigger major bump until 1.0.

### Conventional Commits

Format: `type(scope): description`

| Type | Maps to | Changelog section |
|------|---------|------------------|
| feat | New features | Added |
| fix | Bug fixes | Fixed |
| refactor | Restructuring | Changed |
| test | Test additions | Infrastructure |
| style | CSS/design | Changed |
| perf | Performance | Changed |
| a11y | Accessibility | Accessibility |
| security | Security hardening | Security |
| docs | Documentation | Infrastructure |
| chore | Config, deps | Infrastructure |

Legacy commits classified retroactively via `/release retroactive` (no history rewrite).

### Stability Assessment

Deterministic score (0-100) from 6 weighted signals:

```
STABILITY = buildTest*0.30 + codehealth*0.20 + fixRatio*0.20
          + backlog*0.15 + regression*0.10 + fixDecay*0.05
```

| Component (weight) | Scoring |
|--------------------|---------|
| Build/Test (30%) | Build pass=50pts + (passing/total x 50) - (lintErrors x 5) |
| Codehealth (20%) | overallScore / 10 x 100 |
| Fix Ratio (20%) | Last 20 commits: <=20% fixes=100, <=40%=80, <=60%=50, >60%=20 |
| Backlog (15%) | max(0, 100 - high*20 - medium*5) |
| Regressions (10%) | 0=100, 1=60, 2=30, 3+=0 |
| Fix Decay (5%) | Commits since last fix: 0=20, 1-3=50, 4-9=80, 10+=100 |

Levels: 85-100 Stable, 70-84 Release Candidate, 50-69 Stabilizing, 0-49 Active Development.

### Release Gates

| Gate | Pass | Warn | Fail |
|------|------|------|------|
| Build | exits 0 | — | Non-zero |
| Tests | All pass | — | Any failing |
| Codehealth | >=7.0 (minor) / >=6.0 (patch) | Score dropped | <6.0 |
| Regressions | 0 | 1-2 low-severity | Any high-severity |
| Backlog | 0 high items | 1 high | 2+ high |
| Lint | 0 errors | 1-3 | 4+ |

Any Fail = blocked (unless --force). Warn = allowed with warnings.

### 1.0 Criteria

Version 1.0 when:
- Core user flows reliable and tested
- Codehealth score >= 8.0
- Zero high-severity backlog items
- Real users actively using the product
- No known data-loss scenarios

## Implementation

The `/release` skill (deployed from `src/release.ts`) provides 5 commands:
- `/release status` — stability score + next release preview
- `/release changelog` — preview changelog since last tag
- `/release cut [major|minor|patch]` — full release flow with gates
- `/release retroactive` — one-time legacy classification + milestone tags
- `/release gate` — check all gates without cutting

## Integration

- **Orchestrator**: sub-agent prompts include conventional commit instructions; post-merge hints suggest `/release status` when all group tasks complete
- **Codehealth**: stability score and gates read from `.maestro/quality/` files
- **Dev Manager**: `/release cut` writes activity signal to `.maestro/progress/release.json`
