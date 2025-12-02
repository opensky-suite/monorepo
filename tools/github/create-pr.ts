import { GitHubAPI } from './github-api.js';
import * as fs from 'fs';
import * as path from 'path';

const secretsPath = path.join(process.cwd(), '.secrets.txt');
const secrets = fs.readFileSync(secretsPath, 'utf-8');
const tokenMatch = secrets.match(/GITHUB_TOKEN=(.+)/);
const ownerMatch = secrets.match(/GITHUB_ORG=(.+)/);
const repoMatch = secrets.match(/GITHUB_REPO=(.+)/);

if (!tokenMatch || !ownerMatch || !repoMatch) {
  console.error('Missing GitHub credentials');
  process.exit(1);
}

const api = new GitHubAPI({
  token: tokenMatch[1].trim(),
  owner: ownerMatch[1].trim(),
  repo: repoMatch[1].trim()
});

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'create': {
      const title = args[1];
      const body = args[2];
      const head = args[3];
      const base = args[4] || 'main';
      
      if (!title || !head) {
        console.error('Usage: create-pr create <title> <body> <head-branch> [base-branch]');
        process.exit(1);
      }
      
      const pr = await api.createPullRequest({ title, body, head, base });
      console.log(`✅ PR #${pr.number} created: ${pr.html_url}`);
      break;
    }
    case 'list': {
      const prs = await api.listPullRequests({ state: 'open', per_page: 20 });
      console.log('Open PRs:');
      prs.forEach(pr => {
        console.log(`#${pr.number}: ${pr.title} (${pr.head.ref})`);
      });
      break;
    }
    case 'merge': {
      const prNumber = parseInt(args[1], 10);
      if (!prNumber) {
        console.error('Usage: create-pr merge <pr-number>');
        process.exit(1);
      }
      await api.mergePullRequest(prNumber);
      console.log(`✅ PR #${prNumber} merged!`);
      break;
    }
    default:
      console.log('Usage: create-pr <create|list|merge> [args]');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
