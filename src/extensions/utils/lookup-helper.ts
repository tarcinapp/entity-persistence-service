import { BindingKey, Getter, injectable } from '@loopback/core';
import { Filter, repository } from '@loopback/repository';
import { get, set } from 'lodash';
import {
  GenericEntity,
  GenericEntityRelations,
  List,
  ListRelations,
  EntityReaction,
  ListReaction,
} from '../../models';
import { EntityReactionsRepository } from '../../repositories/entity-reactions.repository';
import { EntityRepository } from '../../repositories/entity.repository';
import { ListReactionsRepository } from '../../repositories/list-reactions.repository';
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

type ReferenceType = 'entity' | 'list' | 'entity-reaction' | 'list-reaction';

interface ReferenceInfo {
  type: ReferenceType;
  id: string;
  uri: string;
}

type ResolvedReference =
  | (GenericEntity & GenericEntityRelations)
  | (List & ListRelations)
  | EntityReaction
  | ListReaction;

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
  } else if (uri.startsWith('tapp://localhost/entity-reactions/')) {
    const id = uri.split('/').pop();
    if (id && isValidGuid(id)) {
      return { type: 'entity-reaction', id, uri };
    }
  } else if (uri.startsWith('tapp://localhost/list-reactions/')) {
    const id = uri.split('/').pop();
    if (id && isValidGuid(id)) {
      return { type: 'list-reaction', id, uri };
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
    @repository.getter('EntityReactionsRepository')
    private entityReactionsRepositoryGetter: Getter<EntityReactionsRepository>,
    @repository.getter('ListReactionsRepository')
    private listReactionsRepositoryGetter: Getter<ListReactionsRepository>,
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

    // Group references by type
    const entityReferences = new Map<string, Set<string>>();
    const listReferences = new Map<string, Set<string>>();
    const entityReactionReferences = new Map<string, Set<string>>();
    const listReactionReferences = new Map<string, Set<string>>();
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

      const refArray = (
        Array.isArray(references) ? references : [references]
      ) as string[];
      const validRefs = refArray
        .map((ref: string) => parseReferenceUri(ref))
        .filter((ref): ref is ReferenceInfo => ref !== null);

      if (validRefs.length > 0) {
        referenceMap.set(item._id, {
          item,
          isArray: Array.isArray(references),
          path: prop,
          references: validRefs,
        });

        for (const ref of validRefs) {
          let targetMap: Map<string, Set<string>>;
          switch (ref.type) {
            case 'entity':
              targetMap = entityReferences;
              break;
            case 'list':
              targetMap = listReferences;
              break;
            case 'entity-reaction':
              targetMap = entityReactionReferences;
              break;
            case 'list-reaction':
              targetMap = listReactionReferences;
              break;
          }

          if (!targetMap.has(item._id)) {
            targetMap.set(item._id, new Set());
          }

          targetMap.get(item._id)!.add(ref.id);
        }
      }
    }

    if (
      entityReferences.size === 0 &&
      listReferences.size === 0 &&
      entityReactionReferences.size === 0 &&
      listReactionReferences.size === 0
    ) {
      return items;
    }

    // Fetch referenced items in parallel
    const [
      resolvedEntities,
      resolvedLists,
      resolvedEntityReactions,
      resolvedListReactions,
    ] = await Promise.all([
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
      this.fetchReferencedEntityReactions(
        Array.from(
          new Set(
            Array.from(entityReactionReferences.values()).flatMap((values) =>
              Array.from(values),
            ),
          ),
        ),
        scope,
      ),
      this.fetchReferencedListReactions(
        Array.from(
          new Set(
            Array.from(listReactionReferences.values()).flatMap((values) =>
              Array.from(values),
            ),
          ),
        ),
        scope,
      ),
    ]);

    // Create lookup maps for all types while preserving order
    const resolvedEntitiesMap = new Map<
      string,
      { index: number; value: GenericEntity & GenericEntityRelations }
    >();
    resolvedEntities.forEach((entity, index) => {
      resolvedEntitiesMap.set(entity._id, { index, value: entity });
    });

    const resolvedListsMap = new Map<
      string,
      { index: number; value: List & ListRelations }
    >();
    resolvedLists.forEach((list, index) => {
      resolvedListsMap.set(list._id, { index, value: list });
    });

    const resolvedEntityReactionsMap = new Map<
      string,
      { index: number; value: EntityReaction }
    >();
    resolvedEntityReactions.forEach((reaction, index) => {
      resolvedEntityReactionsMap.set(reaction._id, { index, value: reaction });
    });

    const resolvedListReactionsMap = new Map<
      string,
      { index: number; value: ListReaction }
    >();
    resolvedListReactions.forEach((reaction, index) => {
      resolvedListReactionsMap.set(reaction._id, { index, value: reaction });
    });

    // Replace references with resolved objects
    return items.map((item) => {
      const referenceInfo = referenceMap.get(item._id);
      if (!referenceInfo) {
        return item;
      }

      const { isArray, path, references } = referenceInfo;

      // Get all valid references with their original order information
      const validRefsWithOrder = references
        .map((ref) => {
          let resolvedRef:
            | { index: number; value: ResolvedReference }
            | undefined;
          switch (ref.type) {
            case 'entity':
              resolvedRef = resolvedEntitiesMap.get(ref.id);
              break;
            case 'list':
              resolvedRef = resolvedListsMap.get(ref.id);
              break;
            case 'entity-reaction':
              resolvedRef = resolvedEntityReactionsMap.get(ref.id);
              break;
            case 'list-reaction':
              resolvedRef = resolvedListReactionsMap.get(ref.id);
              break;
          }

          return resolvedRef ? { type: ref.type, ...resolvedRef } : undefined;
        })
        .filter(
          (
            ref,
          ): ref is {
            type: ReferenceType;
            index: number;
            value: ResolvedReference;
          } => ref !== undefined,
        );

      // Sort by the order they were returned from their respective repositories
      const orderedRefs = validRefsWithOrder
        .sort((a, b) => {
          // If they're the same type, sort by index
          if (a.type === b.type) {
            return a.index - b.index;
          }

          // If different types, preserve the original reference order
          return (
            references.findIndex(
              (ref) => ref.type === a.type && ref.id === a.value._id,
            ) -
            references.findIndex(
              (ref) => ref.type === b.type && ref.id === b.value._id,
            )
          );
        })
        .map((ref) => ref.value);

      // Apply field filtering if specified
      const filteredRefs = scope?.fields
        ? orderedRefs.map((ref) => {
            const result = { ...ref } as Record<string, unknown>;
            const fields = scope.fields ?? {};

            const inclusionFields = Object.entries(fields)
              .filter(([_, value]) => value === true)
              .map(([key]) => key);

            if (inclusionFields.length > 0) {
              Object.keys(result).forEach((key) => {
                if (!inclusionFields.includes(key)) {
                  delete result[key];
                }
              });
            } else {
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

  /**
   * Fetch referenced entity reactions from the repository
   */
  private async fetchReferencedEntityReactions(
    reactionIds: string[],
    scope?: any,
  ): Promise<EntityReaction[]> {
    if (reactionIds.length === 0) {
      return [];
    }

    const entityReactionsRepository =
      await this.entityReactionsRepositoryGetter();

    // Handle field selection
    const fields = scope?.fields;
    let adjustedFields = fields;

    if (fields) {
      const hasInclusionFields = Object.values(fields).some(
        (value) => value === true,
      );

      if (hasInclusionFields) {
        adjustedFields = {
          ...fields,
          _id: true,
        };
      } else {
        adjustedFields = Object.fromEntries(
          Object.entries(fields).filter(([key]) => key !== '_id'),
        );
      }
    }

    return entityReactionsRepository.find({
      ...scope,
      fields: adjustedFields,
      where: {
        _id: { inq: reactionIds },
        ...(scope?.where ?? {}),
      },
    });
  }

  /**
   * Fetch referenced list reactions from the repository
   */
  private async fetchReferencedListReactions(
    reactionIds: string[],
    scope?: any,
  ): Promise<ListReaction[]> {
    if (reactionIds.length === 0) {
      return [];
    }

    const listReactionsRepository = await this.listReactionsRepositoryGetter();

    // Handle field selection
    const fields = scope?.fields;
    let adjustedFields = fields;

    if (fields) {
      const hasInclusionFields = Object.values(fields).some(
        (value) => value === true,
      );

      if (hasInclusionFields) {
        adjustedFields = {
          ...fields,
          _id: true,
        };
      } else {
        adjustedFields = Object.fromEntries(
          Object.entries(fields).filter(([key]) => key !== '_id'),
        );
      }
    }

    return listReactionsRepository.find({
      ...scope,
      fields: adjustedFields,
      where: {
        _id: { inq: reactionIds },
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
 * @param entityReactionsRepositoryGetter - Getter function for the EntityReactionsRepository
 * @param listReactionsRepositoryGetter - Getter function for the ListReactionsRepository
 * @returns A new instance of LookupHelper
 */
export function createLookupHelper(
  entityRepositoryGetter: Getter<EntityRepository>,
  listRepositoryGetter: Getter<ListRepository>,
  entityReactionsRepositoryGetter: Getter<EntityReactionsRepository>,
  listReactionsRepositoryGetter: Getter<ListReactionsRepository>,
): LookupHelper {
  return new LookupHelper(
    entityRepositoryGetter,
    listRepositoryGetter,
    entityReactionsRepositoryGetter,
    listReactionsRepositoryGetter,
  );
}
