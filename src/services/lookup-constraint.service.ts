import { inject, injectable, Getter } from '@loopback/core';
import { get, every, isString } from 'lodash';
import { LoggingService } from './logging.service';
import { ListEntityCommonBase } from '../models/base-models/list-entity-common-base.model';
import { EntityReaction } from '../models/entity-reactions.model';
import { HttpErrorResponse } from '../models/http-error-response.model';
import { ListReaction } from '../models/list-reactions.model';
import { List } from '../models/list.model';
import { EntityReactionsRepository } from '../repositories/entity-reactions.repository';
import { EntityRepository } from '../repositories/entity.repository';
import { ListReactionsRepository } from '../repositories/list-reactions.repository';
import { ListRepository } from '../repositories/list.repository';

interface LookupConstraint {
  propertyPath: string;
  record?: 'entity' | 'list' | 'entity-reaction' | 'list-reaction';
  sourceKind?: string;
  targetKind?: string;
}

type RecordType = 'entity' | 'list' | 'entity-reaction' | 'list-reaction';

@injectable()
export class LookupConstraintService {
  private entityConstraints: LookupConstraint[] = [];
  private listConstraints: LookupConstraint[] = [];
  private entityReactionConstraints: LookupConstraint[] = [];
  private listReactionConstraints: LookupConstraint[] = [];

  // Default parent constraints for each record type
  private readonly defaultParentConstraints: Record<
    RecordType,
    LookupConstraint
  > = {
    entity: {
      propertyPath: '_parents',
      record: 'entity',
    },
    list: {
      propertyPath: '_parents',
      record: 'list',
    },
    'entity-reaction': {
      propertyPath: '_parents',
      record: 'entity-reaction',
    },
    'list-reaction': {
      propertyPath: '_parents',
      record: 'list-reaction',
    },
  };

  constructor(
    @inject('services.LoggingService')
    private loggingService: LoggingService,
    @inject.getter('repositories.EntityRepository')
    private getEntityRepository: Getter<EntityRepository>,
    @inject.getter('repositories.ListRepository')
    private getListRepository: Getter<ListRepository>,
    @inject.getter('repositories.EntityReactionsRepository')
    private getEntityReactionsRepository: Getter<EntityReactionsRepository>,
    @inject.getter('repositories.ListReactionsRepository')
    private getListReactionsRepository: Getter<ListReactionsRepository>,
  ) {
    this.loadConstraints();
  }

  private loadConstraints() {
    const entityConstraintsJson = process.env.ENTITY_LOOKUP_CONSTRAINT;
    const listConstraintsJson = process.env.LIST_LOOKUP_CONSTRAINT;
    const entityReactionConstraintsJson =
      process.env.ENTITY_REACTION_LOOKUP_CONSTRAINT;
    const listReactionConstraintsJson =
      process.env.LIST_REACTION_LOOKUP_CONSTRAINT;

    // Load user-configured constraints
    let userEntityConstraints: LookupConstraint[] = [];
    let userListConstraints: LookupConstraint[] = [];
    let userEntityReactionConstraints: LookupConstraint[] = [];
    let userListReactionConstraints: LookupConstraint[] = [];

    if (entityConstraintsJson) {
      try {
        userEntityConstraints = JSON.parse(entityConstraintsJson);
      } catch (error) {
        this.loggingService.warn(
          'Failed to parse ENTITY_LOOKUP_CONSTRAINT environment variable',
          error,
        );
      }
    }

    if (listConstraintsJson) {
      try {
        userListConstraints = JSON.parse(listConstraintsJson);
      } catch (error) {
        this.loggingService.warn(
          'Failed to parse LIST_LOOKUP_CONSTRAINT environment variable',
          error,
        );
      }
    }

    if (entityReactionConstraintsJson) {
      try {
        userEntityReactionConstraints = JSON.parse(
          entityReactionConstraintsJson,
        );
      } catch (error) {
        this.loggingService.warn(
          'Failed to parse ENTITY_REACTION_LOOKUP_CONSTRAINT environment variable',
          error,
        );
      }
    }

    if (listReactionConstraintsJson) {
      try {
        userListReactionConstraints = JSON.parse(listReactionConstraintsJson);
      } catch (error) {
        this.loggingService.warn(
          'Failed to parse LIST_REACTION_LOOKUP_CONSTRAINT environment variable',
          error,
        );
      }
    }

    // Merge default constraints with user-configured ones
    // Default constraint is only added if there's no user-configured constraint for _parents
    this.entityConstraints = this.mergeConstraints(
      userEntityConstraints,
      this.defaultParentConstraints.entity,
    );
    this.listConstraints = this.mergeConstraints(
      userListConstraints,
      this.defaultParentConstraints.list,
    );
    this.entityReactionConstraints = this.mergeConstraints(
      userEntityReactionConstraints,
      this.defaultParentConstraints['entity-reaction'],
    );
    this.listReactionConstraints = this.mergeConstraints(
      userListReactionConstraints,
      this.defaultParentConstraints['list-reaction'],
    );
  }

  private mergeConstraints(
    userConstraints: LookupConstraint[],
    defaultParentConstraint: LookupConstraint,
  ): LookupConstraint[] {
    // Check if there's a user-configured constraint for _parents
    const hasParentConstraint = userConstraints.some(
      (c) => c.propertyPath === '_parents',
    );

    // If no user-configured parent constraint, add the default one
    if (!hasParentConstraint) {
      return [...userConstraints, defaultParentConstraint];
    }

    return userConstraints;
  }

  private getRecordType(item: ListEntityCommonBase): RecordType {
    if (item instanceof List) {
      return 'list';
    }

    if (item instanceof EntityReaction) {
      return 'entity-reaction';
    }

    if (item instanceof ListReaction) {
      return 'list-reaction';
    }

    return 'entity';
  }

  private getConstraintsForType(recordType: RecordType): LookupConstraint[] {
    switch (recordType) {
      case 'list':
        return this.listConstraints;
      case 'entity-reaction':
        return this.entityReactionConstraints;
      case 'list-reaction':
        return this.listReactionConstraints;
      default:
        return this.entityConstraints;
    }
  }

  private getErrorCodePrefix(recordType: RecordType): string {
    switch (recordType) {
      case 'list':
        return 'LIST';
      case 'entity-reaction':
        return 'ENTITY-REACTION';
      case 'list-reaction':
        return 'LIST-REACTION';
      default:
        return 'ENTITY';
    }
  }

  async validateLookupConstraints(item: ListEntityCommonBase) {
    const recordType = this.getRecordType(item);
    const applicableConstraints = this.getConstraintsForType(recordType).filter(
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
        this.validateConstraint(item, constraint, recordType),
      ),
    );
  }

  private async validateConstraint(
    item: ListEntityCommonBase,
    constraint: LookupConstraint,
    recordType: RecordType,
  ) {
    const references = get(item, constraint.propertyPath);
    if (!references || references.length === 0) {
      return;
    }

    const ids = Array.isArray(references) ? references : [references];

    // Only validate reference format if record is specified
    if (constraint.record) {
      const allValidFormat = every(ids, (id) =>
        this.validateReferenceFormat(id, constraint.record!),
      );
      if (!allValidFormat) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidLookupReferenceError',
          message: `Invalid reference format in property '${constraint.propertyPath}'. Expected format: 'tapp://localhost/${this.getReferencePath(constraint.record)}/{id}'`,
          code: `${this.getErrorCodePrefix(recordType)}-INVALID-LOOKUP-REFERENCE`,
          status: 422,
        });
      }
    }

    // Only validate target kinds if targetKind is specified
    if (constraint.targetKind) {
      const extractedIds = ids.map((id) => this.extractIdFromReference(id));

      // Get the appropriate repository based on the record type
      const repository = await this.getRepositoryForType(constraint.record!);

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
          code: `${this.getErrorCodePrefix(recordType)}-INVALID-LOOKUP-KIND`,
          status: 422,
        });
      }
    }
  }

  private async getRepositoryForType(recordType: RecordType) {
    switch (recordType) {
      case 'list':
        return this.getListRepository();
      case 'entity-reaction':
        return this.getEntityReactionsRepository();
      case 'list-reaction':
        return this.getListReactionsRepository();
      default:
        return this.getEntityRepository();
    }
  }

  private getReferencePath(recordType: RecordType): string {
    switch (recordType) {
      case 'list':
        return 'lists';
      case 'entity-reaction':
        return 'entity-reactions';
      case 'list-reaction':
        return 'list-reactions';
      default:
        return 'entities';
    }
  }

  private validateReferenceFormat(
    reference: string,
    expectedType: RecordType,
  ): boolean {
    if (!isString(reference)) {
      return false;
    }

    return reference.startsWith(
      `tapp://localhost/${this.getReferencePath(expectedType)}/`,
    );
  }

  private extractIdFromReference(reference: string): string {
    return reference.split('/').pop() ?? '';
  }
}
