import { BindingKey, Getter, injectable } from '@loopback/core';
import { Filter, repository } from '@loopback/repository';
import { get, set } from 'lodash';
import {
  GenericEntity,
  GenericEntityRelations,
  List,
  ListRelations,
} from '../../models';
import { EntityRepository } from '../../repositories/entity.repository';
import { ListRepository } from '../../repositories/list.repository';
import { LookupScope } from '../types/filter-augmentation';

/**
 * Validates if a string is a valid GUID format
 * @param id - The string to validate
 * @returns boolean indicating if the string is a valid GUID
 */
const isValidGuid = (id: string): boolean => {
  const guidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return guidRegex.test(id);
};

type ReferenceType = 'entity' | 'list';

interface ReferenceInfo {
  type: ReferenceType;
  id: string;
  uri: string;
}

type ResolvedReference =
  | (GenericEntity & GenericEntityRelations)
  | (List & ListRelations);

/**
 * Parse a reference URI and return reference type and ID
 * @param uri - The reference URI to parse
 * @returns ReferenceInfo containing the type and ID, or null if invalid
 */
const parseReferenceUri = (uri: string): ReferenceInfo | null => {
  if (typeof uri !== 'string') {
    return null;
  }

  if (uri.startsWith('tapp://localhost/entities/')) {
    const id = uri.split('/').pop();
    if (id && isValidGuid(id)) {
      return { type: 'entity', id, uri };
    }
  } else if (uri.startsWith('tapp://localhost/lists/')) {
    const id = uri.split('/').pop();
    if (id && isValidGuid(id)) {
      return { type: 'list', id, uri };
    }
  }

  return null;
};

/**
 * Binding key for the LookupHelper service.
 * This helper is used to resolve entity and list references in the system.
 * Supports nested property lookups using dot notation (e.g., 'foo.bar.baz')
 */
export const LookupBindings = {
  HELPER: BindingKey.create<LookupHelper>('extensions.lookup.helper'),
} as const;

/**
 * Helper class that handles the resolution of entity and list references.
 * It supports both single item and array processing,
 * with the ability to handle nested lookups and field filtering.
 */
@injectable()
export class LookupHelper {
  constructor(
    @repository.getter('EntityRepository')
    private entityRepositoryGetter: Getter<EntityRepository>,
    @repository.getter('ListRepository')
    private listRepositoryGetter: Getter<ListRepository>,
  ) {}

  /**
   * Process lookups for an array of items.
   * This method resolves references for each item in the array based on the lookup filter.
   *
   * @param items - Array of items to process
   * @param filter - Filter containing lookup definitions
   * @returns Promise resolving to processed items with resolved references
   */
  async processLookupForArray<T extends GenericEntity | List>(
    items: (T & (GenericEntityRelations | ListRelations))[],
    filter?: Filter<T>,
  ): Promise<(T & (GenericEntityRelations | ListRelations))[]> {
    const lookup = filter?.lookup;
    if (!lookup) {
      return items;
    }

    let processedItems = items;
    for (const lookupDef of lookup) {
      processedItems = await this.processLookupBatch(processedItems, lookupDef);
    }

    return processedItems;
  }

  /**
   * Process lookups for a single item.
   * This method resolves references for a single item based on the lookup filter.
   *
   * @param item - Single item to process
   * @param filter - Filter containing lookup definitions
   * @returns Promise resolving to processed item with resolved references
   */
  async processLookupForOne<T extends GenericEntity | List>(
    item: T & (GenericEntityRelations | ListRelations),
    filter?: Filter<T>,
  ): Promise<T & (GenericEntityRelations | ListRelations)> {
    const lookup = filter?.lookup;
    if (!lookup) {
      return item;
    }

    let processedItem = item;
    for (const lookupDef of lookup) {
      processedItem = (
        await this.processLookupBatch([processedItem], lookupDef)
      )[0];
    }

    return processedItem;
  }

  /**
   * Process a batch of items for a specific lookup definition.
   * This is the core method that handles the actual reference resolution.
   *
   * @param items - Array of items to process
   * @param lookup - Lookup configuration defining what and how to resolve
   * @returns Promise resolving to processed items
   */
  private async processLookupBatch<T extends GenericEntity | List>(
    items: (T & (GenericEntityRelations | ListRelations))[],
    lookup: LookupScope<T>,
  ): Promise<(T & (GenericEntityRelations | ListRelations))[]> {
    const { prop, scope } = lookup;

    // Group references by type (entity or list)
    const entityReferences = new Map<string, Set<string>>();
    const listReferences = new Map<string, Set<string>>();
    const referenceMap = new Map<
      string,
      {
        item: T & (GenericEntityRelations | ListRelations);
        isArray: boolean;
        path: string;
        references: ReferenceInfo[];
      }
    >();

    // First pass: collect and categorize all references
    for (const item of items) {
      const references = get(item, prop);
      if (!references) {
        continue;
      }

      // Handle both array and single reference cases
      const refArray = (
        Array.isArray(references) ? references : [references]
      ) as string[];
      const validRefs = refArray
        .map((ref: string) => parseReferenceUri(ref))
        .filter((ref): ref is ReferenceInfo => ref !== null);

      if (validRefs.length > 0) {
        // Store reference information
        referenceMap.set(item._id, {
          item,
          isArray: Array.isArray(references),
          path: prop,
          references: validRefs,
        });

        // Categorize references by type
        for (const ref of validRefs) {
          if (ref.type === 'entity') {
            if (!entityReferences.has(item._id)) {
              entityReferences.set(item._id, new Set());
            }

            entityReferences.get(item._id)!.add(ref.id);
          } else {
            if (!listReferences.has(item._id)) {
              listReferences.set(item._id, new Set());
            }

            listReferences.get(item._id)!.add(ref.id);
          }
        }
      }
    }

    if (entityReferences.size === 0 && listReferences.size === 0) {
      return items;
    }

    // Fetch referenced entities and lists in parallel
    const [resolvedEntities, resolvedLists] = await Promise.all([
      this.fetchReferencedEntities(
        Array.from(
          new Set(
            Array.from(entityReferences.values()).flatMap((values) =>
              Array.from(values),
            ),
          ),
        ),
        scope,
      ),
      this.fetchReferencedLists(
        Array.from(
          new Set(
            Array.from(listReferences.values()).flatMap((values) =>
              Array.from(values),
            ),
          ),
        ),
        scope,
      ),
    ]);

    // Create lookup maps for both entities and lists
    const resolvedEntitiesMap = new Map(
      resolvedEntities.map((entity) => [entity._id, entity]),
    );
    const resolvedListsMap = new Map(
      resolvedLists.map((list) => [list._id, list]),
    );

    // Replace references with resolved objects
    return items.map((item) => {
      const referenceInfo = referenceMap.get(item._id);
      if (!referenceInfo) {
        return item;
      }

      const { isArray, path, references } = referenceInfo;

      // Get all valid references in the order they appear in resolvedEntities/resolvedLists
      const validRefs = references.filter((ref) => {
        if (ref.type === 'entity') {
          return resolvedEntitiesMap.has(ref.id);
        } else {
          return resolvedListsMap.has(ref.id);
        }
      });

      // Create ordered arrays of resolved references by filtering the original arrays
      const orderedEntityRefs = resolvedEntities.filter((entity) =>
        validRefs.some((ref) => ref.type === 'entity' && ref.id === entity._id),
      );

      const orderedListRefs = resolvedLists.filter((list) =>
        validRefs.some((ref) => ref.type === 'list' && ref.id === list._id),
      );

      // Combine the ordered arrays
      const orderedRefs = [...orderedEntityRefs, ...orderedListRefs];

      // Apply field filtering to resolved references if fields are specified
      const filteredRefs = scope?.fields
        ? orderedRefs.map((ref) => {
            const result = { ...ref };
            const fields = scope.fields ?? {};

            // Handle inclusion fields (true)
            const inclusionFields = Object.entries(fields)
              .filter(([_, value]) => value === true)
              .map(([key]) => key);

            if (inclusionFields.length > 0) {
              // If we have inclusion fields, only keep those fields
              Object.keys(result).forEach((key) => {
                if (!inclusionFields.includes(key)) {
                  delete result[key];
                }
              });
            } else {
              // If we have exclusion fields, remove those fields
              Object.entries(fields)
                .filter(([_, value]) => value === false)
                .forEach(([key]) => {
                  delete result[key];
                });
            }

            return result as ResolvedReference;
          })
        : orderedRefs;

      // Set the resolved references back on the item
      if (isArray) {
        set(item, path, filteredRefs);
      } else {
        set(item, path, filteredRefs[0] ?? null);
      }

      return item;
    });
  }

  /**
   * Fetch referenced entities from the repository
   */
  private async fetchReferencedEntities(
    entityIds: string[],
    scope?: any,
  ): Promise<(GenericEntity & GenericEntityRelations)[]> {
    if (entityIds.length === 0) {
      return [];
    }

    const entityRepository = await this.entityRepositoryGetter();

    // Handle field selection
    const fields = scope?.fields;
    let adjustedFields = fields;

    if (fields) {
      // Check if there are any inclusion fields (true)
      const hasInclusionFields = Object.values(fields).some(
        (value) => value === true,
      );

      if (hasInclusionFields) {
        // If we have inclusion fields, ensure _id is included for internal use
        adjustedFields = {
          ...fields,
          _id: true,
        };
      } else {
        // If we only have exclusion fields, remove _id from exclusions if present
        adjustedFields = Object.fromEntries(
          Object.entries(fields).filter(([key]) => key !== '_id'),
        );
      }
    }

    return entityRepository.find({
      ...scope,
      fields: adjustedFields,
      where: {
        _id: { inq: entityIds },
        ...(scope?.where ?? {}),
      },
    });
  }

  /**
   * Fetch referenced lists from the repository
   */
  private async fetchReferencedLists(
    listIds: string[],
    scope?: any,
  ): Promise<(List & ListRelations)[]> {
    if (listIds.length === 0) {
      return [];
    }

    const listRepository = await this.listRepositoryGetter();

    // Handle field selection
    const fields = scope?.fields;
    let adjustedFields = fields;

    if (fields) {
      // Check if there are any inclusion fields (true)
      const hasInclusionFields = Object.values(fields).some(
        (value) => value === true,
      );

      if (hasInclusionFields) {
        // If we have inclusion fields, ensure _id is included for internal use
        adjustedFields = {
          ...fields,
          _id: true,
        };
      } else {
        // If we only have exclusion fields, remove _id from exclusions if present
        adjustedFields = Object.fromEntries(
          Object.entries(fields).filter(([key]) => key !== '_id'),
        );
      }
    }

    return listRepository.find({
      ...scope,
      fields: adjustedFields,
      where: {
        _id: { inq: listIds },
        ...(scope?.where ?? {}),
      },
    });
  }
}

/**
 * Factory function to create a new LookupHelper instance.
 *
 * @param entityRepositoryGetter - Getter function for the EntityRepository
 * @param listRepositoryGetter - Getter function for the ListRepository
 * @returns A new instance of LookupHelper
 */
export function createLookupHelper(
  entityRepositoryGetter: Getter<EntityRepository>,
  listRepositoryGetter: Getter<ListRepository>,
): LookupHelper {
  return new LookupHelper(entityRepositoryGetter, listRepositoryGetter);
}
