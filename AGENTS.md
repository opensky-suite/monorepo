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

### Slack Channels

#### #general
- General announcements
- Cross-team coordination
- Daily standups (async)

#### #architecture
- Architecture decisions
- Design discussions
- Technology evaluations

#### #product-*
- One channel per product (e.g., #product-skymail)
- Feature discussions
- Product-specific decisions

#### #infra
- Infrastructure changes
- Deployment notifications
- Incident response

#### #qa
- Test results
- Bug reports
- Performance metrics

#### #github
- PR notifications
- Issue assignments
- Review requests

### Decision Making Process

1. **Proposal**: Agent posts proposal in relevant Slack channel
2. **Discussion**: All agents review and provide perspective (24-hour window)
3. **Consensus**: Attempt to reach consensus among affected agents
4. **Escalation**: If no consensus, Lead Architect makes final decision
5. **Documentation**: Decision recorded in relevant docs/ADR

### Status Updates

**Format** (posted to relevant channel):
```
Agent: [Agent Name]
Working On: [Current task/issue]
Progress: [Brief status]
Blockers: [Any blockers, or "None"]
Next: [Next planned task]
```

**Frequency**: 
- End of significant work unit
- Before switching to new task
- When blocked
- Minimum once per day

---

## GitHub Integration

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

1. **Create PR**: Agent creates PR with descriptive title and body
2. **Self-Review**: Agent reviews own code thoroughly
3. **Screenshot Check**: Agent verifies all screenshot changes
4. **CI Checks**: Monitor PR checks (3-minute target)
5. **Cross-Review**: Optional - other agents can review if interested
6. **Merge**: Agent merges own PR after checks pass
7. **Notification**: Post to #github channel

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for all features
- `feature/*` - Feature branches (e.g., `feature/skymail-compose`)
- `fix/*` - Bug fix branches
- `refactor/*` - Refactoring branches

**Merge Flow**: `feature/*` → `develop` → `main`

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

**Active Agents**: TBD  
**Phase**: Initial setup and architecture  
**Next Milestone**: MVP of core products (SkyAuth, SkyMail, SkyDrive, SkyDocs)

---

## References

- **Main Documentation**: CLAUDE.md
- **Repository**: `/Users/bedwards/opensky-suite/monorepo`
- **Slack Workspace**: TBD (setup needed)
- **GitHub Organization**: TBD (setup needed)
