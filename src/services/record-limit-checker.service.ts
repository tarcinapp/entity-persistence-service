import { inject } from '@loopback/core';
import {
  DataObject,
  Entity,
  Filter,
  Where,
  FilterBuilder,
  DefaultCrudRepository,
  Count,
} from '@loopback/repository';
import _ from 'lodash';
import { parse } from 'qs';
import { LoggingService } from './logging.service';
import { EnvConfigHelper } from '../extensions/config-helpers/env-config-helper';
import { FilterMatcher } from '../extensions/utils/filter-matcher';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { HttpErrorResponse, SingleError } from '../models';
import { ListEntityRelationRepository } from '../repositories/list-entity-relation.repository';

export interface RecordLimit {
  scope: string;
  limit: number;
}

export interface RecordLimitConfig {
  // Record limits
  entityLimits?: RecordLimit[];
  listLimits?: RecordLimit[];
  relationLimits?: RecordLimit[];
  entityReactionLimits?: RecordLimit[];
  listReactionLimits?: RecordLimit[];

  // Uniqueness scopes
  entityUniqueness?: string[];
  listUniqueness?: string[];
  relationUniqueness?: string[];
  entityReactionUniqueness?: string[];
  listReactionUniqueness?: string[];
}

export const ENV_CONFIG_KEYS = {
  // Record limits
  ENTITY: 'ENTITY_RECORD_LIMITS',
  LIST: 'LIST_RECORD_LIMITS',
  RELATION: 'RELATION_RECORD_LIMITS',
  ENTITY_REACTION: 'ENTITY_REACTION_RECORD_LIMITS',
  LIST_REACTION: 'LIST_REACTION_RECORD_LIMITS',

  // Uniqueness
  ENTITY_UNIQUENESS: 'ENTITY_UNIQUENESS',
  LIST_UNIQUENESS: 'LIST_UNIQUENESS',
  RELATION_UNIQUENESS: 'RELATION_UNIQUENESS',
  ENTITY_REACTION_UNIQUENESS: 'ENTITY_REACTION_UNIQUENESS',
  LIST_REACTION_UNIQUENESS: 'LIST_REACTION_UNIQUENESS',
} as const;

// Type for model class that extends Entity and has static modelName
export type EntityModelClass = (new (...args: any[]) => Entity) & {
  modelName: string;
};

// Mapping of model names to their error code prefixes
const MODEL_ERROR_CODES = {
  genericentity: 'ENTITY',
  list: 'LIST',
  listtoentityrelation: 'RELATION',
  entityreactions: 'ENTITY-REACTION',
  listreactions: 'LIST-REACTION',
} as const;

export class RecordLimitCheckerService {
  private config: RecordLimitConfig;

  constructor(
    @inject('services.LoggingService')
    private loggingService: LoggingService,
  ) {
    this.initializeConfig();
  }

  /**
   * Initialize configuration by parsing environment variables
   */
  private initializeConfig(): void {
    this.config = {};

    try {
      const env = EnvConfigHelper.getInstance();
      // Parse record limits
      if (env.ENTITY_RECORD_LIMITS) {
        this.config.entityLimits = JSON.parse(env.ENTITY_RECORD_LIMITS);
      }
      if (env.LIST_RECORD_LIMITS) {
        this.config.listLimits = JSON.parse(env.LIST_RECORD_LIMITS);
      }
      if (env.RELATION_RECORD_LIMITS) {
        this.config.relationLimits = JSON.parse(env.RELATION_RECORD_LIMITS);
      }
      if (env.ENTITY_REACTION_RECORD_LIMITS) {
        this.config.entityReactionLimits = JSON.parse(env.ENTITY_REACTION_RECORD_LIMITS);
      }
      if (env.LIST_REACTION_RECORD_LIMITS) {
        this.config.listReactionLimits = JSON.parse(env.LIST_REACTION_RECORD_LIMITS);
      }

      // Parse uniqueness scopes
      if (env.ENTITY_UNIQUENESS) {
        this.config.entityUniqueness = env.ENTITY_UNIQUENESS.split(',');
      }
      if (env.LIST_UNIQUENESS) {
        this.config.listUniqueness = env.LIST_UNIQUENESS.split(',');
      }
      if (env.RELATION_UNIQUENESS) {
        this.config.relationUniqueness = env.RELATION_UNIQUENESS.split(',');
      }
      if (env.ENTITY_REACTION_UNIQUENESS) {
        this.config.entityReactionUniqueness = env.ENTITY_REACTION_UNIQUENESS.split(',');
      }
      if (env.LIST_REACTION_UNIQUENESS) {
        this.config.listReactionUniqueness = env.LIST_REACTION_UNIQUENESS.split(',');
      }

      this.loggingService.debug(
        'Record limits and uniqueness configuration initialized:',
        {
          config: this.config,
        },
      );
    } catch (error) {
      this.loggingService.error('Failed to parse configuration:', error);
      throw new Error('Invalid configuration');
    }
  }

  /**
   * Interpolate values from the data object into the scope string
   */
  private interpolateScope(scope: string, data: object): string {
    return scope.replace(/\${([^}]+)}/g, (match, path) => {
      const trimmedPath = path.trim();
      const value = _.get(data, trimmedPath);

      if (value === undefined) {
        this.loggingService.warn(
          `Property '${trimmedPath}' not found in data while interpolating scope: ${scope}`,
        );

        return '';
      }

      if (Array.isArray(value)) {
        return value.join(',');
      }

      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }

      return String(value);
    });
  }

  /**
   * Convert scope string to a Filter object
   */
  private scopeToFilter(scope: string): {
    filter: Filter<any>;
    entityFilter?: Filter<any>;
    listFilter?: Filter<any>;
  } {
    const parsed = parse(scope);
    const parsedSet = parsed.set as Set;
    const parsedWhere = parsed.where as Where<any>;
    const parsedListSet = parsed.listSet as Set;
    const parsedListWhere = parsed.listWhere as Where<any>;
    const parsedEntitySet = parsed.entitySet as Set;
    const parsedEntityWhere = parsed.entityWhere as Where<any>;

    // Handle relation filter
    const filterBuilder = new FilterBuilder();
    if (parsedWhere) {
      filterBuilder.where(parsedWhere);
    }

    let filter = filterBuilder.build();
    if (parsedSet) {
      filter = new SetFilterBuilder(parsedSet, {
        filter: filter,
      }).build();
    }

    // Handle list filter
    const listFilterBuilder = new FilterBuilder();
    if (parsedListWhere) {
      listFilterBuilder.where(parsedListWhere);
    }

    let listFilter = listFilterBuilder.build();
    if (parsedListSet) {
      listFilter = new SetFilterBuilder(parsedListSet, {
        filter: listFilter,
      }).build();
    }

    // Handle entity filter
    const entityFilterBuilder = new FilterBuilder();
    if (parsedEntityWhere) {
      entityFilterBuilder.where(parsedEntityWhere);
    }

    let entityFilter = entityFilterBuilder.build();
    if (parsedEntitySet) {
      entityFilter = new SetFilterBuilder(parsedEntitySet, {
        filter: entityFilter,
      }).build();
    }

    return {
      filter,
      entityFilter,
      listFilter,
    };
  }

  /**
   * Check if a record matches a filter
   */
  private recordMatchesFilter(record: object, filter: Filter<any>): boolean {
    return FilterMatcher.matches(record, filter.where);
  }

  /**
   * Get the appropriate limits array based on the model class name
   */
  private getLimitsForModel(
    modelClass: EntityModelClass,
  ): RecordLimit[] | undefined {
    const modelName = modelClass.modelName.toLowerCase();

    switch (modelName) {
      case 'genericentity':
        return this.config.entityLimits;
      case 'list':
        return this.config.listLimits;
      case 'listtoentityrelation':
        return this.config.relationLimits;
      case 'entityreaction':
        return this.config.entityReactionLimits;
      case 'listreaction':
        return this.config.listReactionLimits;
      default:
        this.loggingService.warn(
          `No record limits configuration found for model: ${modelName}`,
        );

        return undefined;
    }
  }

  /**
   * Get uniqueness scopes for a model
   */
  private getUniquenessScopes(modelName: string): string[] | undefined {
    switch (modelName.toLowerCase()) {
      case 'genericentity':
        return this.config.entityUniqueness;
      case 'list':
        return this.config.listUniqueness;
      case 'listtoentityrelation':
        return this.config.relationUniqueness;
      case 'entityreaction':
        return this.config.entityReactionUniqueness;
      case 'listreaction':
        return this.config.listReactionUniqueness;
      default:
        return undefined;
    }
  }

  /**
   * Get error code prefix for a model
   */
  private getErrorCodePrefix(modelName: string): string {
    return (
      MODEL_ERROR_CODES[
        modelName.toLowerCase() as keyof typeof MODEL_ERROR_CODES
      ] ?? modelName.toUpperCase()
    );
  }

  /**
   * Get friendly model name for error messages
   */
  private getFriendlyModelName(modelName: string): string {
    const prefix = this.getErrorCodePrefix(modelName);

    return prefix.toLowerCase();
  }

  /**
   * Check all applicable limits for a model
   */
  async checkLimits<T extends Entity>(
    modelClass: EntityModelClass,
    newData: DataObject<T>,
    repository: DefaultCrudRepository<T, any, any>,
  ): Promise<void> {
    const limits = this.getLimitsForModel(modelClass) ?? [];

    // Process all limits in parallel
    await Promise.all(
      limits.map(async ({ scope, limit }) => {
        // Interpolate values from newData into scope
        const interpolatedScope = this.interpolateScope(scope, newData);

        // Convert scope to filter
        const { filter, entityFilter, listFilter } =
          this.scopeToFilter(interpolatedScope);

        // Check if new record would match this filter
        if (!this.recordMatchesFilter(newData, filter)) {
          return; // Skip if record wouldn't be counted in this scope
        }

        // If this looks like an update (has an _id), exclude the record itself
        // from the counting so updates don't incorrectly trigger the limit.
        const idToExclude = _.get(newData as any, '_id') ?? _.get(newData as any, 'id');
        if (idToExclude) {
          // Ensure we don't mutate original filter objects from callers; clone
          // only the where clause as that's what we pass to repository.count.
          const where = filter.where ? _.cloneDeep(filter.where) : undefined;
          // Merge exclusion into where: if existing where is present, combine
          // using an 'and' clause to keep semantics.
          const exclusion = { _id: { neq: idToExclude } };
          if (!where) {
            filter.where = exclusion as Where<any>;
          } else if ((where as any).and) {
            (where as any).and = Array.isArray((where as any).and)
              ? [...(where as any).and, exclusion]
              : [(where as any).and, exclusion];
            filter.where = where;
          } else {
            filter.where = { and: [where, exclusion] } as Where<any>;
          }
        }

        // Count existing records in scope
        let count: Count;
        if (repository instanceof ListEntityRelationRepository) {
          // Special handling for ListEntityRelationRepository
          count = await (
            repository as unknown as ListEntityRelationRepository
          ).count(
            filter.where,
            listFilter?.where,
            entityFilter?.where,
            undefined,
          );
        } else {
          // Standard handling for other repositories
          count = await repository.count(filter.where);
        }

        if (count.count >= limit) {
          const errorCodePrefix = this.getErrorCodePrefix(modelClass.modelName);
          const errorCode = `${errorCodePrefix}-LIMIT-EXCEEDED`;
          const friendlyName = this.getFriendlyModelName(modelClass.modelName);

          throw new HttpErrorResponse({
            statusCode: 429,
            name: 'LimitExceededError',
            message: `Record limit exceeded for ${friendlyName}`,
            code: errorCode,
            status: 429,
            details: [
              new SingleError({
                code: errorCode,
                message: `Record limit exceeded for ${friendlyName}`,
                info: {
                  limit,
                  scope: interpolatedScope,
                },
              }),
            ],
          });
        }
      }),
    );
  }

  /**
   * Check uniqueness for a model
   */
  async checkUniqueness<T extends Entity>(
    modelClass: EntityModelClass,
    newData: DataObject<T>,
    repository: DefaultCrudRepository<T, any, any>,
  ): Promise<void> {
    const modelName = modelClass.modelName;
    const uniquenessScopes = this.getUniquenessScopes(modelName);

    if (!uniquenessScopes) {
      return;
    }

    await Promise.all(
      uniquenessScopes.map(async (scope) => {
        const interpolatedScope = this.interpolateScope(scope, newData);
        const { filter, entityFilter, listFilter } =
          this.scopeToFilter(interpolatedScope);

        if (!this.recordMatchesFilter(newData, filter)) {
          return;
        }

        // If this looks like an update (has an _id), exclude the record itself
        // from the uniqueness check so updating a record doesn't trigger a
        // uniqueness violation against itself.
        const idToExclude = _.get(newData as any, '_id') ?? _.get(newData as any, 'id');
        if (idToExclude) {
          const where = filter.where ? _.cloneDeep(filter.where) : undefined;
          const exclusion = { _id: { neq: idToExclude } };
          if (!where) {
            filter.where = exclusion as Where<any>;
          } else if ((where as any).and) {
            (where as any).and = Array.isArray((where as any).and)
              ? [...(where as any).and, exclusion]
              : [(where as any).and, exclusion];
            filter.where = where;
          } else {
            filter.where = { and: [where, exclusion] } as Where<any>;
          }
        }

        let count: Count;
        if (repository instanceof ListEntityRelationRepository) {
          count = await (
            repository as unknown as ListEntityRelationRepository
          ).count(
            filter.where,
            listFilter?.where,
            entityFilter?.where,
            undefined,
          );
        } else {
          count = await repository.count(filter.where);
        }

        if (count.count > 0) {
          const errorCodePrefix = this.getErrorCodePrefix(modelName);
          const errorCode = `${errorCodePrefix}-UNIQUENESS-VIOLATION`;
          const friendlyName = this.getFriendlyModelName(modelName);

          throw new HttpErrorResponse({
            statusCode: 409,
            name: 'UniquenessViolationError',
            message: `${friendlyName.charAt(0).toUpperCase() + friendlyName.slice(1)} already exists`,
            code: errorCode,
            status: 409,
            details: [
              new SingleError({
                code: errorCode,
                message: `${friendlyName.charAt(0).toUpperCase() + friendlyName.slice(1)} already exists`,
                info: {
                  scope: interpolatedScope,
                },
              }),
            ],
          });
        }
      }),
    );
  }
}
