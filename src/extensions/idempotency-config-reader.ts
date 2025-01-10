import { BindingKey } from '@loopback/core';
import { isEmpty } from 'lodash';

export namespace IdempotencyConfigBindings {
  export const CONFIG_READER =
    BindingKey.create<IdempotencyConfigurationReader>(
      'extensions.idempotency.configurationreader',
    );
}

export class IdempotencyConfigurationReader {
  defaultListIdempotency: string[] = [];
  defaultEntityIdempotency: string[] = [];
  defaultListEntityRelIdempotency: string[] = [];

  constructor() {}

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

  public isIdempotencyConfiguredForKindForEntities(kind?: string): boolean {
    return process.env[`idempotency_entity_for_${kind}`] !== undefined;
  }

  public isIdempotencyConfiguredForKindForLists(kind?: string): boolean {
    return process.env[`idempotency_list_for_${kind}`] !== undefined;
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
}
