 
 
 
/**
 * Logger service
 */
import winston from 'winston';

declare const process: {
  env: Record<string, string | undefined>;
};

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'codesight-mcp' },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, service }) => {
          return `[${timestamp}] ${level.toUpperCase()}: ${message} (${service})`;
        }),
      ),
    }),
  ],
});

/**
 * Logger class for creating named loggers
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(message: string): string {
    return `[${this.context}] ${message}`;
  }

  info(message: string, meta?: any): void {
    logger.info(this.formatMessage(message), meta);
  }

  error(message: string, error?: Error | any): void {
    logger.error(this.formatMessage(message), error);
  }

  warn(message: string, meta?: any): void {
    logger.warn(this.formatMessage(message), meta);
  }

  debug(message: string, meta?: any): void {
    logger.debug(this.formatMessage(message), meta);
  }

  verbose(message: string, meta?: any): void {
    logger.verbose(this.formatMessage(message), meta);
  }
}

// Always write logs to file for debugging
const logDir = process.env.LOG_DIR || 'F:]Development]Projects]ProjectAra]typescript-mcp]logs';
logger.add(
  new winston.transports.File({
    filename: `${logDir}/error.log`,
    level: 'error',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  }),
);
logger.add(
  new winston.transports.File({
    filename: `${logDir}/combined.log`,
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  }),
);
