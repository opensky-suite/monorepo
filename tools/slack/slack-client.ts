/**
 * Slack Client for OpenSky Suite Agent Coordination
 * Used for multi-agent communication and status updates
 */

import { WebClient } from "@slack/web-api";
import * as fs from "fs";
import * as path from "path";

interface SlackConfig {
  token: string;
  botName: string;
  botUser: string;
}

export class SlackClient {
  public client: WebClient;
  private _config: SlackConfig;

  constructor(config: SlackConfig) {
    this._config = config;
    this.client = new WebClient(config.token);
  }

  async postMessage(channel: string, text: string, blocks?: any[]) {
    try {
      const result = await this.client.chat.postMessage({
        channel,
        text,
        blocks,
      });
      return result;
    } catch (error: any) {
      console.error("Error posting message:", error.message);
      throw error;
    }
  }

  async postStatusUpdate(status: {
    agent: string;
    workingOn: string;
    progress: string;
    blockers: string;
    next: string;
  }) {
    const text = `
**Agent**: ${status.agent}
**Working On**: ${status.workingOn}
**Progress**: ${status.progress}
**Blockers**: ${status.blockers}
**Next**: ${status.next}
    `.trim();

    return this.postMessage("general", text);
  }

  async findUser(name: string): Promise<any> {
    try {
      const result = await this.client.users.list({});
      const user = result.members?.find(
        (m: any) =>
          m.real_name?.toLowerCase().includes(name.toLowerCase()) ||
          m.name?.toLowerCase().includes(name.toLowerCase()),
      );
      return user;
    } catch (error: any) {
      console.error("Error finding user:", error.message);
      throw error;
    }
  }

  async sendDirectMessage(userId: string, text: string) {
    try {
      // Open a DM channel
      const dmResult = await this.client.conversations.open({
        users: userId,
      });

      if (!dmResult.channel?.id) {
        throw new Error("Failed to open DM channel");
      }

      // Send the message
      return this.postMessage(dmResult.channel.id, text);
    } catch (error: any) {
      console.error("Error sending DM:", error.message);
      throw error;
    }
  }

  async listChannels() {
    try {
      const result = await this.client.conversations.list({
        types: "public_channel,private_channel",
      });
      return result.channels || [];
    } catch (error: any) {
      console.error("Error listing channels:", error.message);
      throw error;
    }
  }

  async getChannelId(channelName: string): Promise<string | undefined> {
    const channels = await this.listChannels();
    const channel = channels.find((c: any) => c.name === channelName);
    return channel?.id;
  }
}

// Load Slack client from secrets
export function loadSlackClient(): SlackClient {
  const secretsPath = path.join(process.cwd(), ".secrets.txt");

  if (!fs.existsSync(secretsPath)) {
    throw new Error(".secrets.txt not found");
  }

  const secrets = fs.readFileSync(secretsPath, "utf-8");
  const tokenMatch = secrets.match(/SLACK_BOT_TOKEN=(.+)/);
  const nameMatch = secrets.match(/SLACK_BOT_NAME=(.+)/);
  const userMatch = secrets.match(/SLACK_BOT_USER=(.+)/);

  if (!tokenMatch || !nameMatch || !userMatch) {
    throw new Error("Missing Slack credentials in .secrets.txt");
  }

  return new SlackClient({
    token: tokenMatch[1].trim(),
    botName: nameMatch[1].trim(),
    botUser: userMatch[1].trim(),
  });
}
