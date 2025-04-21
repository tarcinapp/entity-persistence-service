import { inject, injectable, Getter } from '@loopback/core';
import { get, every } from 'lodash';
import { LoggingService } from './logging.service';
import { ListEntityCommonBase } from '../models/base-models/list-entity-common-base.model';
import { HttpErrorResponse } from '../models/http-error-response.model';
import { List } from '../models/list.model';
import { EntityRepository } from '../repositories/entity.repository';
import { ListRepository } from '../repositories/list.repository';

interface LookupConstraint {
  propertyPath: string;
  record?: 'entity' | 'list';
  sourceKind?: string;
  targetKind?: string;
}

@injectable()
export class LookupConstraintService {
  private entityConstraints: LookupConstraint[] = [];
  private listConstraints: LookupConstraint[] = [];

  constructor(
    @inject('services.LoggingService')
    private loggingService: LoggingService,
    @inject.getter('repositories.EntityRepository')
    private getEntityRepository: Getter<EntityRepository>,
    @inject.getter('repositories.ListRepository')
    private getListRepository: Getter<ListRepository>,
  ) {
    this.loadConstraints();
  }

  private loadConstraints() {
    const entityConstraintsJson = process.env.ENTITY_LOOKUP_CONSTRAINT;
    const listConstraintsJson = process.env.LIST_LOOKUP_CONSTRAINT;

    if (entityConstraintsJson) {
      try {
        this.entityConstraints = JSON.parse(entityConstraintsJson);
      } catch (error) {
        this.loggingService.warn(
          'Failed to parse ENTITY_LOOKUP_CONSTRAINT environment variable',
          error,
        );
      }
    }

    if (listConstraintsJson) {
      try {
        this.listConstraints = JSON.parse(listConstraintsJson);
      } catch (error) {
        this.loggingService.warn(
          'Failed to parse LIST_LOOKUP_CONSTRAINT environment variable',
          error,
        );
      }
    }
  }

  async validateLookupConstraints(item: ListEntityCommonBase) {
    const isList = item instanceof List;
    const applicableConstraints = (
      isList ? this.listConstraints : this.entityConstraints
    ).filter(
      (constraint) =>
        // Apply constraint if:
        // 1. No sourceKind specified (applies to all)
        // 2. sourceKind matches the item's kind
        !constraint.sourceKind || constraint.sourceKind === item._kind,
    );

    if (applicableConstraints.length === 0) {
      return;
    }

    await Promise.all(
      applicableConstraints.map((constraint) =>
        this.validateConstraint(item, constraint, isList),
      ),
    );
  }

  private async validateConstraint(
    item: ListEntityCommonBase,
    constraint: LookupConstraint,
    isList: boolean,
  ) {
    const references = get(item, constraint.propertyPath);
    if (!references || references.length === 0) {
      return;
    }

    const ids = Array.isArray(references) ? references : [references];

    // Check if all references are valid strings
    if (!every(ids, (id) => id && typeof id === 'string')) {
      return;
    }

    // Only validate reference format if record is specified
    if (constraint.record) {
      const allValidFormat = every(ids, (id) =>
        this.validateReferenceFormat(id, constraint.record!),
      );
      if (!allValidFormat) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidLookupReferenceError',
          message: `Invalid reference format in property '${constraint.propertyPath}'. Expected format: 'tapp://localhost/${constraint.record === 'entity' ? 'entities' : 'lists'}/{id}'`,
          code: isList
            ? 'LIST-INVALID-LOOKUP-REFERENCE'
            : 'ENTITY-INVALID-LOOKUP-REFERENCE',
          status: 422,
        });
      }
    }

    // Only validate target kinds if targetKind is specified
    if (constraint.targetKind) {
      const extractedIds = ids.map((id) => this.extractIdFromReference(id));

      // Get the appropriate repository based on the record type
      const repository =
        constraint.record === 'list'
          ? await this.getListRepository()
          : await this.getEntityRepository();

      const items = (await repository.find({
        where: { _id: { inq: extractedIds } },
        fields: { _kind: true },
      })) as Array<{ _kind: string }>;

      const allValidKind = every(
        items,
        (target) => target._kind === constraint.targetKind,
      );
      if (!allValidKind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidLookupConstraintError',
          message: `One or more lookup references in property '${constraint.propertyPath}' do not meet the constraint: expected targetKind='${constraint.targetKind}'.`,
          code: isList
            ? 'LIST-INVALID-LOOKUP-KIND'
            : 'ENTITY-INVALID-LOOKUP-KIND',
          status: 422,
        });
      }
    }
  }

  private validateReferenceFormat(
    reference: string,
    expectedType: 'entity' | 'list',
  ): boolean {
    if (expectedType === 'entity') {
      return reference.startsWith('tapp://localhost/entities/');
    }

    return reference.startsWith('tapp://localhost/lists/');
  }

  private extractIdFromReference(reference: string): string {
    return reference.split('/').pop() ?? '';
  }
}
