import { Fields } from '@loopback/repository';
import { isPlainObject, mapValues } from 'lodash';

// Helper function to ensure boolean values in 'fields'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeFilterFields(filter?: any): void {
  if (!filter || typeof filter !== 'object') return;

  // Check if the current object has a `fields` property
  if (filter.fields) {
    filter.fields = mapValues(
      filter.fields,
      (value) =>
        typeof value === 'string' && value === 'true'
          ? true
          : typeof value === 'string' && value === 'false'
            ? false
            : value, // Keep the original value if it's not 'true' or 'false'
    ) as Fields;
  }

  // Recursively sanitize any nested objects
  for (const key of Object.keys(filter)) {
    if (isPlainObject(filter[key]) || Array.isArray(filter[key])) {
      if (Array.isArray(filter[key])) {
        // For arrays, apply recursively to each element
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter[key].forEach((item: any) => sanitizeFilterFields(item));
      } else {
        // For objects, apply recursively
        sanitizeFilterFields(filter[key]);
      }
    }
  }
}
