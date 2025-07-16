export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

export class Logger {
  private static currentLevel: LogLevel = LogLevel.INFO;
  private static isDevelopment = process.env.NODE_ENV !== 'production';

  static setLevel(level: LogLevel) {
    Logger.currentLevel = level;
  }

  static getLevel(): LogLevel {
    return Logger.currentLevel;
  }

  private static shouldLog(level: LogLevel): boolean {
    return level >= Logger.currentLevel;
  }

  private static formatMessage(level: LogLevel, component: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const emoji = Logger.getLevelEmoji(level);

    let formattedMessage = `[${timestamp}] ${emoji} ${levelStr} [${component}] ${message}`;

    if (data !== undefined) {
      formattedMessage += ` | ${typeof data === 'string' ? data : JSON.stringify(data)}`;
    }

    return formattedMessage;
  }

  private static getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return '📝';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      default:
        return '📝';
    }
  }

  private static log(level: LogLevel, component: string, message: string, data?: any) {
    if (!Logger.shouldLog(level)) return;

    const formattedMessage = Logger.formatMessage(level, component, message, data);

    switch (level) {
      case LogLevel.DEBUG:
        if (Logger.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }
  }

  static debug(component: string, message: string, data?: any) {
    Logger.log(LogLevel.DEBUG, component, message, data);
  }

  static info(component: string, message: string, data?: any) {
    Logger.log(LogLevel.INFO, component, message, data);
  }

  static warn(component: string, message: string, data?: any) {
    Logger.log(LogLevel.WARN, component, message, data);
  }

  static error(component: string, message: string, data?: any) {
    Logger.log(LogLevel.ERROR, component, message, data);
  }

  static success(component: string, message: string, data?: any) {
    if (!Logger.shouldLog(LogLevel.INFO)) return;

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ✅ INFO [${component}] ${message}`;
    console.info(formattedMessage + (data ? ` | ${typeof data === 'string' ? data : JSON.stringify(data)}` : ''));
  }

  static progress(component: string, message: string, data?: any) {
    if (!Logger.shouldLog(LogLevel.INFO)) return;

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] 🔄 INFO [${component}] ${message}`;
    console.info(formattedMessage + (data ? ` | ${typeof data === 'string' ? data : JSON.stringify(data)}` : ''));
  }

  static performance(component: string, message: string, timeMs: number) {
    if (!Logger.shouldLog(LogLevel.INFO)) return;

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ⏱️ INFO [${component}] ${message} (${timeMs}ms)`;
    console.info(formattedMessage);
  }
}

// 根据环境变量设置默认日志级别
const logLevel = process.env.LOG_LEVEL?.toLowerCase();
switch (logLevel) {
  case 'debug':
    Logger.setLevel(LogLevel.DEBUG);
    break;
  case 'info':
    Logger.setLevel(LogLevel.INFO);
    break;
  case 'warn':
    Logger.setLevel(LogLevel.WARN);
    break;
  case 'error':
    Logger.setLevel(LogLevel.ERROR);
    break;
  case 'silent':
    Logger.setLevel(LogLevel.SILENT);
    break;
  default:
    Logger.setLevel(process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO);
}
