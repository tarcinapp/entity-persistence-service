import type { Fields } from '@loopback/repository';
import { isPlainObject, mapValues } from 'lodash';

/**
 * Sanitizes filter fields by:
 * 1. Converting string 'true'/'false' to boolean in fields
 * 2. Converting string 'null' to null in where clauses
 * 3. Converting types based on type hints in where/whereThrough clauses
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeFilterFields(filter?: any): void {
  if (!filter || typeof filter !== 'object') {
    return;
  }

  // Process each property in the filter object
  Object.keys(filter).forEach((key) => {
    const value = filter[key];

    // Convert string 'true'/'false' to actual booleans in fields property
    if (key === 'fields' && isPlainObject(value)) {
      filter[key] = mapValues(value, (fieldValue) =>
        typeof fieldValue === 'string' && fieldValue === 'true'
          ? true
          : typeof fieldValue === 'string' && fieldValue === 'false'
            ? false
            : fieldValue,
      ) as Fields;
    }
    // Handle nested objects including where and whereThrough clauses
    else if (isPlainObject(value)) {
      // Recursively process nested objects
      sanitizeFilterFields(value);

      // Process type conversions in where and whereThrough clauses
      if (key === 'where' || key === 'whereThrough') {
        processWhereClause(value);
      }

      // Special handling for whereThrough inside include arrays
      // Example: filter[include][0][whereThrough][count][type]=number
      if (key === 'include' && Array.isArray(value)) {
        value.forEach((inclusion) => {
          if (
            inclusion &&
            typeof inclusion === 'object' &&
            inclusion.whereThrough
          ) {
            processWhereClause(inclusion.whereThrough);
          }
        });
      }
    }
    // Recursively process arrays
    else if (Array.isArray(value)) {
      value.forEach((item) => sanitizeFilterFields(item));
    }
  });
}

/**
 * Processes where clauses by converting values based on type hints.
 * Examples:
 * - ?filter[where][age][type]=number&filter[where][age][gt]="18"
 * - ?filter[where][isActive][type]=boolean&filter[where][isActive][eq]="true"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processWhereClause(where: any): void {
  if (!where || typeof where !== 'object') {
    return;
  }

  Object.keys(where).forEach((fieldName) => {
    const value = where[fieldName];

    // Convert string 'null' to actual null
    if (typeof value === 'string' && value === 'null') {
      where[fieldName] = null;
    }
    // Process arrays (for operators like inq, between)
    else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' && item === 'null') {
          value[index] = null;
        } else if (isPlainObject(item)) {
          processWhereClause(item);
        }
      });
    }
    // Process objects that might contain operators and type hints
    else if (isPlainObject(value)) {
      // If object has a type property, convert values based on that type
      if (value.type) {
        const type = value.type;
        const operators = { ...value };
        delete operators.type;

        // Process each operator's value based on the specified type
        Object.keys(operators).forEach((operator) => {
          const operatorValue = operators[operator];

          // Handle number type conversions
          if (type === 'number') {
            if (Array.isArray(operatorValue)) {
              // Convert array values to numbers (for between, inq operators)
              operators[operator] = operatorValue.map((item) => {
                const parsed = Number(item);

                return !isNaN(parsed) ? parsed : item;
              });
            } else {
              // Convert single value to number
              const parsed = Number(operatorValue);
              if (!isNaN(parsed)) {
                operators[operator] = parsed;
              }
            }
          }
          // Handle boolean type conversions
          else if (type === 'boolean') {
            if (Array.isArray(operatorValue)) {
              // Convert array values to booleans
              operators[operator] = operatorValue.map((item) => {
                if (typeof item === 'string') {
                  return item.toLowerCase() === 'true';
                }

                return Boolean(item);
              });
            } else if (typeof operatorValue === 'string') {
              // Convert string to boolean
              operators[operator] = operatorValue.toLowerCase() === 'true';
            } else {
              // Convert other types to boolean
              operators[operator] = Boolean(operatorValue);
            }
          }
          // Additional type conversions can be added here
        });

        // Replace original object with processed values
        where[fieldName] = operators;
      }

      // Continue processing nested objects
      processWhereClause(value);
    }
  });
}
