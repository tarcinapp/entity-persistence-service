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

  Object.keys(where).forEach((fieldName) => {
    const value = where[fieldName];

    if (typeof value === 'string' && value === 'null') {
      where[fieldName] = null;
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' && item === 'null') {
          value[index] = null;
        } else if (isPlainObject(item)) {
          processWhereClause(item);
        }
      });
    } else if (isPlainObject(value)) {
      // Check if this object contains operators (like gt, lt, eq) and a type hint
      if (value.type) {
        const type = value.type;
        const operators = { ...value };
        delete operators.type;

        // Convert values based on type
        Object.keys(operators).forEach((operator) => {
          const operatorValue = operators[operator];
          if (type === 'number') {
            if (Array.isArray(operatorValue)) {
              // Handle array values (e.g., for between, inq operators)
              operators[operator] = operatorValue.map((item) => {
                const parsed = Number(item);

                return !isNaN(parsed) ? parsed : item;
              });
            } else {
              const parsed = Number(operatorValue);
              if (!isNaN(parsed)) {
                operators[operator] = parsed;
              }
            }
          } else if (type === 'boolean') {
            if (Array.isArray(operatorValue)) {
              // Handle array values for boolean type
              operators[operator] = operatorValue.map((item) => {
                if (typeof item === 'string') {
                  return item.toLowerCase() === 'true';
                }

                return Boolean(item);
              });
            } else if (typeof operatorValue === 'string') {
              operators[operator] = operatorValue.toLowerCase() === 'true';
            } else {
              operators[operator] = Boolean(operatorValue);
            }
          }
          // Add more type conversions here if needed
        });

        // Replace the original object with the processed operators
        where[fieldName] = operators;
      }

      // Continue processing nested objects
      processWhereClause(value);
    }
  });
}
