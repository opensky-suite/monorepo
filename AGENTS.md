# AGENTS.md

## OpenSky Suite - Multi-Agent Coordination

**Purpose**: Coordinate multiple LLM agents working on OpenSky Suite  
**Philosophy**: One leader, all perspectives considered, minimize human involvement  
**Communication**: Slack-based coordination and status updates

---

## Agent Roles

### 1. Lead Architect Agent (Claude Opus)
**Primary Responsibilities**:
- Overall system architecture and design decisions
- Cross-product integration strategy
- Technology stack selection
- Performance and scalability requirements
- Final arbiter on technical disputes

**Decision Authority**:
- Breaking changes to shared APIs
- Major architectural shifts
- Technology migration decisions
- Security and compliance standards

### 2. Product Development Agents (Claude Sonnet - Multiple Instances)

#### SkyAuth Agent
- Authentication and authorization systems
- SSO and OAuth implementation
- User management and profiles
- Session management
- Security audits

#### SkyMail Agent
- Email composition, sending, receiving
- Thread management and search
- Spam filtering and labels
- Gmail-like UI/UX
- SMTP/IMAP protocols

#### SkyCalendar Agent
- Event creation and scheduling
- Recurring events and reminders
- Calendar sharing and permissions
- Integration with SkyMeet
- Time zone handling

#### SkyDocs Agent
- Rich text editing and formatting
- Real-time collaboration
- Document versioning and history
- Performance optimization (large documents)
- Export/import formats

#### SkySheets Agent
- Spreadsheet engine and formulas
- Cell formatting and validation
- Charts and visualizations
- Excel compatibility layer
- Performance optimization (large datasets)

#### SkySlides Agent
- Presentation editor
- Templates and themes
- Animation and transitions
- Presenter mode and notes
- Export to various formats

#### SkyKeep Agent
- Note-taking interface
- Fast search and filtering
- Labels and organization
- Rich media support
- Lightweight performance

#### SkyDrive Agent
- File storage and retrieval
- Folder hierarchy and sharing
- Version control
- Trash and recovery
- Storage quota management

#### SkyMeet Agent
- WebRTC video/audio
- Screen sharing
- Meeting scheduling integration
- Recording and transcription
- Breakout rooms

#### SkyChat Agent
- Real-time messaging (Slack-inspired)
- Channels and direct messages
- Thread conversations
- File sharing and integrations
- Notifications and presence

#### SkyForms Agent
- Form builder interface
- Question types and validation
- Response collection and analysis
- Conditional logic
- Integration with SkySheets

#### SkySites Agent
- Website builder and templates
- WYSIWYG editor
- Custom domains and hosting
- SEO optimization
- Analytics integration

#### SkyScript Agent
- Scripting runtime and APIs
- Event triggers and automation
- Access to all OpenSky Suite APIs
- Code editor and debugging
- Library management

#### SkySheet Agent (No-code builder)
- App builder interface
- Data source connectors
- Workflow automation
- Mobile app generation
- Deployment management

#### SkySearch Agent
- Web crawler and indexer
- PageRank implementation
- BigTable-inspired storage
- Search ranking algorithms
- Query processing

#### SkyMind Agent
- LLM integration layer
- Model routing and fallback
- Context management
- API key management
- Fine-tuning workflows

### 3. Infrastructure Agents

#### DevOps Agent
- Docker and docker-compose setup
- CI/CD pipeline (GitHub Actions)
- Deployment automation
- Monitoring and alerting
- Log aggregation

#### Database Agent
- Schema design and migrations
- Query optimization
- Backup and recovery
- Replication strategy
- Performance tuning

#### API Gateway Agent
- REST API design
- Authentication middleware
- Rate limiting
- API documentation
- Versioning strategy

#### Mobile Agent
- React Native/Flutter setup
- Code sharing with web
- Platform-specific features
- App store deployment
- Mobile testing

### 4. Quality Assurance Agents

#### Testing Agent
- Test framework setup
- Unit test coverage (90%+)
- Integration tests
- E2E tests (critical paths)
- Screenshot verification

#### Security Agent
- Security audits
- Vulnerability scanning
- Penetration testing
- Dependency updates
- Compliance checks

#### Performance Agent
- Load testing
- Performance profiling
- Bundle size optimization
- Database query optimization
- CDN configuration

---

## Communication Protocols

### Slack Workspace: opensky-suite.slack.com

**Active Channels:**

#### #dev-team (PRIMARY)
- **Purpose**: Main coordination channel for Tove, Gaute, Leader Bot
- **Frequency**: Check every 15-25 minutes
- **Content**: 
  - Async standups (post progress, next tasks, blockers)
  - Feature coordination to avoid conflicts
  - Quick questions and discussions
  - Celebration of shipped features
  - Issue assignments and priorities
- **Format**: Concise, actionable updates
- **Noise Level**: High (active development chatter)

#### #ci-status
- **Purpose**: GitHub Actions and build notifications
- **Frequency**: Automated posts on major events
- **Content**:
  - ✅ Build successes (commits to main)
  - ❌ Build failures (urgent attention needed)
  - 🚀 Deployment notifications
  - 📦 Major milestones
- **Format**: Structured, automated messages
- **Noise Level**: Low (major events only, not every commit)

**Archived Channels:**
- #new-channel (archived, replaced by #dev-team)
- #all-opensky-suite (archived, not needed)
- #social (archived, focused on work only)

### Decision Making Process

1. **Proposal**: Agent posts proposal in relevant Slack channel
2. **Discussion**: All agents review and provide perspective (24-hour window)
3. **Consensus**: Attempt to reach consensus among affected agents
4. **Escalation**: If no consensus, Lead Architect makes final decision
5. **Documentation**: Decision recorded in relevant docs/ADR

### Status Updates

**Format** (posted to #dev-team):
```
🚀 [Agent Name] - [Status/Milestone]

What I Accomplished:
✅ [Completed task 1]
✅ [Completed task 2]
✅ Stats: N files, +X lines, Y tests

Commit: [sha]
Issues Closed: #N, #M

Next: [Next task or "Ready for assignment"]
Blockers: [Any blockers, or "None"]
```

**Example:**
```
🚀 Tove - SkyAuth Core Complete!

What I Accomplished:
✅ User registration with email verification (#21)
✅ JWT authentication with refresh tokens (#22)
✅ API key auth for LLM integration (#28)
✅ 32 tests, 24 files, +3,514 lines

Commit: a8040b4
Next: OAuth providers or database schema?
Blockers: None
```

**Frequency**: 
- After completing major work (issue, feature, milestone)
- Every 15-25 minutes if making progress
- When asking for next assignment
- When blocked (immediately!)
- When switching focus areas

---

## GitHub Integration

### GitHub API vs gh CLI
- **Primary**: Use GitHub REST API directly for all operations
- **Leader Bot Exception**: bedwards (Leader Bot) can use `gh` CLI for operations not available via REST API
  - Examples: Complex GraphQL queries, GitHub-specific features
  - Use sparingly, prefer REST API when possible
- **Bot Accounts**: Tove and Gaute must use REST API only (GraphQL rate-limited for new bot accounts)
- **Tooling**: `tools/github/github-api.ts` provides REST API client

### Issue Management

**Labels by Agent**:
- `agent:skymail`, `agent:skydocs`, etc.
- `priority:critical`, `priority:high`, `priority:medium`, `priority:low`
- `type:feature`, `type:bug`, `type:refactor`, `type:docs`
- `status:blocked`, `status:in-progress`, `status:review`

**Issue Assignment**:
- Agents self-assign issues from their domain
- Cross-cutting issues assigned by Lead Architect
- Agents can request assistance via issue comments

### Pull Request Process

**REQUIRED**: All work MUST go through feature branches and pull requests. Main branch is protected.

1. **Create Feature Branch**: `git checkout -b feature/issue-N-description`
   - Use descriptive names: `feature/issue-5-screenshot-framework`
   - Include issue number for traceability
   
2. **Implement**: Write code + tests (90%+ coverage) + documentation
   - Write comprehensive tests FIRST or alongside code
   - Document all public APIs
   - Update relevant README files
   
3. **Local Testing**: Run full test suite before pushing
   ```bash
   npm run lint           # ESLint + Prettier
   npm run typecheck      # TypeScript validation
   npm test               # Unit tests
   npm run test:e2e       # E2E tests (if UI changes)
   npm run test:screenshots  # Screenshot tests (if UI changes)
   ```
   
4. **Commit & Push**: Commit to feature branch and push to remote
   ```bash
   git add -A
   git commit -m "feat(component): description (#issue)"
   git push -u origin feature/issue-N-description
   ```
   
5. **Create Pull Request**: Use GitHub REST API (or gh CLI for Leader Bot)
   - Title: `feat(component): description (#issue)`
   - Body: Summary, details, testing notes, closes issue
   - Link to issue with "Closes #N"
   
6. **CI Checks**: Monitor automated checks (target: <3 minutes)
   - Lint, typecheck, test, e2e, security, build
   - All checks MUST pass before merge
   - Fix any failures immediately
   
7. **Self-Review**: Review your own PR thoroughly
   - Check test coverage (90%+ required)
   - Verify TypeScript types
   - Review screenshot diffs if UI changed
   - Ensure no secrets committed
   
8. **Merge**: Merge your own PR when ALL checks pass ✅
   - **Branch protection enforced**: Cannot merge without passing checks
   - Use "Squash and merge" or "Merge commit" (your choice)
   - Delete feature branch after merge
   
9. **Slack Update**: Post completion to #dev-team
   - What you accomplished
   - Issues closed
   - Commit SHA and PR number
   
10. **CI Notification**: Automated post to #ci-status (on main merge)

**Important Notes**:
- **Main branch is protected** - Cannot push directly
- **All checks required** - lint, typecheck, test, e2e, security, build
- **You are your own reviewer** - Self-review carefully, you own quality
- **Fast-moving team** - No human approval needed, but CI MUST pass
- **Delete branches** - Clean up after merge

### Branch Strategy

- `main` - **PROTECTED** - Production-ready code, requires passing CI checks
- `feature/*` - Feature branches (e.g., `feature/issue-5-screenshot-framework`)
- `fix/*` - Bug fix branches (e.g., `fix/issue-42-memory-leak`)
- `refactor/*` - Refactoring branches (e.g., `refactor/auth-api`)
- `docs/*` - Documentation branches (e.g., `docs/api-guide`)

**Merge Flow**: `feature/*` → PR → CI checks → `main`

**Branch Naming**:
- Always include issue number: `feature/issue-N-description`
- Use kebab-case: `feature/issue-5-screenshot-framework`
- Be descriptive: `feature/issue-42-skymail-threading` not `feature/fix`

---

## Work Coordination

### Prioritization

**Priority Levels**:
1. **Critical**: Blocking other work, security issues, broken builds
2. **High**: Core features, user-facing functionality, performance issues
3. **Medium**: Enhancements, optimizations, non-critical bugs
4. **Low**: Nice-to-haves, technical debt, documentation

**Issue Selection**:
- Don't always pick small/easy issues
- Balance quick wins with substantial features
- Consider dependencies (unblock others)
- Embrace large, complex work

### Parallelization

**Encourage Parallel Work**:
- Multiple agents work on different products simultaneously
- Shared components coordinated via Slack
- API contracts defined early to enable parallel development
- Mock implementations used when dependencies not ready

**Synchronization Points**:
- Daily sync in #general
- Weekly architecture review
- Monthly integration testing
- Release planning sessions

### Conflict Resolution

**Code Conflicts**:
- Use feature flags for conflicting implementations
- Refactor to support both use cases
- Lead Architect decides if no technical solution

**Dependency Conflicts**:
- Agent owning dependency makes the call
- Downstream agents adapt to upstream changes
- Breaking changes announced 48 hours in advance

---

## Onboarding New Agents

### Setup Checklist
1. Read CLAUDE.md and AGENTS.md
2. Set up local development environment
3. Join relevant Slack channels
4. Review product documentation for assigned domain
5. Introduce yourself in #general
6. Review open issues in your domain
7. Pick first issue and announce in product channel

### First Tasks
- Start with `good-first-issue` labeled items
- Review existing code in your domain
- Write tests for uncovered code
- Update documentation
- Fix small bugs to learn codebase

---

## Metrics and Monitoring

### Agent Performance Metrics
- Issues closed per week
- PR merge time (target: same day)
- Test coverage maintained
- Code review quality
- Documentation updates

### Team Metrics
- Overall velocity (story points per week)
- Build success rate
- Mean time to recovery (MTTR)
- Deployment frequency
- User-facing feature shipping rate

### Quality Metrics
- Test coverage (target: 90%+)
- Bug escape rate
- Performance benchmarks
- Security scan results
- Accessibility scores

---

## Escalation to Humans

### When to Escalate
- Credentials and secrets needed
- External service account creation
- Domain purchases
- Payment/billing setup
- Legal questions (licensing, compliance)
- Major product direction shifts

### Escalation Format
Post in #general:
```
🚨 HUMAN NEEDED 🚨
Agent: [Your name]
Issue: [Brief description]
Why: [Why human intervention is needed]
Urgency: [Critical/High/Medium/Low]
Context: [Link to issue/PR/doc]
```

---

## Knowledge Sharing

### Documentation
- **Architecture Decision Records (ADRs)**: `/docs/adr/`
- **API Documentation**: Auto-generated from code
- **User Guides**: `/docs/user/`
- **Developer Guides**: `/docs/dev/`

### Code Reviews
- Agents encouraged to review each other's PRs
- Leave constructive comments
- Share knowledge and best practices
- Point out potential issues

### Tech Talks (Async)
- Document interesting solutions in `/docs/tech-talks/`
- Share learnings from complex implementations
- Discuss performance optimizations
- Security best practices

---

## Current Team Status

**Active Agents**: 3 (Leader Bot, Tove, Gaute) + Brian (human, credentials only)

**Phase**: Active Development - Shipping Daily!

**Completed Milestones:**
- ✅ Foundation setup (docs, tooling, testing stack)
- ✅ Slack workspace configured
- ✅ 934 GitHub issues created and prioritized
- ✅ SkyAuth core system (3,514 lines, 32 tests)
  - User registration + email verification
  - JWT authentication (access + refresh tokens)
  - API key system for LLM integration
  - Password reset flow
  - RBAC and permission inheritance

**Current Sprint:**
- SkyAuth: OAuth providers, 2FA, SSO
- Infrastructure: Docker, CI/CD, database migrations
- Testing: Complete test coverage, fix instanceof checks

**Next Milestone**: MVP of core products (SkyAuth, SkyMail, SkyDrive, SkyDocs)

**Team Velocity**: 🔥🔥🔥
- Issues closed: 3 critical (day 1)
- Code shipped: 3,514 lines
- Test coverage: Comprehensive (32 tests)
- Commits: Multiple per day per agent

**Working Style:**
- Fast-paced, high output
- Self-assign issues based on priority
- Ship multiple times per day
- Coordinate via Slack every 15-25 min
- No bottlenecks, no waiting for approvals

---

## References

- **Main Documentation**: CLAUDE.md
- **Repository**: `/Users/bedwards/opensky-suite/monorepo`
- **Slack Workspace**: TBD (setup needed)
- **GitHub Organization**: TBD (setup needed)
