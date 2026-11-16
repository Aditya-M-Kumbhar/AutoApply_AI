import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom console format for local development
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        process.env.NODE_ENV === 'production' ? json() : devFormat
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: json()
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: json()
    })
  ]
});

export default logger;
