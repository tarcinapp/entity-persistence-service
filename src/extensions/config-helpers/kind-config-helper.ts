import { BindingKey } from '@loopback/core';
import slugify from 'slugify';
import { EnvConfigHelper } from './env-config-helper';

export const KindBindings = {
  CONFIG_READER: BindingKey.create<KindConfigurationReader>(
    'extensions.kind.configurationreader',
  ),
} as const;

export interface KindConfig {
  allowedKinds: string[];
}

export class KindConfiguration {
  private readonly entityConfig: KindConfig = {
    allowedKinds: ['entity'],
  };

  private readonly listConfig: KindConfig = {
    allowedKinds: ['list'],
  };

  private readonly relationConfig: KindConfig = {
    allowedKinds: ['relation'],
  };

  private readonly entityReactionConfig: KindConfig = {
    allowedKinds: ['entity-reaction'],
  };

  private readonly listReactionConfig: KindConfig = {
    allowedKinds: ['list-reaction'],
  };

  constructor() {
    this.loadConfigurations();
  }

  private loadConfigurations() {
    const env = EnvConfigHelper.getInstance();

    // Load entity kinds if specified
    if (env.ENTITY_KINDS.length > 0) {
      const kinds = env.ENTITY_KINDS;
      this.entityConfig.allowedKinds = [...new Set(kinds)];
    } else {
      // If no allowed kinds specified, allow all kinds
      this.entityConfig.allowedKinds = [];
    }

    // Load list kinds if specified
    if (env.LIST_KINDS.length > 0) {
      const kinds = env.LIST_KINDS;
      this.listConfig.allowedKinds = [...new Set(kinds)];
    } else {
      this.listConfig.allowedKinds = [];
    }

    // Load relation kinds if specified
    if (env.LIST_ENTITY_REL_KINDS.length > 0) {
      const kinds = env.LIST_ENTITY_REL_KINDS;
      this.relationConfig.allowedKinds = [...new Set(kinds)];
    } else {
      this.relationConfig.allowedKinds = [];
    }

    // Load entity reaction kinds if specified
    if (env.ENTITY_REACTION_KINDS.length > 0) {
      const kinds = env.ENTITY_REACTION_KINDS;
      this.entityReactionConfig.allowedKinds = [...new Set(kinds)];
    } else {
      this.entityReactionConfig.allowedKinds = [];
    }

    // Load list reaction kinds if specified
    if (env.LIST_REACTION_KINDS.length > 0) {
      const kinds = env.LIST_REACTION_KINDS;
      this.listReactionConfig.allowedKinds = [...new Set(kinds)];
    } else {
      this.listReactionConfig.allowedKinds = [];
    }
  }

  public getEntityConfig(): KindConfig {
    return this.entityConfig;
  }

  public getListConfig(): KindConfig {
    return this.listConfig;
  }

  public getRelationConfig(): KindConfig {
    return this.relationConfig;
  }

  public getEntityReactionConfig(): KindConfig {
    return this.entityReactionConfig;
  }

  public getListReactionConfig(): KindConfig {
    return this.listReactionConfig;
  }

  public isKindValid(kind: string, config: KindConfig): boolean {
    // If allowedKinds is empty, all kinds are valid
    if (config.allowedKinds.length === 0) {
      return true;
    }

    return config.allowedKinds.includes(kind);
  }
}

export class KindConfigurationReader {
  private kindConfig: KindConfiguration;

  constructor() {
    this.kindConfig = new KindConfiguration();
  }

  public get allowedKindsForEntities(): string[] {
    return this.kindConfig.getEntityConfig().allowedKinds;
  }

  public get allowedKindsForLists(): string[] {
    return this.kindConfig.getListConfig().allowedKinds;
  }

  public get allowedKindsForEntityListRelations(): string[] {
    return this.kindConfig.getRelationConfig().allowedKinds;
  }

  public get allowedKindsForEntityReactions(): string[] {
    return this.kindConfig.getEntityReactionConfig().allowedKinds;
  }

  public get allowedKindsForListReactions(): string[] {
    return this.kindConfig.getListReactionConfig().allowedKinds;
  }

  public isKindAcceptableForEntity(kind: string): boolean {
    return this.kindConfig.isKindValid(kind, this.kindConfig.getEntityConfig());
  }

  public isKindAcceptableForList(kind: string): boolean {
    return this.kindConfig.isKindValid(kind, this.kindConfig.getListConfig());
  }

  public isKindAcceptableForListEntityRelations(kind: string): boolean {
    return this.kindConfig.isKindValid(
      kind,
      this.kindConfig.getRelationConfig(),
    );
  }

  public isKindAcceptableForEntityReactions(kind: string): boolean {
    return this.kindConfig.isKindValid(
      kind,
      this.kindConfig.getEntityReactionConfig(),
    );
  }

  public isKindAcceptableForListReactions(kind: string): boolean {
    return this.kindConfig.isKindValid(
      kind,
      this.kindConfig.getListReactionConfig(),
    );
  }

  public validateKindFormat(kind: string): string | null {
    const slugKind: string = slugify(kind, {
      lower: true,
      strict: true,
    });

    return slugKind !== kind ? slugKind : null;
  }

  public validateKindValue(kind: string, config: KindConfig): boolean {
    return this.kindConfig.isKindValid(kind, config);
  }

  public getEntityConfig(): KindConfig {
    return this.kindConfig.getEntityConfig();
  }

  public getListConfig(): KindConfig {
    return this.kindConfig.getListConfig();
  }

  public getRelationConfig(): KindConfig {
    return this.kindConfig.getRelationConfig();
  }

  public getEntityReactionConfig(): KindConfig {
    return this.kindConfig.getEntityReactionConfig();
  }

  public getListReactionConfig(): KindConfig {
    return this.kindConfig.getListReactionConfig();
  }
}
