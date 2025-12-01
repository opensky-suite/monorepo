#!/usr/bin/env tsx
/**
 * Single entry point for GitHub issue management
 * 
 * Usage:
 *   npm run issues create [--start N] [--count N] [--batch-size N] [--delay MS]
 *   npm run issues list [--state open|closed|all] [--labels label1,label2]
 *   npm run issues stats
 * 
 * Examples:
 *   npm run issues create                    # Create all remaining issues (up to 1000 total)
 *   npm run issues create --start 241       # Start from issue 241
 *   npm run issues create --count 100       # Create only 100 issues
 *   npm run issues list --state open        # List all open issues
 *   npm run issues stats                    # Show issue statistics
 */

import { GitHubAPI } from './github-api.js';
import * as fs from 'fs';
import * as path from 'path';

// Load secrets
const secretsPath = path.join(process.cwd(), '.secrets.txt');
let githubToken = '';
let githubOwner = '';
let githubRepo = '';

if (fs.existsSync(secretsPath)) {
  const secrets = fs.readFileSync(secretsPath, 'utf-8');
  const tokenMatch = secrets.match(/GITHUB_TOKEN=(.+)/);
  const ownerMatch = secrets.match(/GITHUB_ORG=(.+)/);
  const repoMatch = secrets.match(/GITHUB_REPO=(.+)/);
  
  if (tokenMatch) githubToken = tokenMatch[1].trim();
  if (ownerMatch) githubOwner = ownerMatch[1].trim();
  if (repoMatch) githubRepo = repoMatch[1].trim();
}

if (!githubToken || !githubOwner || !githubRepo) {
  console.error('❌ Missing GitHub credentials in .secrets.txt');
  process.exit(1);
}

const github = new GitHubAPI({ token: githubToken, owner: githubOwner, repo: githubRepo });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Parse command-line arguments
const args = process.argv.slice(2);
const command = args[0] || 'create';

const getArg = (name: string, defaultValue?: string): string | undefined => {
  const index = args.findIndex(arg => arg === `--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

const getNumArg = (name: string, defaultValue: number): number => {
  const val = getArg(name);
  return val ? parseInt(val, 10) : defaultValue;
};

// Command: List issues
async function listIssues() {
  const state = getArg('state', 'open') as 'open' | 'closed' | 'all';
  const labelsArg = getArg('labels');
  
  console.log(`\n📋 Listing ${state} issues...`);
  
  const issues = await github.listIssues({
    state,
    labels: labelsArg,
    per_page: 100,
  });
  
  issues.forEach(issue => {
    const labels = issue.labels.map(l => l.name).join(', ');
    console.log(`#${issue.number}: ${issue.title} [${labels}]`);
  });
  
  console.log(`\nTotal: ${issues.length} issues\n`);
}

// Command: Show statistics
async function showStats() {
  console.log('\n📊 Issue Statistics\n');
  
  const allIssues = await github.listIssues({ state: 'all', per_page: 100 });
  
  let page = 2;
  let moreIssues = [];
  do {
    moreIssues = await github.listIssues({ state: 'all', per_page: 100, page });
    allIssues.push(...moreIssues);
    page++;
  } while (moreIssues.length === 100 && page < 15);
  
  console.log(`Total Issues: ${allIssues.length}`);
  console.log(`Open: ${allIssues.filter(i => i.state === 'open').length}`);
  console.log(`Closed: ${allIssues.filter(i => i.state === 'closed').length}`);
  
  // Count by agent
  const byAgent: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  
  allIssues.forEach(issue => {
    issue.labels.forEach(label => {
      if (label.name.startsWith('agent:')) {
        byAgent[label.name] = (byAgent[label.name] || 0) + 1;
      }
      if (label.name.startsWith('priority:')) {
        byPriority[label.name] = (byPriority[label.name] || 0) + 1;
      }
    });
  });
  
  console.log('\nBy Agent:');
  Object.entries(byAgent)
    .sort((a, b) => b[1] - a[1])
    .forEach(([agent, count]) => console.log(`  ${agent}: ${count}`));
  
  console.log('\nBy Priority:');
  Object.entries(byPriority)
    .sort((a, b) => b[1] - a[1])
    .forEach(([priority, count]) => console.log(`  ${priority}: ${count}`));
  
  console.log(`\nRemaining to create: ${Math.max(0, 1000 - allIssues.length)}\n`);
}

// Command: Create issues
async function createIssues() {
  const TARGET_TOTAL = 1000;
  
  // Get current count
  console.log('Checking current issue count...');
  const existing = await github.listIssues({ state: 'all', per_page: 1 });
  const currentCount = existing.length > 0 ? existing[0].number : 0;
  
  console.log(`Current issues: ${currentCount}`);
  const remaining = TARGET_TOTAL - currentCount;
  
  if (remaining <= 0) {
    console.log('✅ Already have 1,000 issues!');
    return;
  }
  
  console.log(`Creating ${remaining} more issues to reach 1,000 total\n`);
  
  const startFrom = getNumArg('start', currentCount + 1);
  const count = getNumArg('count', remaining);
  const batchSize = getNumArg('batch-size', 15);
  const delay = getNumArg('delay', 2000);
  const batchDelay = delay * 5;
  
  const issues = generateIssues(startFrom, count);
  
  console.log(`\n🚀 Creating ${issues.length} issues in batches of ${batchSize}`);
  console.log(`   Delay: ${delay}ms between issues, ${batchDelay}ms between batches\n`);
  
  let created = 0;
  let failed = 0;
  
  for (let i = 0; i < issues.length; i += batchSize) {
    const batch = issues.slice(i, Math.min(i + batchSize, issues.length));
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(issues.length / batchSize);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${i + startFrom}-${i + startFrom + batch.length - 1})`);
    
    for (const issue of batch) {
      try {
        await github.createIssue(issue);
        created++;
        process.stdout.write('.');
        await sleep(delay);
      } catch (error: any) {
        if (error.message.includes('403') || error.message.includes('rate limit')) {
          console.log(`\n⏸️  Rate limit - waiting 2 min...`);
          await sleep(120000);
          try {
            await github.createIssue(issue);
            created++;
            process.stdout.write('.');
          } catch {
            failed++;
            process.stdout.write('✗');
          }
        } else {
          failed++;
          process.stdout.write('✗');
        }
      }
    }
    
    console.log(` ✓ ${created}/${issues.length}`);
    
    if (i + batchSize < issues.length) {
      await sleep(batchDelay);
    }
  }
  
  console.log(`\n✅ Complete: ${created} created, ${failed} failed\n`);
}

// Generate issues based on start and count
function generateIssues(start: number, count: number): Array<{ title: string; body: string; labels: string[] }> {
  const issues: Array<{ title: string; body: string; labels: string[] }> = [];
  
  // Issue templates - will generate exactly the count requested
  const products = [
    { name: 'SkyMeet', agent: 'agent:skymeet', count: 60, features: ['WebRTC video/audio core', 'TURN server setup', 'Screen sharing', 'Meeting scheduling', 'Virtual backgrounds', 'Recording', 'Live transcription', 'Breakout rooms', 'Whiteboard', 'Mobile app'] },
    { name: 'SkyChat', agent: 'agent:skychat', count: 70, features: ['Real-time messaging', 'Channels and DMs', 'Threaded conversations', 'Message search', 'File sharing', 'Mentions', 'Reactions', 'Slash commands', 'Webhooks', 'Bots'] },
    { name: 'SkyForms', agent: 'agent:skyforms', count: 50, features: ['Form builder', 'Question types', 'Validation', 'Conditional logic', 'Response collection', 'SkySheets integration', 'Notifications', 'Quiz mode', 'File uploads', 'Templates'] },
    { name: 'SkySheet', agent: 'agent:skysheet', count: 60, features: ['App builder', 'Data connectors', 'Workflow automation', 'Authentication', 'Access control', 'Mobile generation', 'Deployment', 'Components', 'Templates', 'APIs'] },
    { name: 'SkySearch', agent: 'agent:skysearch', count: 50, features: ['Web crawler', 'PageRank', 'Storage', 'Index', 'Query parser', 'Ranking', 'Suggestions', 'Image search', 'Safe search', 'Analytics'] },
    { name: 'SkyMind', agent: 'agent:skymind', count: 60, features: ['API abstraction', 'Model routing', 'Fallback', 'Context management', 'Prompts', 'Caching', 'Cost tracking', 'Embeddings', 'Vector DB', 'RAG'] },
    { name: 'Mobile', agent: 'agent:mobile', count: 60, features: ['RN setup', 'iOS', 'Android', 'Code sharing', 'Auth', 'Push', 'Offline', 'Native modules', 'Deployment', 'Testing'] },
    { name: 'Frontend', agent: 'agent:devops', count: 40, features: ['React', 'Components', 'Design system', 'Theming', 'State', 'Routing', 'Forms', 'a11y', 'i18n', 'Optimization'] },
    { name: 'Testing', agent: 'agent:testing', count: 38, features: ['Vitest', 'Examples', 'Mocks', 'Coverage', 'Visual', 'Performance', 'Load', 'Security'] },
    { name: 'Security', agent: 'agent:security', count: 39, features: ['Audits', 'Pentest', 'OWASP', 'Secrets', 'Dependencies', 'SQL injection', 'XSS', 'CSRF'] },
    { name: 'Performance', agent: 'agent:performance', count: 23, features: ['Benchmarks', 'DB', 'API', 'Bundle', 'CDN', 'Cache', 'Images', 'Lazy'] },
  ];
  
  const priorities = ['critical', 'high', 'medium', 'low'];
  
  let generated = 0;
  for (const product of products) {
    const issuesPerFeature = Math.ceil(product.count / product.features.length);
    
    for (let featureIdx = 0; featureIdx < product.features.length; featureIdx++) {
      const feature = product.features[featureIdx];
      const priority = priorities[Math.min(featureIdx < 3 ? 0 : featureIdx < 6 ? 1 : featureIdx < 8 ? 2 : 3, priorities.length - 1)];
      
      for (let i = 0; i < issuesPerFeature; i++) {
        if (generated >= count) break;
        
        generated++;
        const title = `${product.name}: ${feature}${i > 0 ? ` #${i + 1}` : ''}`;
        
        issues.push({
          title,
          body: `## Description\nImplement ${feature.toLowerCase()} for ${product.name}.\n\n## Acceptance Criteria\n- Feature implemented\n- Tests written (90%+ coverage with Vitest)\n- Documentation complete\n- Performance optimized\n- Screenshots verified`,
          labels: [product.agent, `priority:${priority}`, 'type:feature'],
        });
      }
      
      if (generated >= count) break;
    }
    
    if (generated >= count) break;
  }
  
  // Pad with additional generic issues if needed
  while (issues.length < count) {
    const productIdx = issues.length % products.length;
    const product = products[productIdx];
    
    issues.push({
      title: `${product.name}: Enhancement #${issues.length + 1}`,
      body: `## Description\nAdditional enhancement for ${product.name}.\n\n## Acceptance Criteria\n- Feature implemented\n- Tests written (90%+ coverage with Vitest)\n- Documentation complete`,
      labels: [product.agent, 'priority:low', 'type:feature'],
    });
  }
  
  return issues;
}

// Main command router
async function main() {
  try {
    switch (command) {
      case 'create':
        await createIssues();
        break;
      case 'list':
        await listIssues();
        break;
      case 'stats':
        await showStats();
        break;
      default:
        console.log('Usage: npm run issues <create|list|stats> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  create [--start N] [--count N] [--batch-size N] [--delay MS]');
        console.log('  list [--state open|closed|all] [--labels label1,label2]');
        console.log('  stats');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
