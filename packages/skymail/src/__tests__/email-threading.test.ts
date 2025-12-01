/**
 * Email Threading Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EmailThreader } from "../email-threading";
import type { Email } from "../types";

describe("EmailThreader", () => {
  let threader: EmailThreader;

  beforeEach(() => {
    threader = new EmailThreader();
  });

  describe("normalizeSubject", () => {
    it("should remove Re: prefix", () => {
      expect(threader.normalizeSubject("Re: Hello World")).toBe("Hello World");
    });

    it("should remove multiple Re: prefixes", () => {
      expect(threader.normalizeSubject("Re: Re: Re: Hello")).toBe("Hello");
    });

    it("should remove Fwd: prefix", () => {
      expect(threader.normalizeSubject("Fwd: Important")).toBe("Important");
    });

    it("should remove Fw: prefix", () => {
      expect(threader.normalizeSubject("Fw: Test")).toBe("Test");
    });

    it("should be case-insensitive", () => {
      expect(threader.normalizeSubject("RE: re: Test")).toBe("Test");
    });

    it("should handle mixed prefixes", () => {
      expect(threader.normalizeSubject("Re: Fwd: Important")).toBe("Important");
    });

    it("should preserve subject without prefixes", () => {
      expect(threader.normalizeSubject("Plain subject")).toBe("Plain subject");
    });

    it("should trim whitespace", () => {
      expect(threader.normalizeSubject("  Re:  Spaced  ")).toBe("Spaced");
    });
  });

  describe("parseReferences", () => {
    it("should parse single reference", () => {
      const refs = threader.parseReferences("<msg1@example.com>");
      expect(refs).toEqual(["<msg1@example.com>"]);
    });

    it("should parse multiple references", () => {
      const refs = threader.parseReferences(
        "<msg1@example.com> <msg2@example.com> <msg3@example.com>",
      );
      expect(refs).toEqual([
        "<msg1@example.com>",
        "<msg2@example.com>",
        "<msg3@example.com>",
      ]);
    });

    it("should handle undefined references", () => {
      const refs = threader.parseReferences(undefined);
      expect(refs).toEqual([]);
    });

    it("should handle empty string", () => {
      const refs = threader.parseReferences("");
      expect(refs).toEqual([]);
    });

    it("should handle malformed references", () => {
      const refs = threader.parseReferences("not a reference");
      expect(refs).toEqual([]);
    });
  });

  describe("findThreadForEmail", () => {
    const createMockEmail = (overrides: Partial<Email> = {}): Email => ({
      id: "email-" + Math.random(),
      userId: "user-1",
      messageId: "<msg-" + Math.random() + "@example.com>",
      fromAddress: "sender@example.com",
      toAddresses: [{ address: "recipient@example.com" }],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Test Subject",
      isDraft: false,
      isSent: true,
      isRead: false,
      isStarred: false,
      isImportant: false,
      isArchived: false,
      isTrashed: false,
      isSpam: false,
      sizeBytes: 1024,
      hasAttachments: false,
      receivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it("should find thread by In-Reply-To header", async () => {
      const email1 = createMockEmail({
        messageId: "<msg1@example.com>",
        threadId: "thread-1",
      });

      const email2 = createMockEmail({
        inReplyTo: "<msg1@example.com>",
      });

      const threadId = await threader.findThreadForEmail(email2, [email1]);
      expect(threadId).toBe("thread-1");
    });

    it("should find thread by References header", async () => {
      const email1 = createMockEmail({
        messageId: "<msg1@example.com>",
        threadId: "thread-1",
      });

      const email2 = createMockEmail({
        references: "<msg1@example.com>",
      });

      const threadId = await threader.findThreadForEmail(email2, [email1]);
      expect(threadId).toBe("thread-1");
    });

    it("should find thread by subject match", async () => {
      const now = new Date();
      const email1 = createMockEmail({
        subject: "Project Discussion",
        threadId: "thread-1",
        receivedAt: now,
        fromAddress: "alice@example.com",
        toAddresses: [{ address: "bob@example.com" }],
      });

      const email2 = createMockEmail({
        subject: "Re: Project Discussion",
        receivedAt: new Date(now.getTime() + 3600000), // 1 hour later
        fromAddress: "bob@example.com",
        toAddresses: [{ address: "alice@example.com" }],
      });

      const threadId = await threader.findThreadForEmail(email2, [email1]);
      expect(threadId).toBe("thread-1");
    });

    it("should not match if time window exceeded", async () => {
      const now = new Date();
      const email1 = createMockEmail({
        subject: "Old Discussion",
        threadId: "thread-1",
        receivedAt: now,
        fromAddress: "alice@example.com",
        toAddresses: [{ address: "bob@example.com" }],
      });

      const email2 = createMockEmail({
        subject: "Re: Old Discussion",
        receivedAt: new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000), // 32 days
        fromAddress: "bob@example.com",
        toAddresses: [{ address: "alice@example.com" }],
      });

      const threadId = await threader.findThreadForEmail(email2, [email1]);
      expect(threadId).toBeUndefined();
    });

    it("should not match if participants differ", async () => {
      const now = new Date();
      const email1 = createMockEmail({
        subject: "Project Discussion",
        threadId: "thread-1",
        receivedAt: now,
        fromAddress: "alice@example.com",
        toAddresses: [{ address: "bob@example.com" }],
      });

      const email2 = createMockEmail({
        subject: "Re: Project Discussion",
        receivedAt: new Date(now.getTime() + 3600000),
        fromAddress: "charlie@example.com",
        toAddresses: [{ address: "david@example.com" }],
      });

      const threadId = await threader.findThreadForEmail(email2, [email1]);
      expect(threadId).toBeUndefined();
    });

    it("should return undefined for new thread", async () => {
      const email = createMockEmail();
      const threadId = await threader.findThreadForEmail(email, []);
      expect(threadId).toBeUndefined();
    });
  });

  describe("generateThreadSnippet", () => {
    const createMockEmail = (text: string): Email =>
      ({
        bodyText: text,
      }) as Email;

    it("should generate snippet from text", () => {
      const email = createMockEmail("Hello, this is a test email.");
      const snippet = threader.generateThreadSnippet(email, 50);
      expect(snippet).toBe("Hello, this is a test email.");
    });

    it("should truncate long text", () => {
      const longText = "A".repeat(600);
      const email = createMockEmail(longText);
      const snippet = threader.generateThreadSnippet(email, 500);
      expect(snippet).toHaveLength(500);
      expect(snippet.endsWith("...")).toBe(true);
    });

    it("should take only first line", () => {
      const email = createMockEmail("First line\nSecond line\nThird line");
      const snippet = threader.generateThreadSnippet(email, 500);
      expect(snippet).toBe("First line");
    });

    it("should strip HTML tags", () => {
      const email = {
        bodyHtml: "<p>Hello <b>world</b>!</p>",
      } as Email;
      const snippet = threader.generateThreadSnippet(email, 500);
      expect(snippet).toBe("Hello world!");
    });
  });

  describe("buildThreadData", () => {
    const createMockEmail = (overrides: Partial<Email> = {}): Email => ({
      id: "email-" + Math.random(),
      userId: "user-1",
      messageId: "<msg@example.com>",
      fromAddress: "sender@example.com",
      toAddresses: [{ address: "recipient@example.com" }],
      ccAddresses: [],
      bccAddresses: [],
      subject: "Test Subject",
      bodyText: "Test body",
      isDraft: false,
      isSent: true,
      isRead: false,
      isStarred: false,
      isImportant: false,
      isArchived: false,
      isTrashed: false,
      isSpam: false,
      sizeBytes: 1024,
      hasAttachments: false,
      receivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it("should build thread data from single email", () => {
      const email = createMockEmail();
      const data = threader.buildThreadData([email]);

      expect(data.messageCount).toBe(1);
      expect(data.unreadCount).toBe(1); // isRead: false
      expect(data.hasAttachments).toBe(false);
      expect(data.isStarred).toBe(false);
    });

    it("should count unread messages", () => {
      const emails = [
        createMockEmail({ isRead: true }),
        createMockEmail({ isRead: false }),
        createMockEmail({ isRead: false }),
      ];
      const data = threader.buildThreadData(emails);

      expect(data.messageCount).toBe(3);
      expect(data.unreadCount).toBe(2);
    });

    it("should detect attachments", () => {
      const emails = [
        createMockEmail({ hasAttachments: false }),
        createMockEmail({ hasAttachments: true }),
      ];
      const data = threader.buildThreadData(emails);

      expect(data.hasAttachments).toBe(true);
    });

    it("should mark starred if any starred", () => {
      const emails = [
        createMockEmail({ isStarred: false }),
        createMockEmail({ isStarred: true }),
      ];
      const data = threader.buildThreadData(emails);

      expect(data.isStarred).toBe(true);
    });

    it("should use latest message date", () => {
      const date1 = new Date("2024-01-01");
      const date2 = new Date("2024-01-02");
      const date3 = new Date("2024-01-03");

      const emails = [
        createMockEmail({ receivedAt: date1 }),
        createMockEmail({ receivedAt: date3 }),
        createMockEmail({ receivedAt: date2 }),
      ];
      const data = threader.buildThreadData(emails);

      expect(data.lastMessageAt).toEqual(date3);
    });

    it("should throw for empty email list", () => {
      expect(() => threader.buildThreadData([])).toThrow();
    });
  });

  describe("groupEmailsIntoThreads", () => {
    const createMockEmail = (id: string, threadId?: string): Email =>
      ({
        id,
        threadId,
      }) as Email;

    it("should group emails by threadId", () => {
      const emails = [
        createMockEmail("email1", "thread1"),
        createMockEmail("email2", "thread1"),
        createMockEmail("email3", "thread2"),
      ];

      const threads = threader.groupEmailsIntoThreads(emails);

      expect(threads.size).toBe(2);
      expect(threads.get("thread1")).toHaveLength(2);
      expect(threads.get("thread2")).toHaveLength(1);
    });

    it("should use email ID if no threadId", () => {
      const emails = [createMockEmail("email1")];
      const threads = threader.groupEmailsIntoThreads(emails);

      expect(threads.size).toBe(1);
      expect(threads.get("email1")).toHaveLength(1);
    });
  });

  describe("sortThreads", () => {
    it("should sort threads by lastMessageAt descending", () => {
      const threads = [
        { lastMessageAt: new Date("2024-01-01") },
        { lastMessageAt: new Date("2024-01-03") },
        { lastMessageAt: new Date("2024-01-02") },
      ] as any[];

      const sorted = threader.sortThreads(threads);

      expect(sorted[0].lastMessageAt).toEqual(new Date("2024-01-03"));
      expect(sorted[1].lastMessageAt).toEqual(new Date("2024-01-02"));
      expect(sorted[2].lastMessageAt).toEqual(new Date("2024-01-01"));
    });
  });

  describe("sortThreadEmails", () => {
    it("should sort emails by receivedAt ascending", () => {
      const emails = [
        { receivedAt: new Date("2024-01-03") },
        { receivedAt: new Date("2024-01-01") },
        { receivedAt: new Date("2024-01-02") },
      ] as Email[];

      const sorted = threader.sortThreadEmails(emails);

      expect(sorted[0].receivedAt).toEqual(new Date("2024-01-01"));
      expect(sorted[1].receivedAt).toEqual(new Date("2024-01-02"));
      expect(sorted[2].receivedAt).toEqual(new Date("2024-01-03"));
    });
  });
});
