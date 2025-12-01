/**
 * SkyMail Label Service
 *
 * Gmail-style labels (tags) for organizing emails:
 * - Create custom labels with colors
 * - Apply/remove labels from emails
 * - System labels (Inbox, Sent, Drafts, etc.)
 * - Nested labels (using / separator)
 */

import type { EmailLabel } from "./types";

export interface CreateLabelInput {
  userId: string;
  name: string;
  color?: string;
  parentId?: string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  sortOrder?: number;
}

/**
 * Label service for managing email labels
 */
export class LabelService {
  /**
   * Validate label name
   */
  validateLabelName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: "Label name cannot be empty" };
    }

    if (name.length > 100) {
      return { valid: false, error: "Label name cannot exceed 100 characters" };
    }

    // Check for invalid characters
    if (name.includes("<") || name.includes(">")) {
      return { valid: false, error: "Label name cannot contain < or >" };
    }

    return { valid: true };
  }

  /**
   * Validate hex color code
   */
  validateColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color);
  }

  /**
   * Parse nested label name (e.g., "Work/Projects/2024")
   */
  parseNestedLabel(name: string): string[] {
    return name
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  /**
   * Format nested label for display
   */
  formatNestedLabel(parts: string[]): string {
    return parts.join(" / ");
  }

  /**
   * Get default system labels
   */
  getSystemLabels(): Array<{
    name: string;
    sortOrder: number;
    color?: string;
  }> {
    return [
      { name: "Inbox", sortOrder: 0, color: "#4285f4" },
      { name: "Sent", sortOrder: 1, color: "#34a853" },
      { name: "Drafts", sortOrder: 2, color: "#fbbc04" },
      { name: "Spam", sortOrder: 3, color: "#ea4335" },
      { name: "Trash", sortOrder: 4, color: "#5f6368" },
      { name: "Starred", sortOrder: 5, color: "#f9ab00" },
      { name: "Important", sortOrder: 6, color: "#fbbc04" },
    ];
  }

  /**
   * Check if label name is a system label
   */
  isSystemLabel(name: string): boolean {
    const systemLabels = this.getSystemLabels().map((l) =>
      l.name.toLowerCase(),
    );
    return systemLabels.includes(name.toLowerCase());
  }

  /**
   * Generate label color suggestions
   */
  getColorPalette(): string[] {
    return [
      "#e91e63", // Pink
      "#9c27b0", // Purple
      "#673ab7", // Deep Purple
      "#3f51b5", // Indigo
      "#2196f3", // Blue
      "#03a9f4", // Light Blue
      "#00bcd4", // Cyan
      "#009688", // Teal
      "#4caf50", // Green
      "#8bc34a", // Light Green
      "#cddc39", // Lime
      "#ffeb3b", // Yellow
      "#ffc107", // Amber
      "#ff9800", // Orange
      "#ff5722", // Deep Orange
      "#795548", // Brown
      "#607d8b", // Blue Grey
    ];
  }

  /**
   * Sort labels for display
   */
  sortLabels(labels: EmailLabel[]): EmailLabel[] {
    return labels.sort((a, b) => {
      // System labels first
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;

      // Then by sort order
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      // Finally by name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Group labels by parent (for nested labels)
   */
  groupLabelsByParent(labels: EmailLabel[]): Map<string | null, EmailLabel[]> {
    const groups = new Map<string | null, EmailLabel[]>();

    for (const label of labels) {
      const parts = this.parseNestedLabel(label.name);
      const parent = parts.length > 1 ? parts.slice(0, -1).join("/") : null;

      if (!groups.has(parent)) {
        groups.set(parent, []);
      }
      groups.get(parent)!.push(label);
    }

    return groups;
  }

  /**
   * Build label hierarchy tree
   */
  buildLabelTree(labels: EmailLabel[]): LabelTreeNode[] {
    const tree: LabelTreeNode[] = [];
    const labelMap = new Map<string, LabelTreeNode>();

    // Create nodes for all labels
    for (const label of labels) {
      const node: LabelTreeNode = {
        label,
        children: [],
      };
      labelMap.set(label.name, node);
    }

    // Build tree structure
    for (const label of labels) {
      const parts = this.parseNestedLabel(label.name);
      if (parts.length === 1) {
        // Top-level label
        tree.push(labelMap.get(label.name)!);
      } else {
        // Nested label - find parent
        const parentName = parts.slice(0, -1).join("/");
        const parent = labelMap.get(parentName);
        if (parent) {
          parent.children.push(labelMap.get(label.name)!);
        } else {
          // Parent doesn't exist, treat as top-level
          tree.push(labelMap.get(label.name)!);
        }
      }
    }

    return tree;
  }

  /**
   * Get label suggestions based on partial input
   */
  suggestLabels(labels: EmailLabel[], input: string): EmailLabel[] {
    const lowerInput = input.toLowerCase();

    return labels
      .filter(
        (label) =>
          label.name.toLowerCase().includes(lowerInput) ||
          label.name.toLowerCase().startsWith(lowerInput),
      )
      .sort((a, b) => {
        // Exact matches first
        const aStarts = a.name.toLowerCase().startsWith(lowerInput);
        const bStarts = b.name.toLowerCase().startsWith(lowerInput);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Then by name
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10);
  }
}

export interface LabelTreeNode {
  label: EmailLabel;
  children: LabelTreeNode[];
}

/**
 * Create label service instance
 */
export function createLabelService(): LabelService {
  return new LabelService();
}
