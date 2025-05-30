import { BindingKey } from '@loopback/core';
import slugify from 'slugify';

export const KindBindings = {
  CONFIG_READER: BindingKey.create<KindConfigurationReader>(
    'extensions.kind.configurationreader',
  ),
} as const;

export interface KindConfig {
  defaultKind: string;
  allowedKinds: string[];
}

export class KindConfiguration {
  private readonly entityConfig: KindConfig = {
    defaultKind: 'entity',
    allowedKinds: ['entity'],
  };

  private readonly listConfig: KindConfig = {
    defaultKind: 'list',
    allowedKinds: ['list'],
  };

  private readonly relationConfig: KindConfig = {
    defaultKind: 'relation',
    allowedKinds: ['relation'],
  };

  private readonly entityReactionConfig: KindConfig = {
    defaultKind: 'entity-reaction',
    allowedKinds: ['entity-reaction'],
  };

  private readonly listReactionConfig: KindConfig = {
    defaultKind: 'list-reaction',
    allowedKinds: ['list-reaction'],
  };

  constructor() {
    this.loadConfigurations();
  }

  private loadConfigurations() {
    // Update default kinds from environment variables if specified
    if (process.env.default_entity_kind) {
      this.entityConfig.defaultKind = process.env.default_entity_kind;
    }

    if (process.env.default_list_kind) {
      this.listConfig.defaultKind = process.env.default_list_kind;
    }

    if (process.env.default_relation_kind) {
      this.relationConfig.defaultKind = process.env.default_relation_kind;
    }

    if (process.env.default_entity_reaction_kind) {
      this.entityReactionConfig.defaultKind =
        process.env.default_entity_reaction_kind;
    }

    if (process.env.default_list_reaction_kind) {
      this.listReactionConfig.defaultKind =
        process.env.default_list_reaction_kind;
    }

    // Load entity kinds if specified
    if (process.env.entity_kinds) {
      const kinds = process.env.entity_kinds.split(',').map((k) => k.trim());
      this.entityConfig.allowedKinds = [...new Set(kinds)];
      // Only add default kind to allowed kinds if it's explicitly configured
      if (process.env.default_entity_kind) {
        this.entityConfig.allowedKinds.push(process.env.default_entity_kind);
      }
    } else {
      // If no allowed kinds specified, allow all kinds
      this.entityConfig.allowedKinds = [];
    }

    // Load list kinds if specified
    if (process.env.list_kinds) {
      const kinds = process.env.list_kinds.split(',').map((k) => k.trim());
      this.listConfig.allowedKinds = [...new Set(kinds)];
      if (process.env.default_list_kind) {
        this.listConfig.allowedKinds.push(process.env.default_list_kind);
      }
    } else {
      this.listConfig.allowedKinds = [];
    }

    // Load relation kinds if specified
    if (process.env.list_entity_rel_kinds) {
      const kinds = process.env.list_entity_rel_kinds
        .split(',')
        .map((k) => k.trim());
      this.relationConfig.allowedKinds = [...new Set(kinds)];
      if (process.env.default_relation_kind) {
        this.relationConfig.allowedKinds.push(
          process.env.default_relation_kind,
        );
      }
    } else {
      this.relationConfig.allowedKinds = [];
    }

    // Load entity reaction kinds if specified
    if (process.env.entity_reaction_kinds) {
      const kinds = process.env.entity_reaction_kinds
        .split(',')
        .map((k) => k.trim());
      this.entityReactionConfig.allowedKinds = [...new Set(kinds)];
      if (process.env.default_entity_reaction_kind) {
        this.entityReactionConfig.allowedKinds.push(
          process.env.default_entity_reaction_kind,
        );
      }
    } else {
      this.entityReactionConfig.allowedKinds = [];
    }

    // Load list reaction kinds if specified
    if (process.env.list_reaction_kinds) {
      const kinds = process.env.list_reaction_kinds
        .split(',')
        .map((k) => k.trim());
      this.listReactionConfig.allowedKinds = [...new Set(kinds)];
      if (process.env.default_list_reaction_kind) {
        this.listReactionConfig.allowedKinds.push(
          process.env.default_list_reaction_kind,
        );
      }
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

  public getDefaultKind(config: KindConfig): string {
    return config.defaultKind;
  }
}

export class KindConfigurationReader {
  private kindConfig: KindConfiguration;

  constructor() {
    this.kindConfig = new KindConfiguration();
  }

  public get defaultEntityKind(): string {
    return this.kindConfig.getEntityConfig().defaultKind;
  }

  public get defaultListKind(): string {
    return this.kindConfig.getListConfig().defaultKind;
  }

  public get defaultRelationKind(): string {
    return this.kindConfig.getRelationConfig().defaultKind;
  }

  public get defaultEntityReactionKind(): string {
    return this.kindConfig.getEntityReactionConfig().defaultKind;
  }

  public get defaultListReactionKind(): string {
    return this.kindConfig.getListReactionConfig().defaultKind;
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
