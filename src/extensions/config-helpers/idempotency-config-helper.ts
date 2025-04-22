import { BindingKey } from '@loopback/core';
import { isEmpty } from 'lodash';

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
    return (
      process.env['idempotency_entity'] !== undefined ||
      this.isIdempotencyConfiguredForKindForEntities(kind)
    );
  }

  public isIdempotencyConfiguredForLists(kind?: string) {
    return (
      process.env['idempotency_list'] !== undefined ||
      this.isIdempotencyConfiguredForKindForLists(kind)
    );
  }

  public isIdempotencyConfiguredForEntityReactions(kind?: string) {
    return (
      process.env['idempotency_entity_reaction'] !== undefined ||
      this.isIdempotencyConfiguredForKindForEntityReactions(kind)
    );
  }

  public isIdempotencyConfiguredForListReactions(kind?: string) {
    return (
      process.env['idempotency_list_reaction'] !== undefined ||
      this.isIdempotencyConfiguredForKindForListReactions(kind)
    );
  }

  public isIdempotencyConfiguredForKindForEntities(kind?: string): boolean {
    return process.env[`idempotency_entity_for_${kind}`] !== undefined;
  }

  public isIdempotencyConfiguredForKindForLists(kind?: string): boolean {
    return process.env[`idempotency_list_for_${kind}`] !== undefined;
  }

  public isIdempotencyConfiguredForKindForEntityReactions(
    kind?: string,
  ): boolean {
    return process.env[`idempotency_entity_reaction_for_${kind}`] !== undefined;
  }

  public isIdempotencyConfiguredForKindForListReactions(
    kind?: string,
  ): boolean {
    return process.env[`idempotency_list_reaction_for_${kind}`] !== undefined;
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
    const config = process.env[`idempotency_entity_for_${kind}`];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForEntities(): string[] {
    const config = process.env['idempotency_entity'];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForKindForLists(kind?: string): string[] {
    const config = process.env[`idempotency_list_for_${kind}`];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForLists(): string[] {
    const config = process.env['idempotency_list'];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForKindForListEntityRel(kind?: string): string[] {
    const config = process.env[`idempotency_list_entity_rel_for_${kind}`];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForListEntityRel(): string[] {
    const config = process.env['idempotency_list_entity_rel'];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForKindForEntityReactions(
    kind?: string,
  ): string[] {
    const config = process.env[`idempotency_entity_reaction_for_${kind}`];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForEntityReactions(): string[] {
    const config = process.env['idempotency_entity_reaction'];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForKindForListReactions(kind?: string): string[] {
    const config = process.env[`idempotency_list_reaction_for_${kind}`];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForListReactions(): string[] {
    const config = process.env['idempotency_list_reaction'];

    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }
}
