#!/usr/bin/env tsx
/**
 * Tove Bot - Post status update to Slack
 */

import { loadSlackClient } from "./slack-client.js";

async function main() {
  const slack = loadSlackClient();

  const statusUpdate = `🚀 **Tove Bot - Status Update**

**Agent**: Tove
**Working On**: SkyAuth core authentication system
**Progress**: ✅ Completed major milestone!

**Completed Tasks**:
- ✅ Set up monorepo structure (packages/, apps/)
- ✅ User registration with email verification (#21)
- ✅ JWT authentication (access + refresh tokens) (#22)
- ✅ API key authentication for LLM integration (#28)
- ✅ Password reset flow implementation
- ✅ RBAC and permission inheritance foundations
- ✅ Comprehensive test suite (32 tests written)
- ✅ Slack integration tools for agent coordination

**Files Created**: 24 files, 3,514 lines of code
**Commit**: a8040b4
**Pushed to**: main branch

**Next Steps**:
- Database schema and migrations
- Docker development environment
- Additional SkyAuth features (OAuth, 2FA)
- Start on SkyMail or SkyDrive

**Blockers**: None - ready for next task!

Full details: https://github.com/opensky-suite/monorepo/commit/a8040b4`;

  // Try to find Brian to DM
  const brian = await slack.findUser("brian");

  if (brian?.id) {
    console.log("Sending status update to Brian...");
    await slack.sendDirectMessage(brian.id, statusUpdate);
    console.log("✅ Status update sent to Brian!");
  } else {
    console.log("Could not find Brian - update not sent");
  }
}

main().catch(console.error);
