/**
 * Spam Filter Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SpamFilter } from "../spam-filter";
import type { Email } from "../types";

describe("SpamFilter", () => {
  let filter: SpamFilter;

  beforeEach(() => {
    filter = new SpamFilter();
  });

  const createMockEmail = (overrides: Partial<Email> = {}): Email => ({
    id: "email-1",
    userId: "user-1",
    messageId: "<msg@example.com>",
    fromAddress: "sender@example.com",
    fromName: "Sender Name",
    toAddresses: [{ address: "recipient@example.com" }],
    ccAddresses: [],
    bccAddresses: [],
    subject: "Test Subject",
    bodyText: "Test body content",
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

  describe("Pattern Detection", () => {
    it("should detect viagra spam", async () => {
      const email = createMockEmail({
        subject: "Buy cheap viagra now!",
        bodyText: "Get viagra at low prices",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(20);
    });

    it("should detect weight loss spam", async () => {
      const email = createMockEmail({
        subject: "Lose weight fast!",
        bodyText: "Our diet pills will help you lose weight quickly",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(20);
    });

    it("should detect urgent action spam", async () => {
      const email = createMockEmail({
        subject: "CLICK NOW - LIMITED TIME OFFER!!!",
        bodyText: "Act now before this offer expires!",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(30);
    });

    it("should detect lottery/winner spam", async () => {
      const email = createMockEmail({
        subject: "Congratulations! You've won the lottery!",
        bodyText: "You are the lucky winner of $1,000,000",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(20);
    });

    it("should not flag normal emails", async () => {
      const email = createMockEmail({
        subject: "Meeting tomorrow at 2pm",
        bodyText: "Hi team, let's discuss the project tomorrow",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeLessThan(30);
    });
  });

  describe("Heuristics", () => {
    it("should penalize ALL CAPS subjects", async () => {
      const email = createMockEmail({
        subject: "THIS IS ALL CAPS SUBJECT LINE",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(10);
    });

    it("should penalize excessive exclamation marks", async () => {
      const email = createMockEmail({
        subject: "Amazing offer!!!!!",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(5);
    });

    it("should penalize many URLs", async () => {
      const email = createMockEmail({
        bodyText:
          "Check out:\nhttp://spam1.com\nhttp://spam2.com\nhttp://spam3.com\nhttp://spam4.com\nhttp://spam5.com\nhttp://spam6.com",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(10);
    });

    it("should penalize short URL services", async () => {
      const email = createMockEmail({
        bodyText: "Click here: http://bit.ly/suspicious",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(5);
    });

    it("should penalize many recipients", async () => {
      const email = createMockEmail({
        toAddresses: Array.from({ length: 25 }, (_, i) => ({
          address: `user${i}@example.com`,
        })),
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(10);
    });

    it("should penalize HTML-only emails", async () => {
      const email = createMockEmail({
        bodyText: undefined,
        bodyHtml: "<html><body>Content</body></html>",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe("Sender Reputation", () => {
    it("should flag suspicious noreply addresses", async () => {
      const email = createMockEmail({
        fromAddress: "noreply@suspicious-domain.com",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(5);
    });

    it("should flag emails with many numbers in address", async () => {
      const email = createMockEmail({
        fromAddress: "user123456@example.com",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(10);
    });

    it("should flag missing sender name", async () => {
      const email = createMockEmail({
        fromName: undefined,
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(5);
    });

    it("should detect PayPal phishing", async () => {
      const email = createMockEmail({
        fromName: "PayPal Security",
        fromAddress: "noreply@suspicious.com",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(50);
      expect(result.isSpam).toBe(true);
    });

    it("should detect bank phishing", async () => {
      const email = createMockEmail({
        fromName: "Bank of America",
        fromAddress: "no-reply@fake-bank.com",
      });

      const result = await filter.calculateSpamScore(email);
      expect(result.score).toBeGreaterThan(50);
    });
  });

  describe("Bayesian Training", () => {
    it("should learn from spam training", () => {
      const spam = createMockEmail({
        subject: "Get rich quick",
        bodyText: "Make money fast with our system",
      });

      filter.trainSpam(spam);
      const stats = filter.getStats();

      expect(stats.spamEmailsTrained).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it("should learn from ham training", () => {
      const ham = createMockEmail({
        subject: "Project update",
        bodyText: "Here is the weekly project status",
      });

      filter.trainHam(ham);
      const stats = filter.getStats();

      expect(stats.hamEmailsTrained).toBe(1);
    });

    it("should classify based on training", async () => {
      // Train with spam
      for (let i = 0; i < 10; i++) {
        filter.trainSpam(
          createMockEmail({
            subject: `Spam ${i}: buy viagra now`,
            bodyText: "cheap viagra pills online",
          }),
        );
      }

      // Train with ham
      for (let i = 0; i < 10; i++) {
        filter.trainHam(
          createMockEmail({
            subject: `Meeting ${i}: weekly sync`,
            bodyText: "let us discuss the project status",
          }),
        );
      }

      // Test spam
      const spamEmail = createMockEmail({
        subject: "Buy viagra cheap",
        bodyText: "viagra pills available",
      });
      const spamResult = await filter.calculateSpamScore(spamEmail);
      expect(spamResult.score).toBeGreaterThan(50);

      // Test ham
      const hamEmail = createMockEmail({
        subject: "Weekly meeting notes",
        bodyText: "discuss project deliverables",
      });
      const hamResult = await filter.calculateSpamScore(hamEmail);
      expect(hamResult.score).toBeLessThan(50);
    });

    it("should untrain emails", () => {
      const email = createMockEmail({
        subject: "Test email",
      });

      filter.trainSpam(email);
      expect(filter.getStats().spamEmailsTrained).toBe(1);

      filter.untrainSpam(email);
      expect(filter.getStats().spamEmailsTrained).toBe(0);
    });
  });

  describe("Export/Import", () => {
    it("should export trained data", () => {
      filter.trainSpam(createMockEmail({ subject: "spam" }));
      filter.trainHam(createMockEmail({ subject: "ham" }));

      const data = filter.export();

      expect(data.spamCount).toBe(1);
      expect(data.hamCount).toBe(1);
      expect(data.tokens.length).toBeGreaterThan(0);
    });

    it("should import trained data", () => {
      const data = {
        tokens: [
          ["spam", { spamCount: 5, hamCount: 0 }],
          ["legitimate", { spamCount: 0, hamCount: 5 }],
        ] as Array<[string, { spamCount: number; hamCount: number }]>,
        spamCount: 5,
        hamCount: 5,
      };

      filter.import(data);
      const stats = filter.getStats();

      expect(stats.spamEmailsTrained).toBe(5);
      expect(stats.hamEmailsTrained).toBe(5);
      expect(stats.totalTokens).toBe(2);
    });

    it("should preserve training across export/import", async () => {
      // Train filter
      filter.trainSpam(createMockEmail({ subject: "viagra pills" }));
      filter.trainHam(createMockEmail({ subject: "project meeting" }));

      // Export and create new filter
      const data = filter.export();
      const newFilter = new SpamFilter();
      newFilter.import(data);

      // Test classification
      const testEmail = createMockEmail({ subject: "viagra" });
      const result = await newFilter.calculateSpamScore(testEmail);

      expect(result.score).toBeGreaterThan(30);
    });
  });

  describe("Threshold", () => {
    it("should use custom threshold", async () => {
      const strictFilter = new SpamFilter({ threshold: 30 });

      const email = createMockEmail({
        subject: "Buy now!!!",
      });

      const result = await strictFilter.calculateSpamScore(email);

      if (result.score >= 30) {
        expect(result.isSpam).toBe(true);
      } else {
        expect(result.isSpam).toBe(false);
      }
    });

    it("should use default threshold of 50", async () => {
      const defaultFilter = new SpamFilter();
      expect(defaultFilter.getStats().threshold).toBe(50);
    });
  });

  describe("Tokenization", () => {
    it("should filter out stop words", () => {
      const email = createMockEmail({
        subject: "the meeting is on tuesday",
        bodyText: "we will discuss the project",
      });

      filter.trainSpam(email);
      const data = filter.export();

      // Stop words like 'the', 'is', 'on', 'will' should be filtered
      const tokens = data.tokens.map(([token]) => token);
      expect(tokens).not.toContain("the");
      expect(tokens).not.toContain("is");
      expect(tokens).toContain("meeting");
      expect(tokens).toContain("tuesday");
    });

    it("should filter out short words", () => {
      const email = createMockEmail({
        subject: "a b cd important message",
      });

      filter.trainSpam(email);
      const data = filter.export();
      const tokens = data.tokens.map(([token]) => token);

      expect(tokens).not.toContain("a");
      expect(tokens).not.toContain("b");
      expect(tokens).toContain("important");
    });
  });
});
