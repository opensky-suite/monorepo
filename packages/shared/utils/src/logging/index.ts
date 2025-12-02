/**
 * Common logging utilities using Pino
 */
import pino from 'pino';

/**
 * Log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Logger options
 */
export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  prettyPrint?: boolean;
  redact?: string[];
}

/**
 * Create a logger instance
 */
export function createLogger(options: LoggerOptions = {}) {
  const {
    level = (process.env.LOG_LEVEL as LogLevel) || 'info',
    name = 'opensky',
    prettyPrint = process.env.NODE_ENV !== 'production',
    redact = ['password', 'passwordHash', 'token', 'apiKey', 'secret'],
  } = options;

  return pino({
    name,
    level,
    redact: {
      paths: redact,
      censor: '***REDACTED***',
    },
    ...(prettyPrint && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    }),
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Create child logger with additional context
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log with request context
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  method: string;
  url: string;
  ip?: string;
  userAgent?: string;
}

export function createRequestLogger(context: RequestContext) {
  return logger.child(context);
}

/**
 * Log error with stack trace
 */
export function logError(error: Error, context?: Record<string, any>) {
  logger.error({
    err: error,
    ...context,
  }, error.message);
}

/**
 * Log info message
 */
export function logInfo(message: string, context?: Record<string, any>) {
  logger.info(context, message);
}

/**
 * Log warning message
 */
export function logWarn(message: string, context?: Record<string, any>) {
  logger.warn(context, message);
}

/**
 * Log debug message
 */
export function logDebug(message: string, context?: Record<string, any>) {
  logger.debug(context, message);
}

/**
 * Log HTTP request
 */
export function logRequest(method: string, url: string, statusCode: number, duration: number, context?: Record<string, any>) {
  logger.info({
    method,
    url,
    statusCode,
    duration,
    ...context,
  }, `${method} ${url} ${statusCode} - ${duration}ms`);
}

/**
 * Log database query
 */
export function logQuery(query: string, duration: number, context?: Record<string, any>) {
  logger.debug({
    query,
    duration,
    ...context,
  }, `Query executed in ${duration}ms`);
}

/**
 * Log authentication event
 */
export function logAuth(event: 'login' | 'logout' | 'register' | 'password_reset' | 'email_verification', userId: string, context?: Record<string, any>) {
  logger.info({
    event,
    userId,
    ...context,
  }, `Auth event: ${event}`);
}

/**
 * Log performance metric
 */
export function logMetric(metric: string, value: number, unit: string, context?: Record<string, any>) {
  logger.info({
    metric,
    value,
    unit,
    ...context,
  }, `Metric: ${metric} = ${value}${unit}`);
}
