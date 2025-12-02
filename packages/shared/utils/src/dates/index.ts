/**
 * Common date/time utilities
 */
import { format, formatDistance, formatRelative, isAfter, isBefore, addDays, addHours, addMinutes, parseISO } from 'date-fns';

/**
 * Format date to ISO 8601 string
 */
export function toISOString(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.toISOString();
}

/**
 * Format date for display (e.g., "Dec 1, 2025")
 */
export function formatDate(date: Date | string, formatStr = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Format date and time (e.g., "Dec 1, 2025 3:45 PM")
 */
export function formatDateTime(date: Date | string, formatStr = 'MMM d, yyyy h:mm a'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(d, new Date(), { addSuffix: true });
}

/**
 * Format relative time with date (e.g., "yesterday at 3:45 PM")
 */
export function formatRelativeDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatRelative(d, new Date());
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(d, new Date());
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isAfter(d, new Date());
}

/**
 * Add days to a date
 */
export function addDaysToDate(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return addDays(d, days);
}

/**
 * Add hours to a date
 */
export function addHoursToDate(date: Date | string, hours: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return addHours(d, hours);
}

/**
 * Add minutes to a date
 */
export function addMinutesToDate(date: Date | string, minutes: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return addMinutes(d, minutes);
}

/**
 * Get timestamp in seconds (Unix timestamp)
 */
export function getUnixTimestamp(date?: Date | string): number {
  const d = date ? (typeof date === 'string' ? parseISO(date) : date) : new Date();
  return Math.floor(d.getTime() / 1000);
}

/**
 * Get timestamp in milliseconds
 */
export function getTimestamp(date?: Date | string): number {
  const d = date ? (typeof date === 'string' ? parseISO(date) : date) : new Date();
  return d.getTime();
}

/**
 * Parse ISO date string to Date object
 */
export function parseDate(dateString: string): Date {
  return parseISO(dateString);
}

/**
 * Check if a date is expired
 */
export function isExpired(expiresAt: Date | string): boolean {
  return isPast(expiresAt);
}

/**
 * Get expiration time in seconds from now
 */
export function expiresInSeconds(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Get expiration time in minutes from now
 */
export function expiresInMinutes(minutes: number): Date {
  return addMinutesToDate(new Date(), minutes);
}

/**
 * Get expiration time in hours from now
 */
export function expiresInHours(hours: number): Date {
  return addHoursToDate(new Date(), hours);
}

/**
 * Get expiration time in days from now
 */
export function expiresInDays(days: number): Date {
  return addDaysToDate(new Date(), days);
}
