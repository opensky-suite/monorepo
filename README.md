# OpenSky Suite

**Production-ready cloud SaaS alternative to Google Workspace**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](https://opensource.org/licenses/AGPL-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org/)

OpenSky Suite is a comprehensive, open-source alternative to Google Workspace (G Suite) with a coherent permissions model, LLM-friendly APIs, and deployment flexibility (local, AWS, on-premises, self-hosted).

## 🌟 Products

### Communication & Collaboration
- **SkyMail** - Gmail-inspired email with SMTP/IMAP support
- **SkyMeet** - WebRTC video conferencing with recording & transcription
- **SkyChat** - Slack-inspired team messaging

### Productivity
- **SkyDocs** - Real-time collaborative document editing (faster than Google Docs!)
- **SkySheets** - Powerful spreadsheets with Excel compatibility
- **SkySlides** - Presentation editor (inspired by Google Slides + Canva)
- **SkyKeep** - Fast, lightweight note-taking
- **SkyForms** - Advanced form builder with conditional logic
- **SkyCalendar** - Calendar and scheduling with SkyMeet integration

### Infrastructure & Development
- **SkyDrive** - File storage with versioning and sharing
- **SkySites** - Website builder with SEO and analytics
- **SkyScript** - Automation scripting with API access to all products
- **SkySheet** - No-code app builder with mobile generation
- **SkySearch** - Web search engine (PageRank + BigTable architecture)
- **SkyMind** - LLM integration layer (Claude, OpenAI, Gemini, Ollama, etc.)

### Core Services
- **SkyAuth** - SSO, OAuth, 2FA, API keys (everything Google Accounts has)
- **SkyAPI** - Comprehensive REST APIs for all products
- **SkyCLI** - Command-line interface for all products

## 🚀 Quick Start

```bash
# Clone the repository
git clone git@github.com:opensky-suite/monorepo.git
cd monorepo

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start local development environment (Docker)
docker-compose up -d

# Run development server
npm run dev
```

## 📋 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Agent documentation, architecture principles, development workflow
- **[AGENTS.md](AGENTS.md)** - Multi-agent coordination, communication protocols, issue management
- **[API Documentation](https://docs.opensky.dev)** - Auto-generated API docs (coming soon)

## 🏗️ Architecture

- **Monorepo Structure** - npm/pnpm workspaces for shared code
- **TypeScript** - Strict mode, comprehensive type coverage
- **Docker** - Local AWS simulation, production deployment
- **PostgreSQL** - Primary database with migration framework
- **Redis** - Caching, sessions, real-time features
- **Elasticsearch** - Full-text search across all products
- **MinIO** - S3-compatible object storage

## 🧪 Testing

- **Unit Tests** - 90%+ code coverage (Vitest - fast, modern)
- **Integration Tests** - API endpoints, database, services  
- **E2E Tests** - Critical user flows (Playwright)
- **Screenshot Tests** - Visual regression testing for every page

```bash
# Run all tests
npm test

# Run with coverage (90%+ required)
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 🔒 Security

- **No secrets in repo** - All credentials in `.secrets.txt` (git-ignored)
- **API key authentication** - Token-based auth for programmatic access
- **OAuth support** - Google, GitHub, and custom providers
- **SSO** - SAML 2.0 and OpenID Connect
- **2FA** - TOTP with backup codes
- **Security audits** - Automated vulnerability scanning

## 📦 Deployment

### Local Development
```bash
docker-compose up -d
npm run dev
```

### AWS Deployment
```bash
# Build Docker images
npm run build:docker

# Deploy to AWS (simulated locally)
npm run deploy:check
```

### Self-Hosted
See [deployment documentation](https://docs.opensky.dev/deployment) for detailed instructions.

## 🤝 Contributing

OpenSky Suite is developed by LLM agents coordinated via Slack. See [AGENTS.md](AGENTS.md) for agent roles and workflows.

### Agent Workflow
1. Pick issue from GitHub
2. Create feature branch
3. Implement with tests (90%+ coverage)
4. Create pull request (self-review)
5. Monitor CI checks (< 3 minutes)
6. Merge to `develop`

### For Humans
- Report bugs via GitHub Issues
- Request features via GitHub Issues
- Provide credentials when agents need them

## 📊 Project Status

- **Phase**: Initial setup and architecture
- **Issues Created**: 50+ (1,000 prioritized issues planned)
- **Labels**: 38 (agents, priorities, types, statuses)
- **Next Milestone**: MVP of core products (SkyAuth, SkyMail, SkyDrive, SkyDocs)

## 📄 License

GNU Affero General Public License v3.0 (AGPL-3.0)

This means:
- ✅ Free to use, modify, and distribute
- ✅ Network use is distribution (SaaS must share source)
- ✅ Must share improvements
- ✅ Strong copyleft

See [LICENSE](LICENSE) for full text.

## 🔗 Links

- **Website**: https://opensky.dev (coming soon)
- **Documentation**: https://docs.opensky.dev (coming soon)
- **GitHub**: https://github.com/opensky-suite
- **Issues**: https://github.com/opensky-suite/monorepo/issues

## 💡 Philosophy

- **Fail fast, fail hard** - No silent failures, clear error messages
- **Speed above all** - Faster than Google Workspace (especially SkyDocs!)
- **LLM-friendly** - Comprehensive APIs and CLI for AI integration
- **Production-ready** - 90%+ test coverage, comprehensive monitoring
- **Coherent permissions** - Simple, predictable, discoverable
- **Minimal human involvement** - LLM agents handle everything except credentials

---

**Built by AI agents, for humans and AI alike.** 🤖✨