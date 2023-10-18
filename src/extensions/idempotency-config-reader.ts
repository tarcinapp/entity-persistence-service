import {BindingKey} from '@loopback/core';

export namespace IdempotencyConfigBindings {
  export const CONFIG_READER = BindingKey.create<IdempotencyConfigurationReader>(
    'extensions.idempotency.configurationreader',
  );
}

export class IdempotencyConfigurationReader {
  defaultEntityIdempotency: string[] = [];

  constructor() { }

  public isIdempotencyConfiguredForEntities(kind?: string) {
    return (
      process.env['idempotency_entity'] !== undefined ||
      this.isIdempotencyConfiguredForKindForEntities(kind)
    );
  }

  public isIdempotencyConfiguredForKindForEntities(kind?: string): boolean {
    return process.env[`idempotency_entity_for_${kind}`] !== undefined;
  }

  public getIdempotencyForEntities(kind?: string): string[] {
    let idempotencyConfig = this.getIdempotencyConfigForKindForEntities(kind);

    if (!idempotencyConfig) {
      idempotencyConfig = this.getIdempotencyConfigForEntities();
    }

    return idempotencyConfig || this.defaultEntityIdempotency;
  }

  private getIdempotencyConfigForKindForEntities(kind?: string): string[] {
    const config = process.env[`idempotency_entity_for_${kind}`];
    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }

  private getIdempotencyConfigForEntities(): string[] {
    const config = process.env['idempotency_entity'];
    return config ? config.split(',').map((fieldPath) => fieldPath.trim()) : [];
  }
}
