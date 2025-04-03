import { BindingKey, BindingScope, injectable, inject } from '@loopback/core';
import type { Filter, Where } from '@loopback/repository';
import type { Request } from '@loopback/rest';
import { RestBindings } from '@loopback/rest';
import type { ListToEntityRelation } from '../../models';

export const MongoPipelineHelperBindings = {
  HELPER: BindingKey.create<MongoPipelineHelper>(
    'extensions.utils.mongo-pipeline-helper',
  ),
} as const;

// Define types for MongoDB aggregation pipeline stages
export type LookupStage = {
  $lookup: {
    from: string;
    localField: string;
    foreignField: string;
    as: string;
  };
};

export type UnwindStage = {
  $unwind: {
    path: string;
    preserveNullAndEmptyArrays: boolean;
  };
};

export type ProjectStage = {
  $project: Record<string, any>;
};

export type LimitStage = {
  $limit: number;
};

export type MatchStage = {
  $match: Record<string, any>;
};

export type SortStage = {
  $sort: Record<string, 1 | -1>;
};

export type SkipStage = {
  $skip: number;
};

export type AddFieldsStage = {
  $addFields: Record<string, any>;
};

export type PipelineStage =
  | LookupStage
  | UnwindStage
  | ProjectStage
  | LimitStage
  | MatchStage
  | SortStage
  | SkipStage
  | AddFieldsStage;

@injectable({ scope: BindingScope.TRANSIENT })
export class MongoPipelineHelper {
  constructor(
    @inject(RestBindings.Http.REQUEST)
    private request: Request,
  ) {}

  /**
   * Build a complete MongoDB aggregation pipeline for list-entity relations
   */
  buildListEntityRelationPipeline(
    listCollectionName: string,
    entityCollectionName: string,
    finalLimit: number,
    filter?: Filter<ListToEntityRelation>,
    entityFilter?: Filter<any>,
    listFilter?: Filter<any>,
  ): PipelineStage[] {
    const pipeline: PipelineStage[] = [];

    // Add where conditions if they exist
    if (filter?.where) {
      const mongoQuery = this.buildMongoQuery(filter.where);
      pipeline.push({
        $match: mongoQuery,
      });
    }

    // Add lookups and metadata enrichment
    pipeline.push(
      // Lookup the list
      {
        $lookup: {
          from: listCollectionName,
          localField: '_listId',
          foreignField: '_id',
          as: 'list',
        },
      },
    );

    // Add list filter if specified
    if (listFilter?.where) {
      // Convert list filter to MongoDB query
      const listMongoQuery = this.buildMongoQuery(listFilter.where);

      // Prefix all fields with "list." since we're filtering on the joined list documents
      const prefixedListQuery = this.prefixQueryFields(listMongoQuery, 'list');

      // Add a match stage to filter based on list properties
      pipeline.push({
        $match: {
          // Ensure at least one list document exists in the list array
          'list.0': { $exists: true },
          ...prefixedListQuery,
        },
      });
    }

    pipeline.push(
      // Unwind the list array
      {
        $unwind: {
          path: '$list',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Lookup the entity
      {
        $lookup: {
          from: entityCollectionName,
          localField: '_entityId',
          foreignField: '_id',
          as: 'entity',
        },
      },
    );

    // Add entity filter if specified
    if (entityFilter?.where) {
      // Convert entity filter to MongoDB query
      const entityMongoQuery = this.buildMongoQuery(entityFilter.where);

      // Prefix all fields with "entity." since we're filtering on the joined entity documents
      const prefixedEntityQuery = this.prefixQueryFields(
        entityMongoQuery,
        'entity',
      );

      // Add a match stage to filter based on entity properties
      pipeline.push({
        $match: {
          // Ensure at least one entity document exists in the entity array
          'entity.0': { $exists: true },
          ...prefixedEntityQuery,
        },
      });
    }

    pipeline.push(
      // Unwind the entity array
      {
        $unwind: {
          path: '$entity',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Add metadata fields while preserving all existing fields
      {
        $addFields: {
          // Create _fromMetadata from list fields
          _fromMetadata: {
            _kind: '$list._kind',
            _name: '$list._name',
            _slug: '$list._slug',
            _validFromDateTime: '$list._validFromDateTime',
            _validUntilDateTime: '$list._validUntilDateTime',
            _visibility: '$list._visibility',
            _ownerUsers: '$list._ownerUsers',
            _ownerGroups: '$list._ownerGroups',
            _viewerUsers: '$list._viewerUsers',
            _viewerGroups: '$list._viewerGroups',
          },
          // Create _toMetadata from entity fields
          _toMetadata: {
            _kind: '$entity._kind',
            _name: '$entity._name',
            _slug: '$entity._slug',
            _validFromDateTime: '$entity._validFromDateTime',
            _validUntilDateTime: '$entity._validUntilDateTime',
            _visibility: '$entity._visibility',
            _ownerUsers: '$entity._ownerUsers',
            _ownerGroups: '$entity._ownerGroups',
            _viewerUsers: '$entity._viewerUsers',
            _viewerGroups: '$entity._viewerGroups',
          },
        },
      },
      // Project stage to exclude list and entity fields
      {
        $project: {
          list: 0,
          entity: 0,
        },
      },
    );

    // Handle field selection
    if (filter?.fields) {
      const fields = filter.fields;
      const trueFields = Object.entries(fields)
        .filter(([, value]) => value === true)
        .map(([key]) => key);

      const falseFields = Object.entries(fields)
        .filter(([, value]) => value === false)
        .map(([key]) => key);

      // Create projection object
      const projection: Record<string, 1 | 0> = {};

      if (trueFields.length > 0) {
        // If there are true fields, only include those fields
        // First set _id to 0 to exclude it by default
        projection['_id'] = 0;

        // Then include only the specified fields
        trueFields.forEach((field) => {
          projection[field] = 1;
        });

        // Handle metadata field selection if _fromMetadata or _toMetadata is included
        if (trueFields.includes('_fromMetadata')) {
          projection['_fromMetadata'] = 1;
        }

        if (trueFields.includes('_toMetadata')) {
          projection['_toMetadata'] = 1;
        }

        // If _id is explicitly requested, include it
        if (trueFields.includes('_id')) {
          projection['_id'] = 1;
        }
      } else if (falseFields.length > 0) {
        // If only false fields, exclude those fields
        falseFields.forEach((field) => {
          projection[field] = 0;
        });

        // Handle metadata field exclusion
        if (falseFields.includes('_fromMetadata')) {
          projection['_fromMetadata'] = 0;
        }

        if (falseFields.includes('_toMetadata')) {
          projection['_toMetadata'] = 0;
        }
      }

      // Add projection stage if there are fields to project
      if (Object.keys(projection).length > 0) {
        pipeline.push({
          $project: projection,
        });
      }
    }

    // Add order if specified
    if (filter?.order) {
      const sort: Record<string, 1 | -1> = {};
      const orderItems = Array.isArray(filter.order)
        ? filter.order
        : [filter.order];

      for (const orderItem of orderItems) {
        if (typeof orderItem === 'string') {
          // Handle format like "field ASC" or "field DESC"
          const [field, direction] = orderItem.split(' ');
          if (!field) {
            continue;
          } // Skip if field is empty

          sort[field] = direction === 'DESC' ? -1 : 1;
        } else if (typeof orderItem === 'object' && orderItem !== null) {
          // Handle format like { field: "ASC" } or { field: "DESC" }
          const [field, direction] = Object.entries(orderItem)[0];
          if (!field) {
            continue;
          } // Skip if field is empty

          sort[field] = direction === 'DESC' ? -1 : 1;
        }
      }

      if (Object.keys(sort).length > 0) {
        pipeline.push({ $sort: sort });
      }
    }

    // Add skip if specified
    if (filter?.skip) {
      pipeline.push({ $skip: filter.skip });
    }

    // Add limit stage if needed
    if (finalLimit > 0) {
      pipeline.push({ $limit: finalLimit });
    }

    return pipeline;
  }

  /**
   * Convert LoopBack where filter to MongoDB query format
   */
  private buildMongoQuery(
    where: Where<ListToEntityRelation>,
  ): Record<string, unknown> {
    const query: Record<string, unknown> = {};

    // Handle $and and $or at the top level
    if ('and' in where) {
      // Directly map LoopBack's "and" to MongoDB's "$and" - preserving structure
      query.$and = where.and.map((condition: Where<ListToEntityRelation>) => {
        return this.buildMongoQuery(condition);
      });

      return query;
    }

    if ('or' in where) {
      // Directly map LoopBack's "or" to MongoDB's "$or" - preserving structure
      query.$or = where.or.map((condition: Where<ListToEntityRelation>) => {
        return this.buildMongoQuery(condition);
      });

      return query;
    }

    // Handle nested conditions
    for (const [key, value] of Object.entries(where)) {
      if (typeof value === 'object' && value !== null) {
        // Check if this is a plain object that should be flattened
        if (
          this.isPlainObject(value) &&
          !this.isOperator(Object.keys(value)[0])
        ) {
          // Handle nested objects by flattening with dot notation
          const nestedConditions = this.flattenObject(value, key);

          // Merge any overlapping field conditions rather than overwriting
          for (const [nestedKey, nestedValue] of Object.entries(
            nestedConditions,
          )) {
            if (
              query[nestedKey] &&
              typeof query[nestedKey] === 'object' &&
              typeof nestedValue === 'object' &&
              !Array.isArray(query[nestedKey]) &&
              !Array.isArray(nestedValue)
            ) {
              // Merge MongoDB operators for the same field
              Object.assign(
                query[nestedKey] as Record<string, unknown>,
                nestedValue as Record<string, unknown>,
              );
            } else {
              query[nestedKey] = nestedValue;
            }
          }
        } else {
          // Handle comparison operators
          const operator = Object.keys(value)[0];
          const operatorValue = value[operator];

          // Convert date strings to Date objects for date fields
          const processedValue =
            this.isDateField(key) &&
            operatorValue !== null &&
            operatorValue !== undefined &&
            this.isValidDateString(operatorValue)
              ? new Date(
                  typeof operatorValue === 'string'
                    ? operatorValue
                    : String(operatorValue),
                )
              : operatorValue;

          switch (operator) {
            case 'eq':
              query[key] = processedValue;
              break;
            case 'neq':
              query[key] = { $ne: processedValue };
              break;
            case 'gt':
              query[key] = { $gt: processedValue };
              break;
            case 'gte':
              query[key] = { $gte: processedValue };
              break;
            case 'lt':
              query[key] = { $lt: processedValue };
              break;
            case 'lte':
              query[key] = { $lte: processedValue };
              break;
            case 'inq': {
              const inqValue = Array.isArray(processedValue)
                ? processedValue
                : [processedValue];
              query[key] = { $in: inqValue };
              break;
            }
            case 'nin': {
              const ninValue = Array.isArray(processedValue)
                ? processedValue
                : [processedValue];
              query[key] = { $nin: ninValue };
              break;
            }
            case 'between': {
              const betweenCondition: Record<string, unknown> = {};

              // Only add lower bound if it exists
              if (
                processedValue[0] !== null &&
                processedValue[0] !== undefined
              ) {
                betweenCondition.$gte =
                  this.isDateField(key) &&
                  this.isValidDateString(processedValue[0])
                    ? new Date(
                        typeof processedValue[0] === 'string'
                          ? processedValue[0]
                          : String(processedValue[0]),
                      )
                    : processedValue[0];
              }

              // Only add upper bound if it exists
              if (
                processedValue[1] !== null &&
                processedValue[1] !== undefined
              ) {
                betweenCondition.$lte =
                  this.isDateField(key) &&
                  this.isValidDateString(processedValue[1])
                    ? new Date(
                        typeof processedValue[1] === 'string'
                          ? processedValue[1]
                          : String(processedValue[1]),
                      )
                    : processedValue[1];
              }

              // If there's already a condition for this field, merge with it
              if (
                query[key] &&
                typeof query[key] === 'object' &&
                !Array.isArray(query[key])
              ) {
                Object.assign(
                  query[key] as Record<string, unknown>,
                  betweenCondition,
                );
              } else {
                query[key] = betweenCondition;
              }

              break;
            }
            case 'exists':
              query[key] = { $exists: Boolean(processedValue) };
              break;
            case 'like':
              query[key] = { $regex: processedValue.replace(/%/g, '.*') };
              break;
            case 'ilike':
              query[key] = {
                $regex: processedValue.replace(/%/g, '.*'),
                $options: 'i',
              };
              break;
            case 'and':
              query[key] = {
                $and: processedValue.map(
                  (condition: Where<ListToEntityRelation>) =>
                    this.buildMongoQuery(condition),
                ),
              };
              break;
            case 'or':
              query[key] = {
                $or: processedValue.map(
                  (condition: Where<ListToEntityRelation>) =>
                    this.buildMongoQuery(condition),
                ),
              };
              break;
            default: {
              // If it's a nested operator structure, treat it as a nested condition
              const nestedQuery = this.buildMongoQuery(value);

              // If there's already a condition for this field, merge with it
              if (
                query[key] &&
                typeof query[key] === 'object' &&
                !Array.isArray(query[key])
              ) {
                Object.assign(
                  query[key] as Record<string, unknown>,
                  nestedQuery,
                );
              } else {
                query[key] = nestedQuery;
              }

              break;
            }
          }
        }
      } else {
        // Handle direct value assignments
        query[key] =
          this.isDateField(key) &&
          value !== null &&
          value !== undefined &&
          this.isValidDateString(value)
            ? new Date(typeof value === 'string' ? value : String(value))
            : value;
      }
    }

    return query;
  }

  /**
   * Check if the given key is a LoopBack operator
   */
  private isOperator(key: string): boolean {
    const operators = [
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'inq',
      'nin',
      'between',
      'exists',
      'like',
      'ilike',
      'and',
      'or',
    ];

    return operators.includes(key);
  }

  /**
   * Check if the value is a plain object (not array, null, etc.)
   */
  private isPlainObject(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  /**
   * Flatten a nested object with dot notation
   */
  private flattenObject(
    obj: Record<string, unknown>,
    prefix = '',
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (this.isPlainObject(value) && !this.isOperator(key)) {
        // Recursively flatten nested objects
        const nested = this.flattenObject(
          value as Record<string, unknown>,
          newKey,
        );
        Object.assign(result, nested);
      } else if (
        typeof value === 'object' &&
        value !== null &&
        this.isOperator(key)
      ) {
        // Handle operator at the nested level
        const mongoOperator = this.loopbackToMongoOperator(key);

        // Process value for field (including date handling)
        const processedValue =
          this.isDateField(prefix) &&
          value !== null &&
          value !== undefined &&
          this.isValidDateString(value)
            ? new Date(typeof value === 'string' ? value : String(value))
            : value;

        // If this field already has conditions, add to them instead of overwriting
        if (result[prefix] && typeof result[prefix] === 'object') {
          (result[prefix] as Record<string, unknown>)[mongoOperator] =
            processedValue;
        } else {
          result[prefix] = { [mongoOperator]: processedValue };
        }
      } else {
        // Handle leaf values
        if (this.isOperator(key)) {
          // Convert operator to MongoDB format
          const mongoOperator = this.loopbackToMongoOperator(key);

          // Process value if it's a date field
          const processedValue =
            this.isDateField(prefix) &&
            value !== null &&
            value !== undefined &&
            this.isValidDateString(value)
              ? new Date(typeof value === 'string' ? value : String(value))
              : value;

          // If this field already has conditions, add to them instead of overwriting
          if (result[prefix] && typeof result[prefix] === 'object') {
            // Special cases for array operators
            if (key === 'inq') {
              const inqValue = Array.isArray(processedValue)
                ? processedValue
                : [processedValue];
              (result[prefix] as Record<string, unknown>).$in = inqValue;
            } else if (key === 'nin') {
              const ninValue = Array.isArray(processedValue)
                ? processedValue
                : [processedValue];
              (result[prefix] as Record<string, unknown>).$nin = ninValue;
            } else if (key === 'between') {
              const operatorValue = value as [unknown, unknown];

              if (operatorValue[0] !== null && operatorValue[0] !== undefined) {
                (result[prefix] as Record<string, unknown>).$gte =
                  this.isDateField(prefix) &&
                  this.isValidDateString(operatorValue[0] as string)
                    ? new Date(operatorValue[0] as string)
                    : operatorValue[0];
              }

              if (operatorValue[1] !== null && operatorValue[1] !== undefined) {
                (result[prefix] as Record<string, unknown>).$lte =
                  this.isDateField(prefix) &&
                  this.isValidDateString(operatorValue[1] as string)
                    ? new Date(operatorValue[1] as string)
                    : operatorValue[1];
              }
            } else if (key === 'exists') {
              (result[prefix] as Record<string, unknown>).$exists =
                Boolean(value);
            } else {
              (result[prefix] as Record<string, unknown>)[mongoOperator] =
                processedValue;
            }
          } else {
            // Handle special case for array operators
            if (key === 'inq') {
              const inqValue = Array.isArray(processedValue)
                ? processedValue
                : [processedValue];
              result[prefix] = { $in: inqValue };
            } else if (key === 'nin') {
              const ninValue = Array.isArray(processedValue)
                ? processedValue
                : [processedValue];
              result[prefix] = { $nin: ninValue };
            } else if (key === 'between') {
              const betweenCondition: Record<string, unknown> = {};
              const operatorValue = value as [unknown, unknown];

              if (operatorValue[0] !== null && operatorValue[0] !== undefined) {
                betweenCondition.$gte =
                  this.isDateField(prefix) &&
                  this.isValidDateString(operatorValue[0] as string)
                    ? new Date(operatorValue[0] as string)
                    : operatorValue[0];
              }

              if (operatorValue[1] !== null && operatorValue[1] !== undefined) {
                betweenCondition.$lte =
                  this.isDateField(prefix) &&
                  this.isValidDateString(operatorValue[1] as string)
                    ? new Date(operatorValue[1] as string)
                    : operatorValue[1];
              }

              result[prefix] = betweenCondition;
            } else if (key === 'exists') {
              // Ensure exists operator receives a boolean value
              result[prefix] = { $exists: Boolean(value) };
            } else {
              result[prefix] = { [mongoOperator]: processedValue };
            }
          }
        } else {
          result[newKey] = value;
        }
      }
    }

    return result;
  }

  /**
   * Convert LoopBack operator to MongoDB operator
   */
  private loopbackToMongoOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      eq: '$eq',
      neq: '$ne',
      gt: '$gt',
      gte: '$gte',
      lt: '$lt',
      lte: '$lte',
      inq: '$in',
      nin: '$nin',
      like: '$regex',
      ilike: '$regex',
      exists: '$exists',
    };

    return operatorMap[operator] || operator;
  }

  /**
   * Check if a field is a date field
   */
  private isDateField(field: string): boolean {
    return (
      field === '_validFromDateTime' ||
      field === '_validUntilDateTime' ||
      field.endsWith('._validFromDateTime') ||
      field.endsWith('._validUntilDateTime') ||
      field.endsWith('._createdDateTime') ||
      field.endsWith('._lastUpdatedDateTime')
    );
  }

  /**
   * Check if a string is a valid date that can be parsed
   */
  private isValidDateString(value: unknown): boolean {
    if (typeof value !== 'string' && !(value instanceof Date)) {
      return false;
    }

    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }

    // Try to create a date and check if it's valid
    const date = new Date(value);

    return !isNaN(date.getTime());
  }

  /**
   * Helper method to prefix all fields in a MongoDB query with a given prefix
   * Useful for filtering on joined collections in aggregation pipelines
   */
  private prefixQueryFields(
    query: Record<string, unknown>,
    prefix: string,
  ): Record<string, unknown> {
    const prefixedQuery: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(query)) {
      // Handle MongoDB operators (keys starting with $)
      if (key.startsWith('$')) {
        if (Array.isArray(value)) {
          // Handle $and, $or, $nor operators which contain arrays of conditions
          prefixedQuery[key] = value.map((condition) =>
            this.prefixQueryFields(
              condition as Record<string, unknown>,
              prefix,
            ),
          );
        } else {
          // Keep other operators unchanged
          prefixedQuery[key] = value;
        }
      } else {
        // Handle regular field conditions
        const prefixedKey = `${prefix}.${key}`;

        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          // Check if this is an operator object ($eq, $gt, etc.)
          const firstKey = Object.keys(value)[0];
          if (firstKey?.startsWith('$')) {
            // This is an operator object, keep it as is
            prefixedQuery[prefixedKey] = value;
          } else {
            // This is a nested object, recurse
            prefixedQuery[prefixedKey] = this.prefixQueryFields(
              value as Record<string, unknown>,
              '',
            );
          }
        } else {
          // Simple value assignment
          prefixedQuery[prefixedKey] = value;
        }
      }
    }

    return prefixedQuery;
  }
}
