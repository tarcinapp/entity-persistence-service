import {Fields} from '@loopback/repository';
import {mapValues} from 'lodash';

// Helper function to ensure boolean values in 'fields'
export function sanitizeFilterFields(filter?: {fields?: Fields}) {

  if (filter?.fields) {
    filter.fields = mapValues(filter.fields, value =>
      typeof value === 'string' && value === 'true' ? true :
        typeof value === 'string' && value === 'false' ? false :
          value  // Keep the original value if it's not 'true' or 'false'
    ) as Fields;
  }
}
