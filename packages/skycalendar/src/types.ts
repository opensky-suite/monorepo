/**
 * SkyCalendar Types
 * Complete type definitions for calendar events, recurring patterns, and attendees
 */

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  timezone: string; // IANA timezone (e.g., "America/New_York")
  isAllDay: boolean;
  ownerId: string;
  calendarId?: string; // For multi-calendar support
  visibility: EventVisibility;
  status: EventStatus;
  recurrenceRule?: string; // RFC 5545 RRule string
  recurrenceId?: string; // Links to parent recurring event
  meetingUrl?: string; // SkyMeet integration
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete for trash
}

export enum EventVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
  CONFIDENTIAL = "confidential", // Only show "Busy" time
}

export enum EventStatus {
  CONFIRMED = "confirmed",
  TENTATIVE = "tentative",
  CANCELLED = "cancelled",
}

export enum AttendeeStatus {
  ACCEPTED = "accepted",
  DECLINED = "declined",
  TENTATIVE = "tentative",
  NEEDS_ACTION = "needs_action",
}

export enum AttendeeRole {
  REQUIRED = "required",
  OPTIONAL = "optional",
  CHAIR = "chair", // Organizer
  NON_PARTICIPANT = "non_participant", // For informational only
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string;
  email: string;
  displayName: string;
  role: AttendeeRole;
  status: AttendeeStatus;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ReminderMethod {
  EMAIL = "email",
  NOTIFICATION = "notification",
  POPUP = "popup",
}

export interface EventReminder {
  id: string;
  eventId: string;
  method: ReminderMethod;
  minutesBefore: number; // Minutes before event start
  createdAt: Date;
}

export interface Calendar {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  color: string; // Hex color code
  isDefault: boolean;
  timezone: string; // Default timezone for events
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CalendarShare {
  id: string;
  calendarId: string;
  sharedBy: string;
  sharedWith: string;
  permission: CalendarPermission;
  createdAt: Date;
}

export enum CalendarPermission {
  VIEW_FREEBUSY = "view_freebusy", // See only busy/free
  VIEW = "view", // See event details
  EDIT = "edit", // Create/edit events
  OWNER = "owner", // Full control
}

// Request/Response DTOs

export interface CreateEventRequest {
  title: string;
  description?: string;
  location?: string;
  startTime: Date | string;
  endTime: Date | string;
  timezone?: string; // Defaults to user's timezone
  isAllDay?: boolean;
  visibility?: EventVisibility;
  status?: EventStatus;
  recurrenceRule?: string;
  attendees?: Array<{
    email: string;
    role?: AttendeeRole;
  }>;
  reminders?: Array<{
    method: ReminderMethod;
    minutesBefore: number;
  }>;
  meetingUrl?: string;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  location?: string;
  startTime?: Date | string;
  endTime?: Date | string;
  timezone?: string;
  isAllDay?: boolean;
  visibility?: EventVisibility;
  status?: EventStatus;
  recurrenceRule?: string;
}

export interface ListEventsOptions {
  calendarId?: string;
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
  includeDeleted?: boolean;
  maxResults?: number;
  pageToken?: string;
}

export interface EventOccurrence {
  originalEvent: CalendarEvent;
  occurrenceStart: Date;
  occurrenceEnd: Date;
}

export interface FreeBusyRequest {
  timeMin: Date;
  timeMax: Date;
  userIds: string[];
  timezone?: string;
}

export interface FreeBusyResponse {
  userId: string;
  busySlots: Array<{
    start: Date;
    end: Date;
  }>;
}
