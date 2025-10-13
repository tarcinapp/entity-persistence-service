import type { Filter } from '@loopback/repository';
import type { LookupScope } from './filter-augmentation';
import { SetFilterBuilder } from '../utils/set-helper';

export function processLookups<T extends object>(
  filter: Filter<T> | undefined,
): void {
  function processLookupObject(lookup: LookupScope<T>): LookupScope<T> {
    if (typeof lookup === 'object') {
      // Process the current lookup object if it has a `set`
      if (lookup.set) {
        // Convert the lookup.scope to a proper Filter<T> format
        const scopeFilter: Filter<T> = {
          fields: lookup.scope?.fields as any,
          where: lookup.scope?.where,
          limit: lookup.scope?.limit,
          skip: lookup.scope?.skip,
          order: lookup.scope?.order,
          lookup: lookup.scope?.lookup,
        };

        const builtFilter = new SetFilterBuilder<T>(lookup.set, {
          filter: scopeFilter,
        }).build();

        // Update the scope with the built filter
        lookup.scope = {
          fields: builtFilter.fields as { [key: string]: boolean } | undefined,
          where: builtFilter.where,
          limit: builtFilter.limit,
          skip: builtFilter.skip,
          order: builtFilter.order as string[] | undefined,
          lookup: builtFilter.lookup,
        };
      }

      // Recursively process nested lookups in `scope.lookup`
      if (lookup.scope && Array.isArray(lookup.scope.lookup)) {
        lookup.scope.lookup = lookup.scope.lookup.map(
          (nestedLookup: LookupScope<T>) => processLookupObject(nestedLookup),
        );
      }
    }

    return lookup;
  }

  if (filter && Array.isArray(filter.lookup)) {
    filter.lookup = filter.lookup.map((lookup: LookupScope<T>) =>
      processLookupObject(lookup),
    );
  }
}