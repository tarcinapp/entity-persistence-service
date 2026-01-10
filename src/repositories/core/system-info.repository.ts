import { injectable, BindingScope } from '@loopback/core';

/**
 * Configuration response model representing all environment-based settings.
 */
export interface SystemConfiguration {
  // Environment
  nodeEnv?: string;

  // Logging
  logging: {
    level?: string;
    format?: string;
    timestamp?: string;
    service?: string;
    requestIdHeader?: string;
  };

  // Server Binding
  server: {
    host?: string;
    port?: number;
  };

  // Database
  database: {
    url?: string;
    database?: string;
    host?: string;
    port?: string;
    user?: string;
    // Password intentionally excluded for security
  };

  // Collections
  collections: {
    entity?: string;
    list?: string;
    entityReactions?: string;
    listReactions?: string;
    listEntityRel?: string;
  };

  // Lookup Constraints
  lookupConstraints: {
    entity?: string;
    list?: string;
    entityReaction?: string;
    listReaction?: string;
  };

  // Allowed Kinds
  allowedKinds: {
    entity: string[];
    list: string[];
    listEntityRel: string[];
    entityReaction: string[];
    listReaction: string[];
  };

  // Default Kinds
  defaultKinds: {
    entity?: string;
    list?: string;
    relation?: string;
    entityReaction?: string;
    listReaction?: string;
  };

  // Uniqueness Constraints
  uniqueness: {
    entity?: string;
    list?: string;
    relation?: string;
    entityReaction?: string;
    listReaction?: string;
  };

  // Auto-Approve Settings
  autoApprove: {
    entity: boolean;
    list: boolean;
    entityReaction: boolean;
    listReaction: boolean;
    listEntityRelations?: boolean;
  };

  // Visibility Settings
  visibility: {
    entity?: string;
    list?: string;
    entityReaction?: string;
    listReaction?: string;
  };

  // Response Limits
  responseLimits: {
    entity?: number;
    list?: number;
    listEntityRel?: number;
    entityReaction?: number;
    listReaction?: number;
  };

  // Record Limits
  recordLimits: {
    entity?: string;
    list?: string;
    relation?: string;
    entityReaction?: string;
    listReaction?: string;
  };

  // Idempotency
  idempotency: {
    entity?: string;
    list?: string;
    entityReaction?: string;
    listReaction?: string;
    listEntityRel?: string;
  };
}

/**
 * System info response model containing uptime and configuration.
 */
export interface SystemInfo {
  uptime: {
    seconds: number;
    formatted: string;
  };
  startedAt: string;
  currentTime: string;
  configuration: SystemConfiguration;
}

/**
 * SystemInfoRepository - Repository for retrieving system information and configuration.
 *
 * This repository provides access to:
 * - System uptime (how long the application has been running)
 * - All environment-based configuration settings
 *
 * Note: Sensitive information like database passwords are intentionally excluded
 * from the configuration output.
 */
@injectable({ scope: BindingScope.SINGLETON })
export class SystemInfoRepository {
  private readonly startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Get the system uptime in seconds.
   */
  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Format uptime as a human-readable string.
   */
  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Get the current system configuration from environment variables.
   * Sensitive values like passwords are excluded.
   */
  getConfiguration(): SystemConfiguration {
    return {
      nodeEnv: process.env.NODE_ENV,

      logging: {
        level: process.env.LOG_LEVEL,
        format: process.env.LOG_FORMAT,
        timestamp: process.env.LOG_TIMESTAMP,
        service: process.env.LOG_SERVICE,
        requestIdHeader: process.env.REQUEST_ID_HEADER,
      },

      server: {
        host: process.env.HOST,
        port: process.env.PORT ? Number(process.env.PORT) : undefined,
      },

      database: {
        url: this.maskSensitiveUrl(process.env.MONGODB_URL),
        database: process.env.MONGODB_DATABASE,
        host: process.env.MONGODB_HOST,
        port: process.env.MONGODB_PORT,
        user: process.env.MONGODB_USER,
        // Password intentionally excluded
      },

      collections: {
        entity: process.env.COLLECTION_ENTITY,
        list: process.env.COLLECTION_LIST,
        entityReactions: process.env.COLLECTION_ENTITY_REACTIONS,
        listReactions: process.env.COLLECTION_LIST_REACTIONS,
        listEntityRel: process.env.COLLECTION_LIST_ENTITY_REL,
      },

      lookupConstraints: {
        entity: process.env.ENTITY_LOOKUP_CONSTRAINT,
        list: process.env.LIST_LOOKUP_CONSTRAINT,
        entityReaction: process.env.ENTITY_REACTION_LOOKUP_CONSTRAINT,
        listReaction: process.env.LIST_REACTION_LOOKUP_CONSTRAINT,
      },

      allowedKinds: {
        entity: this.parseCommaSeparated(process.env.ENTITY_KINDS),
        list: this.parseCommaSeparated(process.env.LIST_KINDS),
        listEntityRel: this.parseCommaSeparated(process.env.LIST_ENTITY_REL_KINDS),
        entityReaction: this.parseCommaSeparated(process.env.ENTITY_REACTION_KINDS),
        listReaction: this.parseCommaSeparated(process.env.LIST_REACTION_KINDS),
      },

      defaultKinds: {
        entity: process.env.DEFAULT_ENTITY_KIND,
        list: process.env.DEFAULT_LIST_KIND,
        relation: process.env.DEFAULT_RELATION_KIND,
        entityReaction: process.env.DEFAULT_ENTITY_REACTION_KIND,
        listReaction: process.env.DEFAULT_LIST_REACTION_KIND,
      },

      uniqueness: {
        entity: process.env.ENTITY_UNIQUENESS,
        list: process.env.LIST_UNIQUENESS,
        relation: process.env.RELATION_UNIQUENESS,
        entityReaction: process.env.ENTITY_REACTION_UNIQUENESS,
        listReaction: process.env.LIST_REACTION_UNIQUENESS,
      },

      autoApprove: {
        entity: process.env.AUTOAPPROVE_ENTITY === 'true',
        list: process.env.AUTOAPPROVE_LIST === 'true',
        entityReaction: process.env.AUTOAPPROVE_ENTITY_REACTION === 'true',
        listReaction: process.env.AUTOAPPROVE_LIST_REACTION === 'true',
        listEntityRelations:
          process.env.AUTOAPPROVE_LIST_ENTITY_RELATIONS === 'true',
      },

      visibility: {
        entity: process.env.VISIBILITY_ENTITY,
        list: process.env.VISIBILITY_LIST,
        entityReaction: process.env.VISIBILITY_ENTITY_REACTION,
        listReaction: process.env.VISIBILITY_LIST_REACTION,
      },

      responseLimits: {
        entity: this.parseNumber(process.env.RESPONSE_LIMIT_ENTITY),
        list: this.parseNumber(process.env.RESPONSE_LIMIT_LIST),
        listEntityRel: this.parseNumber(process.env.RESPONSE_LIMIT_LIST_ENTITY_REL),
        entityReaction: this.parseNumber(process.env.RESPONSE_LIMIT_ENTITY_REACTION),
        listReaction: this.parseNumber(process.env.RESPONSE_LIMIT_LIST_REACTION),
      },

      recordLimits: {
        entity: process.env.ENTITY_RECORD_LIMITS,
        list: process.env.LIST_RECORD_LIMITS,
        relation: process.env.RELATION_RECORD_LIMITS,
        entityReaction: process.env.ENTITY_REACTION_RECORD_LIMITS,
        listReaction: process.env.LIST_REACTION_RECORD_LIMITS,
      },

      idempotency: {
        entity: process.env.IDEMPOTENCY_ENTITY,
        list: process.env.IDEMPOTENCY_LIST,
        entityReaction: process.env.IDEMPOTENCY_ENTITY_REACTION,
        listReaction: process.env.IDEMPOTENCY_LIST_REACTION,
        listEntityRel: process.env.IDEMPOTENCY_LIST_ENTITY_REL,
      },
    };
  }

  /**
   * Get complete system info including uptime and configuration.
   */
  getSystemInfo(): SystemInfo {
    const uptimeSeconds = this.getUptimeSeconds();

    return {
      uptime: {
        seconds: uptimeSeconds,
        formatted: this.formatUptime(uptimeSeconds),
      },
      startedAt: this.startTime.toISOString(),
      currentTime: new Date().toISOString(),
      configuration: this.getConfiguration(),
    };
  }

  /**
   * Parse a comma-separated string into an array.
   */
  private parseCommaSeparated(value?: string): string[] {
    if (!value) return [];
    return value.split(',').map((v) => v.trim());
  }

  /**
   * Parse a string to number, returning undefined if invalid.
   */
  private parseNumber(value?: string): number | undefined {
    if (!value) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Mask sensitive parts of a MongoDB URL (password).
   */
  private maskSensitiveUrl(url?: string): string | undefined {
    if (!url) return undefined;

    try {
      // Mask password in MongoDB URL
      // Format: mongodb+srv://user:password@host or mongodb://user:password@host
      return url.replace(
        /(:\/\/[^:]+:)([^@]+)(@)/,
        '$1****$3',
      );
    } catch {
      return '****';
    }
  }
}
