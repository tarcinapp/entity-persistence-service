declare module 'winston' {
  export interface Logger {
    error(message: string, ...meta: any[]): void;
    warn(message: string, ...meta: any[]): void;
    info(message: string, ...meta: any[]): void;
    debug(message: string, ...meta: any[]): void;
    log(level: string, message: string, ...meta: any[]): void;
  }

  export interface Format {
    timestamp(): Format;
    json(): Format;
    printf(format: (info: any) => string): Format;
    combine(...formats: Format[]): Format;
  }

  export interface Transport {
    format?: Format;
  }

  export interface ConsoleTransport extends Transport {
    new (options?: { format?: Format }): ConsoleTransport;
  }

  export interface Transports {
    Console: ConsoleTransport;
  }

  export interface LoggerOptions {
    level?: string;
    format?: Format;
    defaultMeta?: Record<string, any>;
    transports?: Transport[];
  }

  export const format: Format;
  export const transports: Transports;
  export function createLogger(options: LoggerOptions): Logger;
}
