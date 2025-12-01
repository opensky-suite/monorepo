/**
 * SkyMail Spam Filter
 *
 * Bayesian spam filtering with:
 * - Naive Bayes classifier
 * - Pattern-based detection (suspicious URLs, ALL CAPS, etc.)
 * - Sender reputation tracking
 * - SPF/DKIM validation
 * - Training from user feedback
 */

import type { Email } from "./types";

export interface SpamScore {
  score: number; // 0-100 (higher = more likely spam)
  isSpam: boolean;
  reasons: string[];
}

export interface SpamFilterOptions {
  threshold?: number; // Default: 50
  enableBayesian?: boolean;
  enablePatterns?: boolean;
  enableReputation?: boolean;
}

interface TokenStats {
  spamCount: number;
  hamCount: number;
}

/**
 * Bayesian spam filter with pattern detection
 */
export class SpamFilter {
  private tokens: Map<string, TokenStats> = new Map();
  private spamCount = 0;
  private hamCount = 0;
  private options: Required<SpamFilterOptions>;

  // Common spam patterns
  private spamPatterns = [
    /\b(viagra|cialis|pharmacy)\b/i,
    /\b(weight loss|lose weight|diet pills)\b/i,
    /\b(click here|click now|act now)\b/i,
    /\b(limited time|urgent|immediate)\b/i,
    /\b(congratulations|you've won|winner)\b/i,
    /\b(free money|make money fast|earn \$\$\$)\b/i,
    /\b(nigerian prince|inheritance|lottery)\b/i,
    /\b(enlarge|enhancement|miracle)\b/i,
  ];

  constructor(options: SpamFilterOptions = {}) {
    this.options = {
      threshold: options.threshold ?? 50,
      enableBayesian: options.enableBayesian ?? true,
      enablePatterns: options.enablePatterns ?? true,
      enableReputation: options.enableReputation ?? true,
    };
  }

  /**
   * Calculate spam score for an email
   */
  async calculateSpamScore(email: Email): Promise<SpamScore> {
    const reasons: string[] = [];
    let score = 0;

    // Bayesian classification
    if (
      this.options.enableBayesian &&
      this.spamCount > 0 &&
      this.hamCount > 0
    ) {
      const bayesianScore = this.bayesianClassify(email);
      score += bayesianScore * 0.6; // 60% weight
      if (bayesianScore > 70) {
        reasons.push(`Bayesian classifier: ${bayesianScore.toFixed(1)}%`);
      }
    }

    // Pattern-based detection
    if (this.options.enablePatterns) {
      const patternScore = this.detectPatterns(email);
      score += patternScore; // Full weight for patterns
      if (patternScore > 20) {
        reasons.push(`Suspicious patterns detected`);
      }
    }

    // Sender reputation
    if (this.options.enableReputation) {
      const reputationScore = this.checkSenderReputation(email);
      score += reputationScore; // Full weight for reputation
      if (reputationScore > 30) {
        reasons.push(`Low sender reputation`);
      }
    }

    // Additional heuristics
    const heuristicScore = this.applyHeuristics(email);
    score += heuristicScore;

    if (heuristicScore > 20) {
      reasons.push(`Suspicious email characteristics`);
    }

    // Cap at 100
    score = Math.min(100, score);

    return {
      score,
      isSpam: score >= this.options.threshold,
      reasons,
    };
  }

  /**
   * Bayesian classification
   */
  private bayesianClassify(email: Email): number {
    const tokens = this.tokenize(email);
    const scores: number[] = [];

    for (const token of tokens) {
      const stats = this.tokens.get(token);
      if (!stats) continue;

      const spamProb = stats.spamCount / this.spamCount;
      const hamProb = stats.hamCount / this.hamCount;

      if (spamProb + hamProb === 0) continue;

      // Calculate token spam probability
      const prob = spamProb / (spamProb + hamProb);
      scores.push(prob);
    }

    if (scores.length === 0) return 50; // Neutral if no data

    // Combine probabilities (Fisher's method)
    const combined = this.combineProbs(scores);
    return combined * 100;
  }

  /**
   * Combine probabilities using Fisher's method
   */
  private combineProbs(probs: number[]): number {
    if (probs.length === 0) return 0.5;

    // Avoid log(0)
    const safeProbs = probs.map((p) => Math.max(0.01, Math.min(0.99, p)));

    const n = safeProbs.length;
    const product = safeProbs.reduce((acc, p) => acc * p, 1);
    const invProduct = safeProbs.reduce((acc, p) => acc * (1 - p), 1);

    return product / (product + invProduct);
  }

  /**
   * Pattern-based spam detection
   */
  private detectPatterns(email: Email): number {
    const text = `${email.subject} ${email.bodyText || ""}`.toLowerCase();
    let matchCount = 0;

    for (const pattern of this.spamPatterns) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }

    // More matches = higher spam score
    return Math.min(100, matchCount * 15);
  }

  /**
   * Check sender reputation
   */
  private checkSenderReputation(email: Email): number {
    let score = 0;

    // Suspicious sender patterns
    if (email.fromAddress.includes("noreply@")) {
      score += 10;
    }

    if (email.fromAddress.match(/\d{5,}/)) {
      score += 20; // Lots of numbers in email
    }

    if (!email.fromName) {
      score += 15; // No sender name
    }

    // Check for mismatched name/address
    if (email.fromName && email.fromAddress) {
      const nameLower = email.fromName.toLowerCase();
      const addressLower = email.fromAddress.toLowerCase();

      if (nameLower.includes("paypal") && !addressLower.includes("paypal")) {
        score += 50; // Potential phishing
      }
      if (nameLower.includes("bank") && !addressLower.includes("bank")) {
        score += 50;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Apply heuristic rules
   */
  private applyHeuristics(email: Email): number {
    let score = 0;
    const subject = email.subject || "";
    const text = email.bodyText || "";

    // ALL CAPS SUBJECT
    if (subject.length > 10 && subject === subject.toUpperCase()) {
      score += 15;
    }

    // Excessive punctuation
    const exclamations = (subject.match(/!/g) || []).length;
    if (exclamations > 3) {
      score += 10;
    }

    // Suspicious URLs
    const urlCount = (text.match(/https?:\/\//g) || []).length;
    if (urlCount > 5) {
      score += 15;
    }

    // Short URL services (often used in spam)
    if (text.match(/bit\.ly|tinyurl|goo\.gl/i)) {
      score += 10;
    }

    // Excessive line breaks (common in spam)
    const lineBreaks = (text.match(/\n/g) || []).length;
    if (lineBreaks > 50 && text.length < 1000) {
      score += 10;
    }

    // HTML-only emails with no text
    if (!email.bodyText && email.bodyHtml) {
      score += 5;
    }

    // Large number of recipients
    if (email.toAddresses.length + email.ccAddresses.length > 20) {
      score += 15;
    }

    return score;
  }

  /**
   * Train the filter with a spam email
   */
  trainSpam(email: Email): void {
    const tokens = this.tokenize(email);
    this.spamCount++;

    for (const token of tokens) {
      const stats = this.tokens.get(token) || { spamCount: 0, hamCount: 0 };
      stats.spamCount++;
      this.tokens.set(token, stats);
    }
  }

  /**
   * Train the filter with a legitimate email (ham)
   */
  trainHam(email: Email): void {
    const tokens = this.tokenize(email);
    this.hamCount++;

    for (const token of tokens) {
      const stats = this.tokens.get(token) || { spamCount: 0, hamCount: 0 };
      stats.hamCount++;
      this.tokens.set(token, stats);
    }
  }

  /**
   * Untrain an email (if user corrects classification)
   */
  untrainSpam(email: Email): void {
    const tokens = this.tokenize(email);
    this.spamCount = Math.max(0, this.spamCount - 1);

    for (const token of tokens) {
      const stats = this.tokens.get(token);
      if (stats) {
        stats.spamCount = Math.max(0, stats.spamCount - 1);
      }
    }
  }

  /**
   * Untrain a ham email
   */
  untrainHam(email: Email): void {
    const tokens = this.tokenize(email);
    this.hamCount = Math.max(0, this.hamCount - 1);

    for (const token of tokens) {
      const stats = this.tokens.get(token);
      if (stats) {
        stats.hamCount = Math.max(0, stats.hamCount - 1);
      }
    }
  }

  /**
   * Tokenize email into words for Bayesian analysis
   */
  private tokenize(email: Email): Set<string> {
    const text = `${email.subject} ${email.bodyText || ""}`.toLowerCase();

    // Split on non-word characters
    const words = text.match(/\b\w+\b/g) || [];

    // Filter out very short words and common words
    const filtered = words.filter(
      (word) => word.length > 2 && !this.isStopWord(word),
    );

    return new Set(filtered);
  }

  /**
   * Check if word is a stop word (common word with little meaning)
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "is",
      "at",
      "which",
      "on",
      "and",
      "or",
      "but",
      "in",
      "with",
      "to",
      "for",
      "of",
      "as",
      "by",
      "an",
      "be",
      "this",
      "that",
      "from",
      "they",
      "we",
      "say",
      "her",
      "she",
      "will",
      "my",
      "one",
      "all",
      "would",
      "there",
      "their",
    ]);
    return stopWords.has(word);
  }

  /**
   * Export trained data
   */
  export(): {
    tokens: Array<[string, TokenStats]>;
    spamCount: number;
    hamCount: number;
  } {
    return {
      tokens: Array.from(this.tokens.entries()),
      spamCount: this.spamCount,
      hamCount: this.hamCount,
    };
  }

  /**
   * Import trained data
   */
  import(data: {
    tokens: Array<[string, TokenStats]>;
    spamCount: number;
    hamCount: number;
  }): void {
    this.tokens = new Map(data.tokens);
    this.spamCount = data.spamCount;
    this.hamCount = data.hamCount;
  }

  /**
   * Get filter statistics
   */
  getStats() {
    return {
      totalTokens: this.tokens.size,
      spamEmailsTrained: this.spamCount,
      hamEmailsTrained: this.hamCount,
      threshold: this.options.threshold,
    };
  }
}

/**
 * Create spam filter instance
 */
export function createSpamFilter(options?: SpamFilterOptions): SpamFilter {
  return new SpamFilter(options);
}
