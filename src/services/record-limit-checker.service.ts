import { BindingKey, inject } from '@loopback/core';
import {
  DefaultCrudRepository,
  Entity,
  Filter,
  DataObject,
} from '@loopback/repository';
import _ from 'lodash';
import { parse } from 'qs';
import { FilterMatcher } from '../extensions/utils/filter-matcher';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { HttpErrorResponse, SingleError } from '../models';
import { LoggingService } from './logging.service';

export interface RecordLimit {
  scope: string;
  limit: number;
}

export interface RecordLimitConfig {
  entityLimits?: RecordLimit[];
  listLimits?: RecordLimit[];
  relationLimits?: RecordLimit[];
  entityReactionLimits?: RecordLimit[];
  listReactionLimits?: RecordLimit[];
}

export const ENV_CONFIG_KEYS = {
  ENTITY: 'ENTITY_RECORD_LIMITS',
  LIST: 'LIST_RECORD_LIMITS',
  RELATION: 'RELATION_RECORD_LIMITS',
  ENTITY_REACTION: 'ENTITY_REACTION_RECORD_LIMITS',
  LIST_REACTION: 'LIST_REACTION_RECORD_LIMITS',
} as const;

export const RecordLimitCheckerBindings = {
  SERVICE: BindingKey.create<RecordLimitCheckerService>(
    'services.record-limit-checker',
  ),
};

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
   * This is called once during service construction
   */
  private initializeConfig(): void {
    this.config = {};

    try {
      // Parse each environment variable if it exists
      if (process.env[ENV_CONFIG_KEYS.ENTITY]) {
        const envVar = process.env[ENV_CONFIG_KEYS.ENTITY];
        if (typeof envVar === 'string') {
          this.config.entityLimits = JSON.parse(envVar);
        }
      }

      if (process.env[ENV_CONFIG_KEYS.LIST]) {
        const envVar = process.env[ENV_CONFIG_KEYS.LIST];
        if (typeof envVar === 'string') {
          this.config.listLimits = JSON.parse(envVar);
        }
      }

      if (process.env[ENV_CONFIG_KEYS.RELATION]) {
        const envVar = process.env[ENV_CONFIG_KEYS.RELATION];
        if (typeof envVar === 'string') {
          this.config.relationLimits = JSON.parse(envVar);
        }
      }

      if (process.env[ENV_CONFIG_KEYS.ENTITY_REACTION]) {
        const envVar = process.env[ENV_CONFIG_KEYS.ENTITY_REACTION];
        if (typeof envVar === 'string') {
          this.config.entityReactionLimits = JSON.parse(envVar);
        }
      }

      if (process.env[ENV_CONFIG_KEYS.LIST_REACTION]) {
        const envVar = process.env[ENV_CONFIG_KEYS.LIST_REACTION];
        if (typeof envVar === 'string') {
          this.config.listReactionLimits = JSON.parse(envVar);
        }
      }

      this.loggingService.debug('Record limits configuration initialized:', {
        config: this.config,
      });
    } catch (error) {
      this.loggingService.error('Failed to parse record limits config:', error);
      throw new Error('Invalid record limits configuration');
    }
  }

  /**
   * Interpolate values from the data object into the scope string.
   * Supports dot notation for nested properties using lodash.get
   * Examples:
   * - "${_kind}" -> value of data._kind
   * - "${author.name}" -> value of data.author.name
   * - "${_ownerUsers}" -> joins array values with comma
   * - "${deep.nested.property}" -> uses lodash.get for deep property access
   *
   * @param scope The scope string containing ${property} placeholders
   * @param data The data object to get values from
   * @returns Interpolated string with values from data
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
  private scopeToFilter(scope: string): Filter<any> {
    const parsed = parse(scope);
    const parsedSet = parsed.set as Set;
    const parsedFilter = parsed.filter as Filter<any>;

    // Handle both regular filters and sets
    if (parsedSet) {
      return new SetFilterBuilder(parsedSet, {
        filter: parsedFilter ?? {},
      }).build();
    }

    return parsedFilter ?? {};
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
      case 'entityreactions':
        return this.config.entityReactionLimits;
      case 'listreactions':
        return this.config.listReactionLimits;
      default:
        this.loggingService.warn(
          `No record limits configuration found for model: ${modelName}`,
        );

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
        const filter = this.scopeToFilter(interpolatedScope);

        // Check if new record would match this filter
        if (!this.recordMatchesFilter(newData, filter)) {
          return; // Skip if record wouldn't be counted in this scope
        }

        // Count existing records in scope
        const count = await repository.count(filter.where);

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
}
