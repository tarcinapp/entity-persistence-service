import { inject } from '@loopback/core';
import {
  DataObject,
  Entity,
  Filter,
  Where,
  FilterBuilder,
  DefaultCrudRepository,
  Count,
  Options,
} from '@loopback/repository';
import _ from 'lodash';
import { parse } from 'qs';
import { LoggingService } from './logging.service';
import { EnvConfigHelper } from '../extensions/config-helpers/env-config-helper';
import { FilterMatcher } from '../extensions/utils/filter-matcher';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { HttpErrorResponse, SingleError } from '../models';
import { ListEntityRelationRepository } from '../repositories/core/list-entity-relation.repository';

export interface RecordLimit {
  scope: string;
  limit: number;
  duration?: string;
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
   * Parse duration string like '10m', '5min', '2h', '7d', '1M', '3mo' etc and
   * compute the Date that is (now - duration).
   * Returns undefined if parsing fails.
   */
  private parseDurationToDate(duration: string): Date | undefined {
    if (!duration || typeof duration !== 'string') {
      return undefined;
    }

    const trimmed = duration.trim();
    const match = trimmed.match(/^(\d+)\s*([A-Za-z]+)$/);
    if (!match) {
      return undefined;
    }

    const amount = Number(match[1]);
    let unit = match[2];

    if (!Number.isFinite(amount) || amount <= 0) {
      return undefined;
    }

    // Disambiguate single-letter 'm' (minute) vs uppercase 'M' (month)
    // Normalize unit tokens mostly by lowercasing, but preserve 'M' -> month
    if (unit === 'M') {
      unit = 'mon';
    } else {
      unit = unit.toLowerCase();
    }

    const now = new Date();

    // Map synonyms to canonical units
    const secondsUnits = new Set(['s', 'sec', 'secs', 'second', 'seconds']);
    const minutesUnits = new Set(['m', 'min', 'mins', 'minute', 'minutes']);
    const hoursUnits = new Set(['h', 'hour', 'hours']);
    const daysUnits = new Set(['d', 'day', 'days']);
    const weeksUnits = new Set(['w', 'week', 'weeks']);
    const monthsUnits = new Set(['mo', 'mon', 'month', 'months']);

    if (secondsUnits.has(unit)) {
      return new Date(now.getTime() - amount * 1000);
    }

    if (minutesUnits.has(unit)) {
      return new Date(now.getTime() - amount * 60 * 1000);
    }

    if (hoursUnits.has(unit)) {
      return new Date(now.getTime() - amount * 60 * 60 * 1000);
    }

    if (daysUnits.has(unit)) {
      return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
    }

    if (weeksUnits.has(unit)) {
      return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
    }

    if (monthsUnits.has(unit)) {
      const start = new Date(now.getTime());
      start.setUTCMonth(start.getUTCMonth() - amount);

      return start;
    }

    return undefined;
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
        const parsed = JSON.parse(env.ENTITY_RECORD_LIMITS);
        this.config.entityLimits = this.sanitizeLimitsArray(
          parsed,
          'ENTITY_RECORD_LIMITS',
        );
      }

      if (env.LIST_RECORD_LIMITS) {
        const parsed = JSON.parse(env.LIST_RECORD_LIMITS);
        this.config.listLimits = this.sanitizeLimitsArray(
          parsed,
          'LIST_RECORD_LIMITS',
        );
      }

      if (env.RELATION_RECORD_LIMITS) {
        const parsed = JSON.parse(env.RELATION_RECORD_LIMITS);
        this.config.relationLimits = this.sanitizeLimitsArray(
          parsed,
          'RELATION_RECORD_LIMITS',
        );
      }

      if (env.ENTITY_REACTION_RECORD_LIMITS) {
        const parsed = JSON.parse(env.ENTITY_REACTION_RECORD_LIMITS);
        this.config.entityReactionLimits = this.sanitizeLimitsArray(
          parsed,
          'ENTITY_REACTION_RECORD_LIMITS',
        );
      }

      if (env.LIST_REACTION_RECORD_LIMITS) {
        const parsed = JSON.parse(env.LIST_REACTION_RECORD_LIMITS);
        this.config.listReactionLimits = this.sanitizeLimitsArray(
          parsed,
          'LIST_REACTION_RECORD_LIMITS',
        );
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
        this.config.entityReactionUniqueness =
          env.ENTITY_REACTION_UNIQUENESS.split(',');
      }

      if (env.LIST_REACTION_UNIQUENESS) {
        this.config.listReactionUniqueness =
          env.LIST_REACTION_UNIQUENESS.split(',');
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
   * Validate and sanitize an array of record limit objects parsed from env.
   * Invalid duration strings are removed (with warning) but the limit entry
   * itself is preserved when possible so existing limits don't get dropped
   * inadvertently.
   */
  private sanitizeLimitsArray(
    parsed: any,
    envKeyName: string,
  ): RecordLimit[] | undefined {
    if (!Array.isArray(parsed)) {
      this.loggingService.warn(
        `Invalid ${envKeyName} value: expected JSON array, got ${typeof parsed}`,
      );

      return undefined;
    }

    const out: RecordLimit[] = [];
    for (const item of parsed) {
      if (!item || typeof item.scope !== 'string') {
        this.loggingService.warn(
          `Skipping invalid record limit entry in ${envKeyName}: missing or invalid scope`,
        );
        continue;
      }

      if (item.limit === undefined || !Number.isFinite(item.limit)) {
        this.loggingService.warn(
          `Skipping invalid record limit entry in ${envKeyName} for scope '${item.scope}': missing or invalid limit`,
        );
        continue;
      }

      // If a duration is provided, validate it now and warn if it's invalid.
      if (item.duration && typeof item.duration === 'string') {
        const start = this.parseDurationToDate(item.duration);
        if (!start) {
          this.loggingService.warn(
            `Invalid duration '${item.duration}' for record limit scope '${item.scope}' in ${envKeyName}; ignoring duration.`,
          );
          // Remove the duration property so downstream logic behaves as before
          // without causing a crash.
          delete item.duration;
        }
      }

      out.push({
        scope: item.scope,
        limit: Number(item.limit),
        duration: item.duration,
      });
    }

    return out.length > 0 ? out : undefined;
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
   * @param options - Optional transaction options to propagate to repository calls
   */
  async checkLimits<T extends Entity>(
    modelClass: EntityModelClass,
    newData: DataObject<T>,
    repository: DefaultCrudRepository<T, any, any>,
    options?: Options,
  ): Promise<void> {
    const limits = this.getLimitsForModel(modelClass) ?? [];

    // Process all limits in parallel
    await Promise.all(
      limits.map(async ({ scope, limit, duration }) => {
        // Interpolate values from newData into scope
        const interpolatedScope = this.interpolateScope(scope, newData);

        // Convert scope to filter
        const { filter, entityFilter, listFilter } =
          this.scopeToFilter(interpolatedScope);

        // Check if new record would match this filter
        if (!this.recordMatchesFilter(newData, filter)) {
          return; // Skip if record wouldn't be counted in this scope
        }

        // If a duration is specified for this limit, restrict the counting to
        // records created after (now - duration). This implements the
        // "created data in duration" semantics.
        // Note: the config array items are iterated already so `duration` is
        // already available for the current item.
        let startDate: Date | undefined;
        if (duration) {
          startDate = this.parseDurationToDate(duration);

          if (startDate) {
            // If the incoming data already has a _createdDateTime and it is
            // outside the requested duration window (i.e. older or equal to
            // the start), it cannot contribute to the duration-bounded
            // count — skip counting for this limit.
            const incomingCreated = _.get(newData as any, '_createdDateTime');

            if (incomingCreated) {
              const incomingCreatedDate = new Date(incomingCreated);

              if (
                !Number.isNaN(incomingCreatedDate.getTime()) &&
                incomingCreatedDate.getTime() <= startDate.getTime()
              ) {
                // Skip this limit since the new record is outside the duration
                return;
              }
            }

            // Restrict by created date using the canonical field name.
            const creationCond = {
              _createdDateTime: { gt: startDate.toISOString() },
            } as Where<any>;
            const where = filter.where ? _.cloneDeep(filter.where) : undefined;

            if (!where) {
              filter.where = creationCond as Where<any>;
            } else if ((where as any).and) {
              (where as any).and = Array.isArray((where as any).and)
                ? [...(where as any).and, creationCond]
                : [(where as any).and, creationCond];
              filter.where = where;
            } else {
              filter.where = { and: [where, creationCond] } as Where<any>;
            }
          } else {
            this.loggingService.warn(
              `Invalid duration '${duration}' for record limit scope '${scope}', ignoring duration.`,
            );
          }
        }

        // If this looks like an update (has an _id), exclude the record itself
        // from the counting so updates don't incorrectly trigger the limit.
        const idToExclude =
          _.get(newData as any, '_id') ?? _.get(newData as any, 'id');
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
        // Debug: log the exact filter/scope that will be used for counting
        this.loggingService.debug(
          'RecordLimitCheckerService.count - about to count records',
          {
            model: modelClass.modelName,
            limit,
            scope: interpolatedScope,
            duration,
            startDate: startDate ? startDate.toISOString() : undefined,
            filterWhere: filter.where,
          },
        );
        if (repository instanceof ListEntityRelationRepository) {
          // Special handling for ListEntityRelationRepository
          count = await (
            repository as unknown as ListEntityRelationRepository
          ).count(
            filter.where,
            listFilter?.where,
            entityFilter?.where,
            options,
          );
        } else {
          // Standard handling for other repositories
          count = await repository.count(filter.where, options);
        }

        // Debug: log the count observed from the repository
        this.loggingService.debug(
          'RecordLimitCheckerService.count - observed count',
          {
            model: modelClass.modelName,
            scope: interpolatedScope,
            count: count.count,
            limit,
            filterWhere: filter.where,
          },
        );

        if (count.count >= limit) {
          const errorCodePrefix = this.getErrorCodePrefix(modelClass.modelName);
          const errorCode = `${errorCodePrefix}-LIMIT-EXCEEDED`;
          const friendlyName = this.getFriendlyModelName(modelClass.modelName);

          throw new HttpErrorResponse({
            statusCode: 429,
            name: 'LimitExceededError',
            message: `Record limit exceeded for ${friendlyName}`,
            code: errorCode,
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
   * @param options - Optional transaction options to propagate to repository calls
   */
  async checkUniqueness<T extends Entity>(
    modelClass: EntityModelClass,
    newData: DataObject<T>,
    repository: DefaultCrudRepository<T, any, any>,
    options?: Options,
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
        const idToExclude =
          _.get(newData as any, '_id') ?? _.get(newData as any, 'id');
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
            options,
          );
        } else {
          count = await repository.count(filter.where, options);
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
