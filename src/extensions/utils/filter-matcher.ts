import type { Where } from '@loopback/repository';
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
        // Direct equality comparison
        // For arrays, check if the array contains the value (MongoDB behavior)
        if (Array.isArray(value)) {
          if (!value.includes(condition)) {
            return false;
          }
        } else if (value !== condition) {
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
    condition: object,
  ): boolean {
    if (!condition || typeof condition !== 'object') {
      return false;
    }

    // Handle each operator
    for (const [operator, operand] of Object.entries(condition)) {
      // Convert dates to milliseconds for comparison
      const compareValue = FilterMatcher.toMillis(value);
      const compareOperand = FilterMatcher.toMillis(operand);

      // Variables for array operations
      let start: any, end: any;
      let inqValues: any[], ninValues: any[];

      switch (operator) {
        case 'eq':
          // For arrays, check if array contains the value
          if (Array.isArray(compareValue)) {
            if (!compareValue.includes(compareOperand)) {
              return false;
            }
          } else if (compareValue !== compareOperand) {
            return false;
          }

          break;

        case 'neq':
          // For arrays, check if array does not contain the value
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
          if (!Array.isArray(operand) || operand.length !== 2) {
            return false;
          }

          [start, end] = operand.map(FilterMatcher.toMillis);
          if (!(compareValue >= start && compareValue <= end)) {
            return false;
          }

          break;

        case 'inq':
          if (!Array.isArray(operand)) {
            return false;
          }

          inqValues = operand.map(FilterMatcher.toMillis);
          // For arrays, check if any array element is in the inq values
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
          if (!Array.isArray(operand)) {
            return false;
          }

          ninValues = operand.map(FilterMatcher.toMillis);
          // For arrays, check if all array elements are not in nin values
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
          if (typeof operand !== 'string') {
            return false;
          }

          if (
            !new RegExp(operand.replace(/%/g, '.*')).test(String(compareValue))
          ) {
            return false;
          }

          break;

        case 'nlike':
          if (typeof operand !== 'string') {
            return false;
          }

          if (
            new RegExp(operand.replace(/%/g, '.*')).test(String(compareValue))
          ) {
            return false;
          }

          break;

        case 'regexp':
          if (!(operand instanceof RegExp || typeof operand === 'string')) {
            return false;
          }

          if (!new RegExp(operand).test(String(compareValue))) {
            return false;
          }

          break;

        case 'exists':
          if (operand && compareValue === undefined) {
            return false;
          }

          if (!operand && compareValue !== undefined) {
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
   * Converts a value to milliseconds if it's a date, otherwise returns the value as is
   * @param value The value to convert
   * @returns The value in milliseconds if it's a date, otherwise the original value
   */
  private static toMillis(value: any): any {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).getTime();
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    return value;
  }
}
