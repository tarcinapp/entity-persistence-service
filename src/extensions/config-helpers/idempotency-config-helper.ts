import { BindingKey } from '@loopback/core';
import { isEmpty } from 'lodash';
import { EnvConfigHelper } from './env-config-helper';

export const IdempotencyConfigBindings = {
  CONFIG_READER: BindingKey.create<IdempotencyConfigurationReader>(
    'extensions.idempotency.configurationreader',
  ),
} as const;

export class IdempotencyConfigurationReader {
  defaultListIdempotency: string[] = [];
  defaultEntityIdempotency: string[] = [];
  defaultListEntityRelIdempotency: string[] = [];
  defaultEntityReactionIdempotency: string[] = [];
  defaultListReactionIdempotency: string[] = [];

  public isIdempotencyConfiguredForEntities(kind?: string) {
    const env = EnvConfigHelper.getInstance();

    return (
      env.IDEMPOTENCY_ENTITY !== undefined ||
      this.isIdempotencyConfiguredForKindForEntities(kind)
    );
  }

  public isIdempotencyConfiguredForLists(kind?: string) {
    const env = EnvConfigHelper.getInstance();

    return (
      env.IDEMPOTENCY_LIST !== undefined ||
      this.isIdempotencyConfiguredForKindForLists(kind)
    );
  }

  public isIdempotencyConfiguredForEntityReactions(kind?: string) {
    const env = EnvConfigHelper.getInstance();

    return (
      env.IDEMPOTENCY_ENTITY_REACTION !== undefined ||
      this.isIdempotencyConfiguredForKindForEntityReactions(kind)
    );
  }

  public isIdempotencyConfiguredForListReactions(kind?: string) {
    const env = EnvConfigHelper.getInstance();

    return (
      env.IDEMPOTENCY_LIST_REACTION !== undefined ||
      this.isIdempotencyConfiguredForKindForListReactions(kind)
    );
  }

  public isIdempotencyConfiguredForKindForEntities(kind?: string): boolean {
    const env = EnvConfigHelper.getInstance();

    return env.getIdempotencyEntityForKind(kind) !== undefined;
  }

  public isIdempotencyConfiguredForKindForLists(kind?: string): boolean {
    const env = EnvConfigHelper.getInstance();

    return env.getIdempotencyListForKind(kind) !== undefined;
  }

  public isIdempotencyConfiguredForKindForEntityReactions(
    kind?: string,
  ): boolean {
    const env = EnvConfigHelper.getInstance();

    return env.getIdempotencyEntityReactionForKind(kind) !== undefined;
  }

  public isIdempotencyConfiguredForKindForListReactions(
    kind?: string,
  ): boolean {
    const env = EnvConfigHelper.getInstance();

    return env.getIdempotencyListReactionForKind(kind) !== undefined;
  }

  public getIdempotencyForEntities(kind?: string): string[] {
    let idempotencyConfig = this.getIdempotencyConfigForKindForEntities(kind);

    if (isEmpty(idempotencyConfig)) {
      idempotencyConfig = this.getIdempotencyConfigForEntities();
    }

    return idempotencyConfig || this.defaultEntityIdempotency;
  }

  public getIdempotencyForLists(kind?: string): string[] {
    let idempotencyConfig = this.getIdempotencyConfigForKindForLists(kind);

    if (isEmpty(idempotencyConfig)) {
      idempotencyConfig = this.getIdempotencyConfigForLists();
    }

    return idempotencyConfig || this.defaultListIdempotency;
  }

  public getIdempotencyForListEntityRels(kind?: string): string[] {
    let idempotencyConfig =
      this.getIdempotencyConfigForKindForListEntityRel(kind);

    if (isEmpty(idempotencyConfig)) {
      idempotencyConfig = this.getIdempotencyConfigForListEntityRel();
    }

    return idempotencyConfig || this.defaultListEntityRelIdempotency;
  }

  public getIdempotencyForEntityReactions(kind?: string): string[] {
    let idempotencyConfig =
      this.getIdempotencyConfigForKindForEntityReactions(kind);

    if (isEmpty(idempotencyConfig)) {
      idempotencyConfig = this.getIdempotencyConfigForEntityReactions();
    }

    return idempotencyConfig || this.defaultEntityReactionIdempotency;
  }

  public getIdempotencyForListReactions(kind?: string): string[] {
    let idempotencyConfig =
      this.getIdempotencyConfigForKindForListReactions(kind);

    if (isEmpty(idempotencyConfig)) {
      idempotencyConfig = this.getIdempotencyConfigForListReactions();
    }

    return idempotencyConfig || this.defaultListReactionIdempotency;
  }

  private getIdempotencyConfigForKindForEntities(kind?: string): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.getIdempotencyEntityForKind(kind);

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForEntities(): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.IDEMPOTENCY_ENTITY;

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForKindForLists(kind?: string): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.getIdempotencyListForKind(kind);

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForLists(): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.IDEMPOTENCY_LIST;

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForKindForListEntityRel(kind?: string): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.getIdempotencyListEntityRelForKind(kind);

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForListEntityRel(): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.IDEMPOTENCY_LIST_ENTITY_REL;

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForKindForEntityReactions(
    kind?: string,
  ): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.getIdempotencyEntityReactionForKind(kind);

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForEntityReactions(): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.IDEMPOTENCY_ENTITY_REACTION;

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForKindForListReactions(kind?: string): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.getIdempotencyListReactionForKind(kind);

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForListReactions(): string[] {
    const env = EnvConfigHelper.getInstance();
    const config = env.IDEMPOTENCY_LIST_REACTION;

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }
}
