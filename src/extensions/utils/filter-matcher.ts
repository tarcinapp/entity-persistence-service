import type { Condition, Where } from '@loopback/repository';
import _ from 'lodash';

/**
 * Utility class for matching records against MongoDB-style filters
 */
export class FilterMatcher {
  /**
   * Evaluates if a record would match a given filter
   * @param record The record to evaluate
   * @param whereClause The filter conditions to check
   * @returns boolean indicating if the record would match the filter
   */
  static matches<T extends object>(
    record: T,
    whereClause: Where<T> | undefined,
  ): boolean {
    if (!whereClause) {
      return true;
    }

    // Handle AND conditions
    if ('and' in whereClause && Array.isArray(whereClause.and)) {
      return whereClause.and.every((condition) =>
        FilterMatcher.matches(record, condition),
      );
    }

    // Handle OR conditions
    if ('or' in whereClause && Array.isArray(whereClause.or)) {
      return whereClause.or.some((condition) =>
        FilterMatcher.matches(record, condition),
      );
    }

    // Handle field conditions
    for (const [field, condition] of Object.entries(whereClause)) {
      const value = _.get(record, field);

      if (condition === null) {
        if (value !== null) {
          return false;
        }

        continue;
      }

      if (condition === undefined) {
        if (value !== undefined) {
          return false;
        }

        continue;
      }

      if (typeof condition === 'object') {
        if (!FilterMatcher.matchesOperatorCondition(value, condition)) {
          return false;
        }
      } else {
        if (Array.isArray(value)) {
          if (Array.isArray(condition)) {
            // For array-to-array comparison, check if arrays are equal
            if (_.isEqual(value, condition)) {
              continue;
            }

            // If not equal, check if condition is a subset of value
            if (condition.every((item) => value.includes(item))) {
              continue;
            }

            return false;
          } else if (!value.includes(condition)) {
            return false;
          }
        } else if (!_.isEqual(value, condition)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluates if a value matches an operator condition
   * @param value The value to check
   * @param condition The operator condition object
   * @returns boolean indicating if the value matches the condition
   */
  private static matchesOperatorCondition(
    value: any,
    condition: Condition<any>,
  ): boolean {
    if (!condition || typeof condition !== 'object') {
      return false;
    }

    // Handle array conditions
    if (Array.isArray(condition)) {
      if (!Array.isArray(value)) {
        return false;
      }

      // For array-to-array comparison, check if arrays are equal
      if (_.isEqual(value, condition)) {
        return true;
      }

      // If not equal, check if condition is a subset of value
      return condition.every((item) => value.includes(item));
    }

    // Handle array values
    if (Array.isArray(value)) {
      if (typeof condition === 'string' || typeof condition === 'number') {
        return value.includes(condition);
      }
    }

    // Handle operator conditions
    if (condition && typeof condition === 'object') {
      const operator = Object.keys(condition)[0];
      const operatorValue = condition[operator];

      // Convert dates to milliseconds for comparison
      const compareValue = FilterMatcher.toMillis(value);
      const compareOperand = FilterMatcher.toMillis(operatorValue);

      // Variables for all operations
      let start: any, end: any;
      let inqValues: any[], ninValues: any[];
      let pattern: RegExp;

      // Process array values if needed
      if (
        operator === 'between' &&
        Array.isArray(operatorValue) &&
        operatorValue.length === 2
      ) {
        start = FilterMatcher.toMillis(operatorValue[0]);
        end = FilterMatcher.toMillis(operatorValue[1]);
      }

      switch (operator) {
        case 'eq':
          if (Array.isArray(value)) {
            if (Array.isArray(compareOperand)) {
              // For array-to-array comparison, check if arrays have same elements
              const valueSet = new Set(value);
              const operandSet = new Set(compareOperand);
              if (valueSet.size !== operandSet.size) {
                return false;
              }

              for (const item of valueSet) {
                if (!operandSet.has(item)) {
                  return false;
                }
              }
            } else if (!value.includes(compareOperand)) {
              return false;
            }
          } else if (compareValue !== compareOperand) {
            return false;
          }

          break;

        case 'neq':
          if (Array.isArray(compareValue)) {
            if (compareValue.includes(compareOperand)) {
              return false;
            }
          } else if (compareValue === compareOperand) {
            return false;
          }

          break;

        case 'gt':
          if (!(compareValue > compareOperand)) {
            return false;
          }

          break;

        case 'gte':
          if (!(compareValue >= compareOperand)) {
            return false;
          }

          break;

        case 'lt':
          if (!(compareValue < compareOperand)) {
            return false;
          }

          break;

        case 'lte':
          if (!(compareValue <= compareOperand)) {
            return false;
          }

          break;

        case 'between':
          if (!Array.isArray(operatorValue) || operatorValue.length !== 2) {
            return false;
          }

          if (!(compareValue >= start && compareValue <= end)) {
            return false;
          }

          break;

        case 'inq':
          if (!Array.isArray(operatorValue)) {
            return false;
          }

          inqValues = operatorValue.map(FilterMatcher.toMillis);
          if (Array.isArray(compareValue)) {
            if (
              !compareValue.some((v) =>
                inqValues.includes(FilterMatcher.toMillis(v)),
              )
            ) {
              return false;
            }
          } else if (!inqValues.includes(compareValue)) {
            return false;
          }

          break;

        case 'nin':
          if (!Array.isArray(operatorValue)) {
            return false;
          }

          ninValues = operatorValue.map(FilterMatcher.toMillis);
          if (Array.isArray(compareValue)) {
            if (
              compareValue.some((v) =>
                ninValues.includes(FilterMatcher.toMillis(v)),
              )
            ) {
              return false;
            }
          } else if (ninValues.includes(compareValue)) {
            return false;
          }

          break;

        case 'like':
        case 'nlike': {
          if (typeof operatorValue !== 'string' || typeof value !== 'string') {
            return false;
          }

          const options = condition.options === 'i' ? 'i' : '';
          const escapedPattern = operatorValue
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars first
            .replace(/\\\\/g, '\\') // Handle escaped backslashes
            .replace(/\\\./g, '\\.') // Keep escaped dots as literal dots
            .replace(/\\\*/g, '.*') // Replace * with .*
            .replace(/%/g, '.*') // Replace % with .*
            .replace(/\\\\\./g, '\\.'); // Handle double-escaped dots
          pattern = new RegExp(escapedPattern, options);
          const matches = pattern.test(value);
          if (operator === 'like' ? !matches : matches) {
            return false;
          }

          break;
        }

        case 'ilike':
        case 'nilike': {
          if (typeof operatorValue !== 'string' || typeof value !== 'string') {
            return false;
          }

          const escapedPattern = operatorValue
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\\\*/g, '.*') // Replace * with .*
            .replace(/%/g, '.*'); // Replace % with .*
          pattern = new RegExp(escapedPattern, 'i');
          const matches = pattern.test(value);
          if (operator === 'ilike' ? !matches : matches) {
            return false;
          }

          break;
        }

        case 'regexp': {
          if (
            !(
              operatorValue instanceof RegExp ||
              typeof operatorValue === 'string'
            ) ||
            typeof value !== 'string'
          ) {
            return false;
          }

          let regex: RegExp;
          if (typeof operatorValue === 'string') {
            const match = operatorValue.match(/^\/(.+)\/([gimuy]*)$/);
            if (match) {
              // Handle /pattern/flags format
              regex = new RegExp(match[1], match[2]);
            } else {
              // Handle raw pattern
              regex = new RegExp(operatorValue);
            }
          } else {
            regex = operatorValue;
          }

          if (!regex.test(value)) {
            return false;
          }

          break;
        }

        case 'exists':
          if (operatorValue && value === undefined) {
            return false;
          }

          if (!operatorValue && value !== undefined) {
            return false;
          }

          break;

        default:
          return false;
      }
    }

    return true;
  }

  /**
   * Converts a value to milliseconds if it's a Date
   * @param value The value to convert
   * @returns The value in milliseconds if it's a Date, otherwise the original value
   */
  private static toMillis(value: any): any {
    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }

    return value;
  }
}
