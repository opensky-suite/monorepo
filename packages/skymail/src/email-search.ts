/**
 * SkyMail Email Search with Elasticsearch
 *
 * Full-text search across email content:
 * - Subject, body, sender, recipients
 * - Advanced query syntax (from:, to:, subject:, has:attachment)
 * - Fuzzy matching and typo tolerance
 * - Fast autocomplete
 * - Search within labels/folders
 */

import { Client } from "@elastic/elasticsearch";
import type { Email, SearchEmailsInput } from "./types";

export interface ElasticsearchConfig {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
  indexName?: string;
}

export interface SearchQuery {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  labelIds?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  emails: Email[];
  total: number;
  took: number; // milliseconds
  maxScore: number;
}

/**
 * Email search service using Elasticsearch
 */
export class EmailSearchService {
  private client: Client;
  private indexName: string;

  constructor(config: ElasticsearchConfig) {
    this.client = new Client({
      node: config.node,
      auth: config.auth,
    });
    this.indexName = config.indexName || "emails";
  }

  /**
   * Initialize Elasticsearch index with proper mapping
   */
  async createIndex(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: this.indexName,
    });

    if (exists) {
      return;
    }

    await this.client.indices.create({
      index: this.indexName,
      body: {
        settings: {
          number_of_shards: 2,
          number_of_replicas: 1,
          analysis: {
            analyzer: {
              email_analyzer: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "stop", "snowball"],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: "keyword" },
            userId: { type: "keyword" },
            messageId: { type: "keyword" },
            threadId: { type: "keyword" },

            // Searchable text fields
            subject: {
              type: "text",
              analyzer: "email_analyzer",
              fields: {
                keyword: { type: "keyword" },
              },
            },
            bodyText: {
              type: "text",
              analyzer: "email_analyzer",
            },
            bodyHtml: {
              type: "text",
              analyzer: "email_analyzer",
            },

            // Address fields
            fromAddress: {
              type: "text",
              analyzer: "email_analyzer",
              fields: {
                keyword: { type: "keyword" },
              },
            },
            fromName: {
              type: "text",
              analyzer: "email_analyzer",
            },
            toAddresses: {
              type: "nested",
              properties: {
                address: { type: "keyword" },
                name: { type: "text" },
              },
            },
            ccAddresses: {
              type: "nested",
              properties: {
                address: { type: "keyword" },
                name: { type: "text" },
              },
            },

            // Boolean flags
            isDraft: { type: "boolean" },
            isRead: { type: "boolean" },
            isStarred: { type: "boolean" },
            isImportant: { type: "boolean" },
            isArchived: { type: "boolean" },
            isTrashed: { type: "boolean" },
            isSpam: { type: "boolean" },
            hasAttachments: { type: "boolean" },

            // Dates
            receivedAt: { type: "date" },
            sentAt: { type: "date" },
            readAt: { type: "date" },

            // Labels
            labelIds: { type: "keyword" },

            // Metadata
            sizeBytes: { type: "integer" },
            spamScore: { type: "float" },
          },
        },
      },
    });
  }

  /**
   * Index an email for searching
   */
  async indexEmail(email: Email): Promise<void> {
    await this.client.index({
      index: this.indexName,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        messageId: email.messageId,
        threadId: email.threadId,
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        fromAddress: email.fromAddress,
        fromName: email.fromName,
        toAddresses: email.toAddresses,
        ccAddresses: email.ccAddresses,
        isDraft: email.isDraft,
        isRead: email.isRead,
        isStarred: email.isStarred,
        isImportant: email.isImportant,
        isArchived: email.isArchived,
        isTrashed: email.isTrashed,
        isSpam: email.isSpam,
        hasAttachments: email.hasAttachments,
        receivedAt: email.receivedAt,
        sentAt: email.sentAt,
        readAt: email.readAt,
        sizeBytes: email.sizeBytes,
        spamScore: email.spamScore,
      },
    });
  }

  /**
   * Index multiple emails in bulk
   */
  async indexEmailsBulk(emails: Email[]): Promise<void> {
    if (emails.length === 0) return;

    const operations = emails.flatMap((email) => [
      { index: { _index: this.indexName, _id: email.id } },
      {
        id: email.id,
        userId: email.userId,
        messageId: email.messageId,
        threadId: email.threadId,
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        fromAddress: email.fromAddress,
        fromName: email.fromName,
        toAddresses: email.toAddresses,
        ccAddresses: email.ccAddresses,
        isDraft: email.isDraft,
        isRead: email.isRead,
        isStarred: email.isStarred,
        isImportant: email.isImportant,
        isArchived: email.isArchived,
        isTrashed: email.isTrashed,
        isSpam: email.isSpam,
        hasAttachments: email.hasAttachments,
        receivedAt: email.receivedAt,
        sentAt: email.sentAt,
        readAt: email.readAt,
        sizeBytes: email.sizeBytes,
        spamScore: email.spamScore,
      },
    ]);

    await this.client.bulk({
      operations,
      refresh: true,
    });
  }

  /**
   * Delete an email from the index
   */
  async deleteEmail(emailId: string): Promise<void> {
    await this.client.delete({
      index: this.indexName,
      id: emailId,
    });
  }

  /**
   * Update an email in the index
   */
  async updateEmail(emailId: string, updates: Partial<Email>): Promise<void> {
    await this.client.update({
      index: this.indexName,
      id: emailId,
      doc: updates,
    });
  }

  /**
   * Search emails with advanced query parsing
   */
  async search(userId: string, query: SearchQuery): Promise<SearchResult> {
    const must: any[] = [{ term: { userId } }];

    const mustNot: any[] = [];

    // Parse query string for special operators
    if (query.query) {
      const parsedQuery = this.parseQuery(query.query);

      if (parsedQuery.text) {
        must.push({
          multi_match: {
            query: parsedQuery.text,
            fields: [
              "subject^3",
              "bodyText^2",
              "bodyHtml",
              "fromName",
              "fromAddress",
            ],
            type: "best_fields",
            fuzziness: "AUTO",
          },
        });
      }

      if (parsedQuery.from) {
        must.push({
          match: { fromAddress: parsedQuery.from },
        });
      }

      if (parsedQuery.to) {
        must.push({
          nested: {
            path: "toAddresses",
            query: {
              match: { "toAddresses.address": parsedQuery.to },
            },
          },
        });
      }

      if (parsedQuery.subject) {
        must.push({
          match: { subject: parsedQuery.subject },
        });
      }
    }

    // Add filters
    if (query.from) {
      must.push({ match: { fromAddress: query.from } });
    }

    if (query.to) {
      must.push({
        nested: {
          path: "toAddresses",
          query: {
            match: { "toAddresses.address": query.to },
          },
        },
      });
    }

    if (query.subject) {
      must.push({ match: { subject: query.subject } });
    }

    if (query.hasAttachment !== undefined) {
      must.push({ term: { hasAttachments: query.hasAttachment } });
    }

    if (query.isRead !== undefined) {
      must.push({ term: { isRead: query.isRead } });
    }

    if (query.isStarred !== undefined) {
      must.push({ term: { isStarred: query.isStarred } });
    }

    if (query.labelIds && query.labelIds.length > 0) {
      must.push({ terms: { labelIds: query.labelIds } });
    }

    // Date range
    if (query.dateFrom || query.dateTo) {
      const range: any = {};
      if (query.dateFrom) range.gte = query.dateFrom;
      if (query.dateTo) range.lte = query.dateTo;
      must.push({ range: { receivedAt: range } });
    }

    // Exclude trashed and spam by default
    mustNot.push({ term: { isTrashed: true } });
    mustNot.push({ term: { isSpam: true } });

    const result = await this.client.search({
      index: this.indexName,
      body: {
        query: {
          bool: {
            must,
            must_not: mustNot,
          },
        },
        sort: [{ receivedAt: { order: "desc" } }],
        from: query.offset || 0,
        size: query.limit || 50,
      },
    });

    const hits = result.hits.hits;
    const emails = hits.map((hit) => hit._source as Email);

    return {
      emails,
      total:
        typeof result.hits.total === "number"
          ? result.hits.total
          : result.hits.total?.value || 0,
      took: result.took,
      maxScore: result.hits.max_score || 0,
    };
  }

  /**
   * Parse query string for special operators
   * Examples:
   *   from:alice@example.com subject:meeting
   *   has:attachment important text
   */
  private parseQuery(query: string): {
    text?: string;
    from?: string;
    to?: string;
    subject?: string;
  } {
    const parsed: any = {};
    const parts: string[] = [];

    // Match operator:value patterns
    const operatorRegex = /(from|to|subject):(\S+)/g;
    let match;
    let lastIndex = 0;

    while ((match = operatorRegex.exec(query)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        parts.push(query.substring(lastIndex, match.index));
      }

      const [, operator, value] = match;
      parsed[operator] = value;
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < query.length) {
      parts.push(query.substring(lastIndex));
    }

    // Combine non-operator text
    const text = parts.join(" ").trim();
    if (text) {
      parsed.text = text;
    }

    return parsed;
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(
    userId: string,
    prefix: string,
    field: "subject" | "fromAddress" = "subject",
  ): Promise<string[]> {
    const result = await this.client.search({
      index: this.indexName,
      body: {
        query: {
          bool: {
            must: [
              { term: { userId } },
              { prefix: { [field]: prefix.toLowerCase() } },
            ],
          },
        },
        size: 10,
        _source: [field],
      },
    });

    const suggestions = new Set<string>();
    result.hits.hits.forEach((hit) => {
      const value = (hit._source as any)[field];
      if (value) suggestions.add(value);
    });

    return Array.from(suggestions);
  }

  /**
   * Close Elasticsearch client
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}

/**
 * Create email search service
 */
export function createEmailSearchService(
  config: ElasticsearchConfig,
): EmailSearchService {
  return new EmailSearchService(config);
}
