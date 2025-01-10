import type { Filter, InclusionFilter } from '@loopback/repository';
import { SetFilterBuilder } from '../extensions';

export function processIncludes<T extends object>(
  filter: Filter<T> | undefined,
): void {
  function processIncludeObject(include: InclusionFilter): InclusionFilter {
    if (typeof include === 'object') {
      // Process the current include object if it has a `set`
      if (include.set) {
        include.scope = new SetFilterBuilder<T>(include.set, {
          filter: include.scope as Filter<T> | undefined, // Explicit type assertion
        }).build();
      }

      if (include.setThrough) {
        include.whereThrough = new SetFilterBuilder<T>(include.setThrough, {
          filter: {
            where: include.whereThrough,
          },
        }).build().where;
      }

      // Recursively process nested includes in `scope.include`
      if (include.scope && Array.isArray(include.scope.include)) {
        include.scope.include = include.scope.include.map(
          (nestedInclude: InclusionFilter) =>
            processIncludeObject(nestedInclude),
        );
      }
    }
    return include;
  }

  if (filter && Array.isArray(filter.include)) {
    filter.include = filter.include.map((include: InclusionFilter) =>
      processIncludeObject(include),
    );
  }
}
