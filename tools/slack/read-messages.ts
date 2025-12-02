import { loadSlackClient } from './slack-client.js';

async function main() {
  const client = loadSlackClient();
  const channelId = await client.getChannelId('dev-team');

  if (!channelId) {
    console.log('Channel not found');
    process.exit(1);
  }

  const result = await client.client.conversations.history({
    channel: channelId,
    limit: 20
  });

  console.log('Recent messages in #dev-team:\n');
  result.messages?.reverse().forEach((msg) => {
    const date = new Date(parseFloat(msg.ts || '0') * 1000);
    const time = date.toLocaleTimeString();
    console.log(`[${time}] ${msg.text}`);
    console.log('---');
  });
}

main().catch(console.error);
