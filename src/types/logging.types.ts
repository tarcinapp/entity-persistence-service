export interface LoggingConfig {
  level: string;
  format: 'json' | 'text';
  timestamp: boolean;
  service: string;
  environment: string;
}
