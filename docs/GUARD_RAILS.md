# Guard Rails - Comprehensive Code Quality Automation

## Overview

OpenSky Suite uses **extensive automated guard rails** at every stage to ensure code quality, security, and maintainability. All checks are automated and run in parallel for speed.

**Philosophy**: Catch issues as early as possible, fail fast, provide clear feedback.

---

## 🎯 Guard Rail Stages

### 1. Pre-commit (Local, <5 seconds)
**When**: Before each `git commit`  
**Goal**: Catch obvious issues immediately  
**Speed**: MUST complete in <5 seconds

#### Checks:
- ✅ **Lint staged files** (ESLint + Prettier via lint-staged)
- ✅ **Secret detection** (regex patterns for API keys, tokens, passwords)
- ✅ **Large file detection** (>1MB blocked)
- ✅ **Merge conflict markers** (<<<<<<, =======, >>>>>>>)
- ✅ **Debugger statements** (warning only)
- ✅ **JSON validation** (syntax check)
- ✅ **Quick TypeScript check** (first 5 changed files)

**Bypass**: `git commit --no-verify` (NOT RECOMMENDED)

---

### 2. Commit Message Validation (Local, <1 second)
**When**: Before each `git commit`  
**Goal**: Enforce conventional commits

#### Requirements:
- ✅ **Format**: `type(scope): description`
- ✅ **Types**: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- ✅ **Minimum length**: 10 characters
- ⚠️  **Issue reference**: #123 (warning if missing)

**Examples**:
```
✅ feat(auth): add OAuth2 provider support (#42)
✅ fix(skymail): resolve thread sorting bug (#123)
✅ docs(readme): update installation instructions
❌ Updated stuff
❌ fix bug
```

---

### 3. Pre-push (Local, ~30 seconds)
**When**: Before `git push`  
**Goal**: Thorough local validation before sharing

#### Checks:
- ✅ **Run tests** on changed files
- ✅ **TypeScript type check** (full)
- ✅ **Linting** (full)
- ✅ **Prevent direct push to main** (BLOCKED)
- ✅ **Branch name validation** (warning)
- ⚠️  **Untracked files** (warning)

**Bypass**: `git push --no-verify` (NOT RECOMMENDED)

---

### 4. Pull Request Checks (GitHub, <3 minutes)
**When**: PR opened/updated  
**Goal**: Automated quality gates before merge  
**Speed**: Target <3 minutes total (parallel execution)

#### Required Checks (6 parallel jobs):
1. **Lint** - ESLint + Prettier formatting (3 min timeout)
2. **Type Check** - TypeScript validation (3 min timeout)
3. **Unit Tests** - Vitest with 90%+ coverage (5 min timeout)
4. **E2E Tests** - Playwright critical paths (5 min timeout)
5. **Security** - npm audit + TruffleHog (3 min timeout)
6. **Build** - Build verification (5 min timeout)

#### Optional/Async Checks:
- **CodeQL** - Security code analysis
- **Dependency Review** - Vulnerability + license check
- **Snyk** - Third-party security scanning
- **Codecov** - Coverage reporting and trends
- **OpenSSF Scorecard** - Security best practices
- **License Check** - License compliance
- **Screenshot Tests** - Visual regression (when UI changes)

**Result**: ALL required checks MUST pass before merge is allowed (branch protection)

---

### 5. Post-Merge (GitHub, ongoing)
**When**: Code merged to main  
**Goal**: Continuous monitoring and maintenance

#### Scheduled Checks:
- **CodeQL** - Weekly security analysis (Monday 00:00 UTC)
- **Snyk** - Weekly vulnerability scan (Monday 00:00 UTC)
- **OpenSSF Scorecard** - Weekly security score (Monday 00:00 UTC)
- **Renovate** - Weekly dependency updates (Monday <4am UTC)

#### Alerts:
- Slack notifications to #ci-status
- GitHub Security Advisories
- Codecov coverage trends

---

## 📋 Coverage Requirements

### Minimum Coverage: 90%
- **Lines**: 90%
- **Statements**: 90%
- **Functions**: 90%
- **Branches**: 90%

### Enforcement:
- Pre-push hook checks coverage
- PR check fails if <90%
- Codecov comments on PRs with coverage report
- Coverage trends tracked over time

---

## 🔒 Security Scanning

### Multiple Layers:
1. **Pre-commit**: Regex-based secret detection (immediate)
2. **TruffleHog**: Verified secrets only (PR check)
3. **CodeQL**: Static analysis (PR + weekly)
4. **Snyk**: Dependency vulnerabilities (PR + weekly)
5. **Dependency Review**: GitHub native scanning (PR)
6. **npm audit**: Built-in vulnerability check (PR)

### Severity Thresholds:
- **Critical/High**: Blocks merge, immediate Slack alert
- **Medium**: Warning, manual review
- **Low**: Informational only

---

## 📦 Dependency Management

### Automated Updates (Renovate):
- **Schedule**: Weekly on Monday <4am UTC
- **Strategy**: Grouped by type (testing, TypeScript, ESLint)
- **Auto-merge**: Patch/minor updates only (non-breaking)
- **Security**: Immediate PRs for vulnerabilities

### License Compliance:
- **Allowed**: MIT, Apache-2.0, BSD-*, ISC, AGPL-3.0
- **Blocked**: GPL-2.0, GPL-3.0, proprietary
- **Check**: Automatic on package.json changes

---

## 🚀 Performance Targets

### Local Checks:
- Pre-commit: <5 seconds
- Commit-msg: <1 second
- Pre-push: <30 seconds

### CI Checks:
- Total PR checks: <3 minutes
- Individual job timeouts: 3-5 minutes
- Parallel execution: 6 jobs simultaneously

### Optimization:
- Cache dependencies (npm cache)
- Only lint/test changed files (where possible)
- Fail fast (stop on first error)
- Staged files only (pre-commit)

---

## 🛠️ Setup Instructions

### 1. Install Husky Hooks
```bash
npm install
npx husky install
```

Hooks are automatically configured in `.husky/`:
- `pre-commit` - Fast quality checks
- `commit-msg` - Message validation
- `pre-push` - Thorough validation

### 2. Configure Git
```bash
git config core.hooksPath .husky
```

### 3. Test Hooks
```bash
# Test pre-commit
git add .
git commit -m "test: verify hooks"

# Test pre-push
git push
```

### 4. Configure Secrets (if needed)

For free services, add tokens to GitHub repository secrets:
- `CODECOV_TOKEN` - Get from https://codecov.io
- `SNYK_TOKEN` - Get from https://snyk.io
- `SLACK_BOT_TOKEN` - Already configured

All services are **free for open source projects**.

---

## 🎓 Best Practices

### 1. Commit Often
Small, focused commits pass checks faster and are easier to review.

### 2. Run Checks Locally
```bash
npm run lint           # ESLint
npm run typecheck      # TypeScript
npm test               # Unit tests
npm run test:e2e       # E2E tests
npm run test:coverage  # Coverage report
```

### 3. Don't Bypass Hooks
`--no-verify` should be used ONLY in emergencies. It bypasses critical safety checks.

### 4. Fix Issues Immediately
Don't accumulate technical debt. Fix failing checks before moving on.

### 5. Monitor Coverage
Keep coverage at 90%+. Codecov will comment on PRs with coverage trends.

---

## 🚨 Troubleshooting

### Hook Fails with "Permission Denied"
```bash
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
```

### Pre-commit Takes Too Long (>5 seconds)
Check for large staged files or too many changed files. Consider multiple smaller commits.

### TypeScript Errors on Pre-push
```bash
npm run typecheck
# Fix errors, then push again
```

### Coverage Below 90%
```bash
npm run test:coverage
# Check coverage report, add missing tests
```

### Secret Detected (False Positive)
If it's not a real secret, use a different variable name or add to `.gitignore`.

### Merge Blocked by CI
Check GitHub Actions logs. All required checks must pass. Common issues:
- Failing tests
- Type errors
- Coverage below 90%
- Security vulnerabilities

---

## 📊 Monitoring

### Slack Notifications (#ci-status)
- ✅ Build success (main branch)
- ❌ Build failure (main branch)
- 🔒 Security alerts (any branch)
- 📦 Dependency updates (Renovate PRs)

### GitHub Security Tab
- CodeQL alerts
- Dependabot alerts
- Snyk vulnerabilities
- Secret scanning alerts

### Codecov Dashboard
- Coverage trends: https://codecov.io/gh/opensky-suite/monorepo
- PR coverage diffs
- File-level coverage

---

## 🎯 Summary

**Total Guard Rails: 20+ automated checks**

| Stage | Checks | Speed | Required |
|-------|--------|-------|----------|
| Pre-commit | 7 | <5s | ✅ |
| Commit-msg | 3 | <1s | ✅ |
| Pre-push | 6 | ~30s | ✅ |
| PR (required) | 6 | <3m | ✅ |
| PR (optional) | 6 | <10m | ⚠️ |
| Scheduled | 4 | Weekly | ℹ️ |

**Philosophy**: Maximum automation, minimal friction, fast feedback.

**Result**: High quality code, secure codebase, happy developers! 🎉
