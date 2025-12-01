/**
 * SkyMail Filter Service
 *
 * Gmail-style email filters (rules):
 * - Match emails based on conditions
 * - Automatically apply actions (labels, archive, etc.)
 * - Support for complex conditions
 */

import type {
  Email,
  EmailFilter,
  FilterCondition,
  FilterAction,
} from "./types";

/**
 * Filter service for managing email filters
 */
export class FilterService {
  /**
   * Check if an email matches a filter
   */
  matchesFilter(email: Email, filter: EmailFilter): boolean {
    if (!filter.isEnabled) {
      return false;
    }

    // All conditions must match (AND logic)
    for (const condition of filter.conditions) {
      if (!this.matchesCondition(email, condition)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if an email matches a single condition
   */
  private matchesCondition(email: Email, condition: FilterCondition): boolean {
    const { field, operator, value } = condition;

    let fieldValue: any;

    // Get field value
    switch (field) {
      case "from":
        fieldValue = email.fromAddress;
        break;
      case "to":
        fieldValue = email.toAddresses.map((a) => a.address).join(" ");
        break;
      case "subject":
        fieldValue = email.subject;
        break;
      case "body":
        fieldValue = email.bodyText || "";
        break;
      case "hasAttachment":
        fieldValue = email.hasAttachments;
        break;
      case "size":
        fieldValue = email.sizeBytes;
        break;
      default:
        return false;
    }

    // Apply operator
    switch (operator) {
      case "contains":
        return this.stringContains(fieldValue, value);
      case "notContains":
        return !this.stringContains(fieldValue, value);
      case "equals":
        return this.equals(fieldValue, value);
      case "notEquals":
        return !this.equals(fieldValue, value);
      case "greaterThan":
        return Number(fieldValue) > Number(value);
      case "lessThan":
        return Number(fieldValue) < Number(value);
      default:
        return false;
    }
  }

  /**
   * String contains check (case-insensitive)
   */
  private stringContains(haystack: any, needle: any): boolean {
    if (typeof haystack !== "string" || typeof needle !== "string") {
      return false;
    }
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }

  /**
   * Equals check
   */
  private equals(a: any, b: any): boolean {
    if (typeof a === "string" && typeof b === "string") {
      return a.toLowerCase() === b.toLowerCase();
    }
    return a === b;
  }

  /**
   * Apply filter actions to an email
   */
  async applyFilterActions(
    email: Email,
    filter: EmailFilter,
    callbacks: FilterCallbacks,
  ): Promise<void> {
    for (const action of filter.actions) {
      await this.applyAction(email, action, callbacks);
    }
  }

  /**
   * Apply a single action
   */
  private async applyAction(
    email: Email,
    action: FilterAction,
    callbacks: FilterCallbacks,
  ): Promise<void> {
    switch (action.action) {
      case "addLabel":
        if (action.value && callbacks.addLabel) {
          await callbacks.addLabel(email.id, action.value);
        }
        break;

      case "removeLabel":
        if (action.value && callbacks.removeLabel) {
          await callbacks.removeLabel(email.id, action.value);
        }
        break;

      case "markAsRead":
        if (callbacks.markAsRead) {
          await callbacks.markAsRead(email.id);
        }
        break;

      case "markAsStarred":
        if (callbacks.markAsStarred) {
          await callbacks.markAsStarred(email.id);
        }
        break;

      case "archive":
        if (callbacks.archive) {
          await callbacks.archive(email.id);
        }
        break;

      case "trash":
        if (callbacks.trash) {
          await callbacks.trash(email.id);
        }
        break;

      case "markAsSpam":
        if (callbacks.markAsSpam) {
          await callbacks.markAsSpam(email.id);
        }
        break;
    }
  }

  /**
   * Find all filters that match an email
   */
  findMatchingFilters(email: Email, filters: EmailFilter[]): EmailFilter[] {
    return filters
      .filter((filter) => this.matchesFilter(email, filter))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Process an email through all filters
   */
  async processEmail(
    email: Email,
    filters: EmailFilter[],
    callbacks: FilterCallbacks,
  ): Promise<FilterResult> {
    const matchingFilters = this.findMatchingFilters(email, filters);
    const appliedActions: string[] = [];

    for (const filter of matchingFilters) {
      await this.applyFilterActions(email, filter, callbacks);
      appliedActions.push(filter.name);
    }

    return {
      matchedFilters: matchingFilters.length,
      appliedActions,
    };
  }

  /**
   * Validate filter conditions
   */
  validateFilter(filter: Partial<EmailFilter>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!filter.name || filter.name.trim().length === 0) {
      errors.push("Filter name is required");
    }

    if (!filter.conditions || filter.conditions.length === 0) {
      errors.push("At least one condition is required");
    }

    if (!filter.actions || filter.actions.length === 0) {
      errors.push("At least one action is required");
    }

    // Validate each condition
    if (filter.conditions) {
      for (const condition of filter.conditions) {
        if (!this.isValidField(condition.field)) {
          errors.push(`Invalid field: ${condition.field}`);
        }
        if (!this.isValidOperator(condition.operator)) {
          errors.push(`Invalid operator: ${condition.operator}`);
        }
      }
    }

    // Validate each action
    if (filter.actions) {
      for (const action of filter.actions) {
        if (!this.isValidAction(action.action)) {
          errors.push(`Invalid action: ${action.action}`);
        }
        if (this.requiresValue(action.action) && !action.value) {
          errors.push(`Action ${action.action} requires a value`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if field is valid
   */
  private isValidField(field: string): boolean {
    const validFields = [
      "from",
      "to",
      "subject",
      "body",
      "hasAttachment",
      "size",
    ];
    return validFields.includes(field);
  }

  /**
   * Check if operator is valid
   */
  private isValidOperator(operator: string): boolean {
    const validOperators = [
      "contains",
      "notContains",
      "equals",
      "notEquals",
      "greaterThan",
      "lessThan",
    ];
    return validOperators.includes(operator);
  }

  /**
   * Check if action is valid
   */
  private isValidAction(action: string): boolean {
    const validActions = [
      "addLabel",
      "removeLabel",
      "markAsRead",
      "markAsStarred",
      "archive",
      "trash",
      "markAsSpam",
    ];
    return validActions.includes(action);
  }

  /**
   * Check if action requires a value
   */
  private requiresValue(action: string): boolean {
    return action === "addLabel" || action === "removeLabel";
  }

  /**
   * Build a human-readable description of a filter
   */
  describeFilter(filter: EmailFilter): string {
    const conditionStrings = filter.conditions.map((c) =>
      this.describeCondition(c),
    );
    const actionStrings = filter.actions.map((a) => this.describeAction(a));

    const conditions = conditionStrings.join(" AND ");
    const actions = actionStrings.join(", ");

    return `When ${conditions}, then ${actions}`;
  }

  /**
   * Describe a single condition
   */
  private describeCondition(condition: FilterCondition): string {
    const { field, operator, value } = condition;

    const fieldName = field.charAt(0).toUpperCase() + field.slice(1);

    switch (operator) {
      case "contains":
        return `${fieldName} contains "${value}"`;
      case "notContains":
        return `${fieldName} does not contain "${value}"`;
      case "equals":
        return `${fieldName} equals "${value}"`;
      case "notEquals":
        return `${fieldName} does not equal "${value}"`;
      case "greaterThan":
        return `${fieldName} is greater than ${value}`;
      case "lessThan":
        return `${fieldName} is less than ${value}`;
      default:
        return "";
    }
  }

  /**
   * Describe a single action
   */
  private describeAction(action: FilterAction): string {
    switch (action.action) {
      case "addLabel":
        return `apply label "${action.value}"`;
      case "removeLabel":
        return `remove label "${action.value}"`;
      case "markAsRead":
        return "mark as read";
      case "markAsStarred":
        return "star it";
      case "archive":
        return "archive it";
      case "trash":
        return "move to trash";
      case "markAsSpam":
        return "mark as spam";
      default:
        return "";
    }
  }
}

export interface FilterCallbacks {
  addLabel?: (emailId: string, labelId: string) => Promise<void>;
  removeLabel?: (emailId: string, labelId: string) => Promise<void>;
  markAsRead?: (emailId: string) => Promise<void>;
  markAsStarred?: (emailId: string) => Promise<void>;
  archive?: (emailId: string) => Promise<void>;
  trash?: (emailId: string) => Promise<void>;
  markAsSpam?: (emailId: string) => Promise<void>;
}

export interface FilterResult {
  matchedFilters: number;
  appliedActions: string[];
}

/**
 * Create filter service instance
 */
export function createFilterService(): FilterService {
  return new FilterService();
}
