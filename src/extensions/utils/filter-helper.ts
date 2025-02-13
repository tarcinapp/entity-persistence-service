import type { Fields } from '@loopback/repository';
import { isPlainObject, mapValues } from 'lodash';

// Helper function to ensure boolean values in 'fields' and convert 'null' strings to null in where clauses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeFilterFields(filter?: any): void {
  if (!filter || typeof filter !== 'object') {
    return;
  }

  // Process each property in the object
  Object.keys(filter).forEach((key) => {
    const value = filter[key];

    // Handle fields property - convert 'true'/'false' strings to booleans
    if (key === 'fields' && isPlainObject(value)) {
      filter[key] = mapValues(value, (fieldValue) =>
        typeof fieldValue === 'string' && fieldValue === 'true'
          ? true
          : typeof fieldValue === 'string' && fieldValue === 'false'
            ? false
            : fieldValue,
      ) as Fields;
    }
    // Process all objects (including 'where') recursively
    else if (isPlainObject(value)) {
      sanitizeFilterFields(value);
      if (key === 'where') {
        processWhereClause(value);
      }
    }
    // Process arrays
    else if (Array.isArray(value)) {
      value.forEach((item) => sanitizeFilterFields(item));
    }
  });
}

// Helper function to recursively process where clauses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processWhereClause(where: any): void {
  if (!where || typeof where !== 'object') {
    return;
  }

  Object.keys(where).forEach((key) => {
    const value = where[key];

    if (typeof value === 'string' && value === 'null') {
      where[key] = null;
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' && item === 'null') {
          value[index] = null;
        } else if (isPlainObject(item)) {
          processWhereClause(item);
        }
      });
    } else if (isPlainObject(value)) {
      processWhereClause(value);
    }
  });
}
