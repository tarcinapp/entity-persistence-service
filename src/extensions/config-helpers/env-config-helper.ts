import {BindingKey} from '@loopback/core';

/**
 * Case-insensitive, union-aware configuration helper for environment variables.
 *
 * Usage:
 *   const configHelper = EnvConfigHelper.getInstance();
 *   const value = configHelper.get(['ENTITY_KINDS', 'entity_kinds', 'Entity_Kinds'], 'default');
 */
export const EnvConfigHelperBindings = {
  CONFIG_READER: BindingKey.create<EnvConfigHelper>('extensions.env-config-helper'),
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
  public get(keys: string | string[], defaultValue?: string): string | undefined {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const key of keyList) {
      const val = this.envMap.get(key.toLowerCase());
      if (val !== undefined) return val;
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
  // Idempotency config getters
  get IDEMPOTENCY_ENTITY(): string | undefined {
    return this.get(['IDEMPOTENCY_ENTITY', 'idempotency_entity']);
  }
  get IDEMPOTENCY_LIST(): string | undefined {
    return this.get(['IDEMPOTENCY_LIST', 'idempotency_list']);
  }
  get IDEMPOTENCY_ENTITY_REACTION(): string | undefined {
    return this.get(['IDEMPOTENCY_ENTITY_REACTION', 'idempotency_entity_reaction']);
  }
  get IDEMPOTENCY_LIST_REACTION(): string | undefined {
    return this.get(['IDEMPOTENCY_LIST_REACTION', 'idempotency_list_reaction']);
  }
  get IDEMPOTENCY_LIST_ENTITY_REL(): string | undefined {
    return this.get(['IDEMPOTENCY_LIST_ENTITY_REL', 'idempotency_list_entity_rel']);
  }

  getIdempotencyEntityForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `IDEMPOTENCY_ENTITY_FOR_${kind.toUpperCase()}`,
      `idempotency_entity_for_${kind}`
    ]);
  }
  getIdempotencyListForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `IDEMPOTENCY_LIST_FOR_${kind.toUpperCase()}`,
      `idempotency_list_for_${kind}`
    ]);
  }
  getIdempotencyEntityReactionForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `IDEMPOTENCY_ENTITY_REACTION_FOR_${kind.toUpperCase()}`,
      `idempotency_entity_reaction_for_${kind}`
    ]);
  }
  getIdempotencyListReactionForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `IDEMPOTENCY_LIST_REACTION_FOR_${kind.toUpperCase()}`,
      `idempotency_list_reaction_for_${kind}`
    ]);
  }
  getIdempotencyListEntityRelForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `IDEMPOTENCY_LIST_ENTITY_REL_FOR_${kind.toUpperCase()}`,
      `idempotency_list_entity_rel_for_${kind}`
    ]);
  }
  get NODE_ENV(): string | undefined {
    return this.get(['NODE_ENV', 'node_env']);
  }
  get PORT(): number | undefined {
    const val = this.get(['PORT', 'port']);
    return val ? Number(val) : undefined;
  }

  get HOST(): string | undefined {
    return this.get(['HOST', 'host']);
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
    return this.get(['COLLECTION_ENTITY_REACTIONS', 'collection_entity_reactions']);
  }
  get COLLECTION_LIST_REACTIONS(): string | undefined {
    return this.get(['COLLECTION_LIST_REACTIONS', 'collection_list_reactions']);
  }
  get COLLECTION_LIST_ENTITY_REL(): string | undefined {
    return this.get(['COLLECTION_LIST_ENTITY_REL', 'collection_list_entity_rel']);
  }
  get ENTITY_KINDS(): string[] {
    const val = this.get(['ENTITY_KINDS', 'entity_kinds']);
    return val ? val.split(',').map(v => v.trim()) : [];
  }
  get LIST_KINDS(): string[] {
    const val = this.get(['LIST_KINDS', 'list_kinds']);
    return val ? val.split(',').map(v => v.trim()) : [];
  }
  get LIST_ENTITY_REL_KINDS(): string[] {
    const val = this.get(['LIST_ENTITY_REL_KINDS', 'list_entity_rel_kinds']);
    return val ? val.split(',').map(v => v.trim()) : [];
  }
  get ENTITY_REACTION_KINDS(): string[] {
    const val = this.get(['ENTITY_REACTION_KINDS', 'entity_reaction_kinds']);
    return val ? val.split(',').map(v => v.trim()) : [];
  }
  get LIST_REACTION_KINDS(): string[] {
    const val = this.get(['LIST_REACTION_KINDS', 'list_reaction_kinds']);
    return val ? val.split(',').map(v => v.trim()) : [];
  }
  get DEFAULT_ENTITY_KIND(): string | undefined {
    return this.get(['DEFAULT_ENTITY_KIND', 'default_entity_kind']);
  }
  get DEFAULT_LIST_KIND(): string | undefined {
    return this.get(['DEFAULT_LIST_KIND', 'default_list_kind']);
  }
  get DEFAULT_RELATION_KIND(): string | undefined {
    return this.get(['DEFAULT_RELATION_KIND', 'default_relation_kind']);
  }
  get DEFAULT_ENTITY_REACTION_KIND(): string | undefined {
    return this.get(['DEFAULT_ENTITY_REACTION_KIND', 'default_entity_reaction_kind']);
  }
  get DEFAULT_LIST_REACTION_KIND(): string | undefined {
    return this.get(['DEFAULT_LIST_REACTION_KIND', 'default_list_reaction_kind']);
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
    return this.get(['ENTITY_REACTION_UNIQUENESS', 'entity_reaction_uniqueness']);
  }
  get LIST_REACTION_UNIQUENESS(): string | undefined {
    return this.get(['LIST_REACTION_UNIQUENESS', 'list_reaction_uniqueness']);
  }
  get AUTOAPPROVE_ENTITY(): boolean {
    return this.get(['AUTOAPPROVE_ENTITY', 'autoapprove_entity']) === 'true';
  }
  get AUTOAPPROVE_LIST(): boolean {
    return this.get(['AUTOAPPROVE_LIST', 'autoapprove_list']) === 'true';
  }
  get AUTOAPPROVE_ENTITY_REACTION(): boolean {
    return this.get(['AUTOAPPROVE_ENTITY_REACTION', 'autoapprove_entity_reaction']) === 'true';
  }
  get AUTOAPPROVE_LIST_REACTION(): boolean {
    return this.get(['AUTOAPPROVE_LIST_REACTION', 'autoapprove_list_reaction']) === 'true';
  }
  get VISIBILITY_ENTITY(): string | undefined {
    return this.get(['VISIBILITY_ENTITY', 'visibility_entity']);
  }
  get VISIBILITY_LIST(): string | undefined {
    return this.get(['VISIBILITY_LIST', 'visibility_list']);
  }
  get VISIBILITY_ENTITY_REACTION(): string | undefined {
    return this.get(['VISIBILITY_ENTITY_REACTION', 'visibility_entity_reaction']);
  }
  get VISIBILITY_LIST_REACTION(): string | undefined {
    return this.get(['VISIBILITY_LIST_REACTION', 'visibility_list_reaction']);
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
    const val = this.get(['RESPONSE_LIMIT_LIST_ENTITY_REL', 'response_limit_list_entity_rel']);
    return val ? Number(val) : undefined;
  }
  get RESPONSE_LIMIT_ENTITY_REACTION(): number | undefined {
    const val = this.get(['RESPONSE_LIMIT_ENTITY_REACTION', 'response_limit_entity_reaction']);
    return val ? Number(val) : undefined;
  }
  get RESPONSE_LIMIT_LIST_REACTION(): number | undefined {
    const val = this.get(['RESPONSE_LIMIT_LIST_REACTION', 'response_limit_list_reaction']);
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
    return this.get(['ENTITY_REACTION_RECORD_LIMITS', 'entity_reaction_record_limits']);
  }
  get LIST_REACTION_RECORD_LIMITS(): string | undefined {
    return this.get(['LIST_REACTION_RECORD_LIMITS', 'list_reaction_record_limits']);
  }

  // Record limits config getters
  get RECORD_LIMIT_ENTITY_COUNT(): string | undefined {
    return this.get(['RECORD_LIMIT_ENTITY_COUNT', 'record_limit_entity_count']);
  }
  getRecordLimitEntityCountForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `RECORD_LIMIT_ENTITY_COUNT_FOR_${kind.toUpperCase()}`,
      `record_limit_entity_count_for_${kind}`
    ]);
  }
  get RECORD_LIMIT_ENTITY_SCOPE(): string | undefined {
    return this.get(['RECORD_LIMIT_ENTITY_SCOPE', 'record_limit_entity_scope']);
  }
  getRecordLimitEntityScopeForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `RECORD_LIMIT_ENTITY_SCOPE_FOR_${kind.toUpperCase()}`,
      `record_limit_entity_scope_for_${kind}`
    ]);
  }

  get RECORD_LIMIT_LIST_COUNT(): string | undefined {
    return this.get(['RECORD_LIMIT_LIST_COUNT', 'record_limit_list_count']);
  }
  getRecordLimitListCountForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `RECORD_LIMIT_LIST_COUNT_FOR_${kind.toUpperCase()}`,
      `record_limit_list_count_for_${kind}`
    ]);
  }
  get RECORD_LIMIT_LIST_SCOPE(): string | undefined {
    return this.get(['RECORD_LIMIT_LIST_SCOPE', 'record_limit_list_scope']);
  }
  getRecordLimitListScopeForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `RECORD_LIMIT_LIST_SCOPE_FOR_${kind.toUpperCase()}`,
      `record_limit_list_scope_for_${kind}`
    ]);
  }

  get RECORD_LIMIT_LIST_ENTITY_COUNT(): string | undefined {
    return this.get(['RECORD_LIMIT_LIST_ENTITY_COUNT', 'record_limit_list_entity_count']);
  }
  getRecordLimitListEntityCountForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `RECORD_LIMIT_LIST_ENTITY_COUNT_FOR_${kind.toUpperCase()}`,
      `record_limit_list_entity_count_for_${kind}`
    ]);
  }

  get RECORD_LIMIT_LIST_ENTITY_REL_COUNT(): string | undefined {
    return this.get(['RECORD_LIMIT_LIST_ENTITY_REL_COUNT', 'record_limit_list_entity_rel_count']);
  }
  getRecordLimitListEntityRelCountForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `RECORD_LIMIT_LIST_ENTITY_REL_COUNT_FOR_${kind.toUpperCase()}`,
      `record_limit_list_entity_rel_count_for_${kind}`
    ]);
  }
  get RECORD_LIMIT_LIST_ENTITY_REL_SCOPE(): string | undefined {
    return this.get(['RECORD_LIMIT_LIST_ENTITY_REL_SCOPE', 'record_limit_list_entity_rel_scope']);
  }
  getRecordLimitListEntityRelScopeForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `RECORD_LIMIT_LIST_ENTITY_REL_SCOPE_FOR_${kind.toUpperCase()}`,
      `record_limit_list_entity_rel_scope_for_${kind}`
    ]);
  }
  // Uniqueness config getters
  get UNIQUENESS_ENTITY_FIELDS(): string | undefined {
    return this.get(['UNIQUENESS_ENTITY_FIELDS', 'uniqueness_entity_fields']);
  }
  getUniquenessEntityFieldsForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `UNIQUENESS_ENTITY_FIELDS_FOR_${kind.toUpperCase()}`,
      `uniqueness_entity_fields_for_${kind}`
    ]);
  }
  get UNIQUENESS_ENTITY_SCOPE(): string | undefined {
    return this.get(['UNIQUENESS_ENTITY_SCOPE', 'uniqueness_entity_scope']);
  }
  getUniquenessEntityScopeForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `UNIQUENESS_ENTITY_SCOPE_FOR_${kind.toUpperCase()}`,
      `uniqueness_entity_scope_for_${kind}`
    ]);
  }

  get UNIQUENESS_LIST_FIELDS(): string | undefined {
    return this.get(['UNIQUENESS_LIST_FIELDS', 'uniqueness_list_fields']);
  }
  getUniquenessListFieldsForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `UNIQUENESS_LIST_FIELDS_FOR_${kind.toUpperCase()}`,
      `uniqueness_list_fields_for_${kind}`
    ]);
  }
  get UNIQUENESS_LIST_SCOPE(): string | undefined {
    return this.get(['UNIQUENESS_LIST_SCOPE', 'uniqueness_list_scope']);
  }
  getUniquenessListScopeForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `UNIQUENESS_LIST_SCOPE_FOR_${kind.toUpperCase()}`,
      `uniqueness_list_scope_for_${kind}`
    ]);
  }

  get UNIQUENESS_LIST_ENTITY_REL_FIELDS(): string | undefined {
    return this.get(['UNIQUENESS_LIST_ENTITY_REL_FIELDS', 'uniqueness_list_entity_rel_fields']);
  }
  getUniquenessListEntityRelFieldsForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `UNIQUENESS_LIST_ENTITY_REL_FIELDS_FOR_${kind.toUpperCase()}`,
      `uniqueness_list_entity_rel_fields_for_${kind}`
    ]);
  }
  get UNIQUENESS_LIST_ENTITY_REL_SCOPE(): string | undefined {
    return this.get(['UNIQUENESS_LIST_ENTITY_REL_SCOPE', 'uniqueness_list_entity_rel_scope']);
  }
  getUniquenessListEntityRelScopeForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `UNIQUENESS_LIST_ENTITY_REL_SCOPE_FOR_${kind.toUpperCase()}`,
      `uniqueness_list_entity_rel_scope_for_${kind}`
    ]);
  }
  // Autoapprove config getters
  getAutoApproveEntityForKind(kind?: string): boolean | undefined {
    if (!kind) return undefined;
    const val = this.get([
      `AUTOAPPROVE_ENTITY_FOR_${kind.toUpperCase()}`,
      `autoapprove_entity_for_${kind}`
    ]);
    if (val === undefined) return undefined;
    return val === 'true';
  }
  getAutoApproveListForKind(kind?: string): boolean | undefined {
    if (!kind) return undefined;
    const val = this.get([
      `AUTOAPPROVE_LIST_FOR_${kind.toUpperCase()}`,
      `autoapprove_list_for_${kind}`
    ]);
    if (val === undefined) return undefined;
    return val === 'true';
  }
  getAutoApproveListEntityRelationsForKind(kind?: string): boolean | undefined {
    if (!kind) return undefined;
    const val = this.get([
      `AUTOAPPROVE_LIST_ENTITY_RELATIONS_FOR_${kind.toUpperCase()}`,
      `autoapprove_list_entity_relations_for_${kind}`
    ]);
    if (val === undefined) return undefined;
    return val === 'true';
  }
  get AUTOAPPROVE_LIST_ENTITY_RELATIONS(): boolean | undefined {
    const val = this.get(['AUTOAPPROVE_LIST_ENTITY_RELATIONS', 'autoapprove_list_entity_relations']);
    if (val === undefined) return undefined;
    return val === 'true';
  }
  getAutoApproveEntityReactionForKind(kind?: string): boolean | undefined {
    if (!kind) return undefined;
    const val = this.get([
      `AUTOAPPROVE_ENTITY_REACTION_FOR_${kind.toUpperCase()}`,
      `autoapprove_entity_reaction_for_${kind}`
    ]);
    if (val === undefined) return undefined;
    return val === 'true';
  }
  getAutoApproveListReactionForKind(kind?: string): boolean | undefined {
    if (!kind) return undefined;
    const val = this.get([
      `AUTOAPPROVE_LIST_REACTION_FOR_${kind.toUpperCase()}`,
      `autoapprove_list_reaction_for_${kind}`
    ]);
    if (val === undefined) return undefined;
    return val === 'true';
  }
  // Add more strongly-typed getters as needed for new env variables
  // Visibility config getters
  getVisibilityEntityForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `VISIBILITY_ENTITY_FOR_${kind.toUpperCase()}`,
      `visibility_entity_for_${kind}`
    ]);
  }
  getVisibilityListForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `VISIBILITY_LIST_FOR_${kind.toUpperCase()}`,
      `visibility_list_for_${kind}`
    ]);
  }
  getVisibilityEntityReactionForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `VISIBILITY_ENTITY_REACTION_FOR_${kind.toUpperCase()}`,
      `visibility_entity_reaction_for_${kind}`
    ]);
  }
  getVisibilityListReactionForKind(kind?: string): string | undefined {
    if (!kind) return undefined;
    return this.get([
      `VISIBILITY_LIST_REACTION_FOR_${kind.toUpperCase()}`,
      `visibility_list_reaction_for_${kind}`
    ]);
  }
}
