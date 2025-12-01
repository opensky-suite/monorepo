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
  
  // Issue templates grouped by product (simplified from original mega-script)
  const products = [
    { name: 'SkyDocs', agent: 'agent:skydocs', count: 70, features: ['Database schema', 'Rich text editor (Slate.js)', 'Real-time collaboration (Y.js CRDT)', 'Performance optimization for large documents', 'Document versioning and history', 'Comments and suggestions mode', 'Export (PDF, Word, Markdown, HTML)', 'Import (Word, PDF, Markdown)', 'Document templates', 'Permissions and sharing'] },
    { name: 'SkySheets', agent: 'agent:skysheets', count: 70, features: ['Database schema', 'Spreadsheet engine core', 'Formula parser and evaluator', 'Excel formula compatibility', 'Cell formatting', 'Charts and visualizations', 'Pivot tables', 'Large dataset optimization (100K+ rows)', 'Real-time collaboration', 'Import/Export Excel'] },
    { name: 'SkySlides', agent: 'agent:skyslides', count: 60, features: ['Database schema', 'Slide editor core', 'Templates and themes (Canva-inspired)', 'Animations and transitions', 'Presenter mode with notes', 'Export to PDF/PowerPoint', 'Import PowerPoint', 'Real-time collaboration', 'Stock images integration', 'Accessibility checker'] },
    { name: 'SkyMeet', agent: 'agent:skymeet', count: 60, features: ['WebRTC video/audio core', 'TURN server setup', 'Screen sharing', 'Meeting scheduling', 'Virtual backgrounds', 'Recording to SkyDrive', 'Live transcription (SkyMind)', 'Breakout rooms', 'Whiteboard', 'Mobile app'] },
    { name: 'SkyChat', agent: 'agent:skychat', count: 70, features: ['Real-time messaging', 'Channels and DMs', 'Threaded conversations', 'Message search', 'File sharing', 'Mentions and notifications', 'Reactions and emoji', 'Slash commands', 'Webhooks and bots', 'Mobile app'] },
    { name: 'SkyForms', agent: 'agent:skyforms', count: 50, features: ['Form builder', 'Question types', 'Validation rules', 'Conditional logic', 'Response collection', 'Integration with SkySheets', 'Email notifications', 'Quiz mode', 'File uploads', 'Templates'] },
    { name: 'SkySheet', agent: 'agent:skysheet', count: 60, features: ['Visual app builder', 'Data source connectors', 'Workflow automation', 'User authentication', 'Role-based access', 'Mobile app generation', 'Deployment', 'UI component library', 'Templates', 'API integrations'] },
    { name: 'SkySearch', agent: 'agent:skysearch', count: 50, features: ['Web crawler', 'PageRank implementation', 'BigTable-inspired storage', 'Inverted index', 'Query parser', 'Relevance ranking', 'Search suggestions', 'Image indexing', 'Safe search', 'Analytics'] },
    { name: 'SkyMind', agent: 'agent:skymind', count: 60, features: ['LLM API abstraction', 'Model routing (Claude, OpenAI, Gemini)', 'Fallback strategies', 'Context management', 'Prompt templates', 'Response caching', 'Cost tracking', 'Embedding generation', 'Vector database', 'RAG implementation'] },
    { name: 'Mobile', agent: 'agent:mobile', count: 60, features: ['React Native setup', 'iOS app', 'Android app', 'Code sharing with web', 'Authentication flows', 'Push notifications', 'Offline support', 'Native modules', 'App store deployment', 'Mobile testing'] },
    { name: 'Frontend', agent: 'agent:devops', count: 40, features: ['React architecture', 'Component library', 'Design system', 'Theme support', 'State management', 'Routing', 'Form handling', 'Accessibility', 'i18n', 'Bundle optimization'] },
    { name: 'Testing', agent: 'agent:testing', count: 40, features: ['Vitest configuration', 'Test examples', 'Mocking strategies', 'Coverage reporting', 'Visual regression', 'Performance testing', 'Load testing', 'Security testing', 'Accessibility testing', 'Mobile testing'] },
    { name: 'Security', agent: 'agent:security', count: 40, features: ['Security audit framework', 'Penetration testing', 'OWASP Top 10', 'Secrets scanning', 'Dependency scanning', 'SQL injection prevention', 'XSS prevention', 'CSRF protection', 'Rate limiting', 'DDoS protection'] },
    { name: 'Performance', agent: 'agent:performance', count: 20, features: ['Benchmarking', 'Database optimization', 'API optimization', 'Bundle optimization', 'CDN setup', 'Caching strategy', 'Image optimization', 'Lazy loading', 'SSR', 'PWA'] },
  ];
  
  const priorities = ['critical', 'high', 'medium', 'low'];
  
  let issueNum = 0;
  for (const product of products) {
    const featuresPerIssue = Math.ceil(product.count / product.features.length);
    
    product.features.forEach((feature, idx) => {
      for (let i = 0; i < featuresPerIssue && issueNum < count; i++) {
        issueNum++;
        if (issueNum < start - 240) continue; // Skip if before our start point
        if (issueNum > start - 240 + count) break;
        
        const priority = priorities[Math.min(Math.floor(idx / 3), priorities.length - 1)];
        
        issues.push({
          title: `${product.name}: ${feature}${i > 0 ? ` (${i + 1})` : ''}`,
          body: `## Description\nImplement ${feature.toLowerCase()} for ${product.name}.\n\n## Acceptance Criteria\n- Feature implemented\n- Tests written (90%+ coverage with Vitest)\n- Documentation complete\n- Performance optimized\n- Screenshots verified`,
          labels: [product.agent, `priority:${priority}`, 'type:feature'],
        });
      }
    });
  }
  
  return issues.slice(0, count);
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
