/**
 * Logger service
 */
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'codesight-mcp' },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, service }) => {
          return `[${timestamp}] ${level.toUpperCase()}: ${message} (${service})`;
        })
      )
    })
  ]
});

// Always write logs to file for debugging
const logDir = process.env.LOG_DIR || 'F:\\Development\\Projects\\ProjectAra\\typescript-mcp\\logs';
logger.add(new winston.transports.File({
  filename: `${logDir}/error.log`,
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
}));
logger.add(new winston.transports.File({
  filename: `${logDir}/combined.log`,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
}));