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
  defaultMeta: { service: 'code-intelligence-mcp' },
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

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({ filename: 'error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'combined.log' }));
}