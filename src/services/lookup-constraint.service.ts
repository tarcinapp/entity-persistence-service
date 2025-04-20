import { inject, injectable } from '@loopback/core';
import { DefaultCrudRepository } from '@loopback/repository';
import { get } from 'lodash';
import { LoggingService } from './logging.service';
import { ListEntityCommonBase } from '../models/base-models/list-entity-common-base.model';
import { HttpErrorResponse } from '../models/http-error-response.model';
import { List } from '../models/list.model';

interface LookupConstraint {
  propertyPath: string;
  record: 'entity' | 'list';
  sourceKind: string;
  targetKind: string;
}

@injectable()
export class LookupConstraintService {
  private entityConstraints: LookupConstraint[] = [];
  private listConstraints: LookupConstraint[] = [];

  constructor(
    @inject('services.LoggingService')
    private loggingService: LoggingService,
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

  async validateLookupConstraints(
    item: ListEntityCommonBase,
    repository: DefaultCrudRepository<any, any>,
  ) {
    const isList = item instanceof List;
    const applicableConstraints = (
      isList ? this.listConstraints : this.entityConstraints
    ).filter((constraint) => constraint.sourceKind === item._kind);

    if (applicableConstraints.length === 0) {
      return;
    }

    await Promise.all(
      applicableConstraints.map((constraint) =>
        this.validateConstraint(item, constraint, repository, isList),
      ),
    );
  }

  private async validateConstraint(
    item: ListEntityCommonBase,
    constraint: LookupConstraint,
    repository: DefaultCrudRepository<any, any>,
    isList: boolean,
  ) {
    const references = get(item, constraint.propertyPath);
    if (!references || references.length === 0) {
      return;
    }

    const ids = Array.isArray(references) ? references : [references];
    const validIds = ids.filter((id) => {
      if (!id || typeof id !== 'string') {
        return false;
      }

      const isValidFormat = this.validateReferenceFormat(id, constraint.record);
      if (!isValidFormat) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidLookupReferenceError',
          message: `Invalid reference format in property '${constraint.propertyPath}'. Expected format: 'tapp://localhost/${constraint.record}s/{id}'`,
          code: isList
            ? 'LIST-INVALID-LOOKUP-REFERENCE'
            : 'ENTITY-INVALID-LOOKUP-REFERENCE',
          status: 422,
        });
      }

      return true;
    });

    if (validIds.length === 0) {
      return;
    }

    const extractedIds = validIds.map((id) => this.extractIdFromReference(id));
    const items = await repository.find({
      where: { _id: { inq: extractedIds } },
      fields: { _kind: true },
    });

    const invalidItems = items.filter(
      (targetItem) => targetItem._kind !== constraint.targetKind,
    );
    if (invalidItems.length > 0) {
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
