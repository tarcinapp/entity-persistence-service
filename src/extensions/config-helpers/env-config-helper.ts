import { BindingKey } from '@loopback/core';

/**
 * Case-insensitive, union-aware configuration helper for environment variables.
 *
 * Usage:
 *   const configHelper = EnvConfigHelper.getInstance();
 *   const value = configHelper.get(['ENTITY_KINDS', 'entity_kinds', 'Entity_Kinds'], 'default');
 */
export const EnvConfigHelperBindings = {
  CONFIG_READER: BindingKey.create<EnvConfigHelper>(
    'extensions.env-config-helper',
  ),
} as const;

export class EnvConfigHelper {
  private static instance: EnvConfigHelper;

  private envMap: Map<string, string>;

  private constructor() {
    this.envMap = new Map();
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        this.envMap.set(key.toLowerCase(), value);
      }
    }
  }

  public static getInstance(): EnvConfigHelper {
    if (!EnvConfigHelper.instance) {
      EnvConfigHelper.instance = new EnvConfigHelper();
    }

    return EnvConfigHelper.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static reset(): void {
    EnvConfigHelper.instance = undefined as any;
  }

  /**
   * Get a config value by key or keys (union/fallback), case-insensitive.
   * @param keys string or array of strings (checked in order)
   * @param defaultValue returned if no key is found
   */
  public get(
    keys: string | string[],
    defaultValue?: string,
  ): string | undefined {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const key of keyList) {
      const val = this.envMap.get(key.toLowerCase());
      if (val !== undefined) {
        return val;
      }
    }

    return defaultValue;
  }

  /**
   * For testing: set a config value (does not affect process.env)
   */
  public set(key: string, value: string): void {
    this.envMap.set(key.toLowerCase(), value);
  }

  // Strongly-typed getters for known environment variables
  // Lookup constraint config getters
  get ENTITY_LOOKUP_CONSTRAINT(): string | undefined {
    return this.get(['ENTITY_LOOKUP_CONSTRAINT', 'entity_lookup_constraint']);
  }
  get LIST_LOOKUP_CONSTRAINT(): string | undefined {
    return this.get(['LIST_LOOKUP_CONSTRAINT', 'list_lookup_constraint']);
  }
  get ENTITY_REACTION_LOOKUP_CONSTRAINT(): string | undefined {
    return this.get([
      'ENTITY_REACTION_LOOKUP_CONSTRAINT',
      'entity_reaction_lookup_constraint',
    ]);
  }
  get LIST_REACTION_LOOKUP_CONSTRAINT(): string | undefined {
    return this.get([
      'LIST_REACTION_LOOKUP_CONSTRAINT',
      'list_reaction_lookup_constraint',
    ]);
  }

  get NODE_ENV(): string | undefined {
    return this.get(['NODE_ENV', 'node_env']);
  }
  get LOG_LEVEL(): string | undefined {
    return this.get(['LOG_LEVEL', 'log_level']);
  }
  get LOG_FORMAT(): string | undefined {
    return this.get(['LOG_FORMAT', 'log_format']);
  }
  get LOG_TIMESTAMP(): string | undefined {
    return this.get(['LOG_TIMESTAMP', 'log_timestamp']);
  }
  get LOG_SERVICE(): string | undefined {
    return this.get(['LOG_SERVICE', 'log_service']);
  }
  get LOG_REQUEST_BODY(): string | undefined {
    return this.get(['LOG_REQUEST_BODY', 'log_request_body']);
  }
  get REQUEST_ID_HEADER(): string | undefined {
    return (
      this.get(['REQUEST_ID_HEADER', 'request_id_header']) ?? 'x-request-id'
    );
  }
  get PORT(): number | undefined {
    const val = this.get(['PORT', 'port']);

    return val ? Number(val) : 3000;
  }

  get HOST(): string | undefined {
    return this.get(['HOST', 'host']) ?? 'localhost';
  }
  get MONGODB_URL(): string | undefined {
    return this.get(['MONGODB_URL', 'mongodb_url']);
  }
  get MONGODB_DATABASE(): string | undefined {
    return this.get(['MONGODB_DATABASE', 'mongodb_database']);
  }
  get MONGODB_HOST(): string | undefined {
    return this.get(['MONGODB_HOST', 'mongodb_host']);
  }
  get MONGODB_PORT(): string | undefined {
    return this.get(['MONGODB_PORT', 'mongodb_port']);
  }
  get MONGODB_USER(): string | undefined {
    return this.get(['MONGODB_USER', 'mongodb_user']);
  }
  get MONGODB_PASSWORD(): string | undefined {
    return this.get(['MONGODB_PASSWORD', 'mongodb_password']);
  }
  get COLLECTION_ENTITY(): string | undefined {
    return this.get(['COLLECTION_ENTITY', 'collection_entity']);
  }
  get COLLECTION_LIST(): string | undefined {
    return this.get(['COLLECTION_LIST', 'collection_list']);
  }
  get COLLECTION_ENTITY_REACTIONS(): string | undefined {
    return this.get([
      'COLLECTION_ENTITY_REACTIONS',
      'collection_entity_reactions',
    ]);
  }
  get COLLECTION_LIST_REACTIONS(): string | undefined {
    return this.get(['COLLECTION_LIST_REACTIONS', 'collection_list_reactions']);
  }
  get COLLECTION_LIST_ENTITY_REL(): string | undefined {
    return this.get([
      'COLLECTION_LIST_ENTITY_REL',
      'collection_list_entity_rel',
    ]);
  }
  get ENTITY_KINDS(): string[] {
    const val = this.get(['ENTITY_KINDS', 'entity_kinds']);

    return val ? val.split(',').map((k) => k.trim()) : [];
  }
  get LIST_KINDS(): string[] {
    const val = this.get(['LIST_KINDS', 'list_kinds']);

    return val ? val.split(',').map((k) => k.trim()) : [];
  }
  get LIST_ENTITY_REL_KINDS(): string[] {
    const val = this.get(['LIST_ENTITY_REL_KINDS', 'list_entity_rel_kinds']);

    return val ? val.split(',').map((k) => k.trim()) : [];
  }
  get ENTITY_REACTION_KINDS(): string[] {
    const val = this.get(['ENTITY_REACTION_KINDS', 'entity_reaction_kinds']);

    return val ? val.split(',').map((k) => k.trim()) : [];
  }
  get LIST_REACTION_KINDS(): string[] {
    const val = this.get(['LIST_REACTION_KINDS', 'list_reaction_kinds']);

    return val ? val.split(',').map((k) => k.trim()) : [];
  }
  get ENTITY_UNIQUENESS(): string | undefined {
    return this.get(['ENTITY_UNIQUENESS', 'entity_uniqueness']);
  }
  get LIST_UNIQUENESS(): string | undefined {
    return this.get(['LIST_UNIQUENESS', 'list_uniqueness']);
  }
  get RELATION_UNIQUENESS(): string | undefined {
    return this.get(['RELATION_UNIQUENESS', 'relation_uniqueness']);
  }
  get ENTITY_REACTION_UNIQUENESS(): string | undefined {
    return this.get([
      'ENTITY_REACTION_UNIQUENESS',
      'entity_reaction_uniqueness',
    ]);
  }
  get LIST_REACTION_UNIQUENESS(): string | undefined {
    return this.get(['LIST_REACTION_UNIQUENESS', 'list_reaction_uniqueness']);
  }
  get RESPONSE_LIMIT_ENTITY(): number | undefined {
    const val = this.get(['RESPONSE_LIMIT_ENTITY', 'response_limit_entity']);

    return val ? Number(val) : undefined;
  }
  get RESPONSE_LIMIT_LIST(): number | undefined {
    const val = this.get(['RESPONSE_LIMIT_LIST', 'response_limit_list']);

    return val ? Number(val) : undefined;
  }
  get RESPONSE_LIMIT_LIST_ENTITY_REL(): number | undefined {
    const val = this.get([
      'RESPONSE_LIMIT_LIST_ENTITY_REL',
      'response_limit_list_entity_rel',
    ]);

    return val ? Number(val) : undefined;
  }
  get RESPONSE_LIMIT_ENTITY_REACTION(): number | undefined {
    const val = this.get([
      'RESPONSE_LIMIT_ENTITY_REACTION',
      'response_limit_entity_reaction',
    ]);

    return val ? Number(val) : undefined;
  }
  get RESPONSE_LIMIT_LIST_REACTION(): number | undefined {
    const val = this.get([
      'RESPONSE_LIMIT_LIST_REACTION',
      'response_limit_list_reaction',
    ]);

    return val ? Number(val) : undefined;
  }
  get ENTITY_RECORD_LIMITS(): string | undefined {
    return this.get(['ENTITY_RECORD_LIMITS', 'entity_record_limits']);
  }
  get LIST_RECORD_LIMITS(): string | undefined {
    return this.get(['LIST_RECORD_LIMITS', 'list_record_limits']);
  }
  get RELATION_RECORD_LIMITS(): string | undefined {
    return this.get(['RELATION_RECORD_LIMITS', 'relation_record_limits']);
  }
  get ENTITY_REACTION_RECORD_LIMITS(): string | undefined {
    return this.get([
      'ENTITY_REACTION_RECORD_LIMITS',
      'entity_reaction_record_limits',
    ]);
  }
  get LIST_REACTION_RECORD_LIMITS(): string | undefined {
    return this.get([
      'LIST_REACTION_RECORD_LIMITS',
      'list_reaction_record_limits',
    ]);
  }
}
