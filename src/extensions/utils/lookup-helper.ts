import { BindingKey, Getter, injectable } from '@loopback/core';
import { Filter, repository } from '@loopback/repository';
import { get, set } from 'lodash';
import { GenericEntity, GenericEntityRelations } from '../../models';
import { EntityRepository } from '../../repositories/entity.repository';
import { LookupScope } from '../types/filter-augmentation';

/**
 * Binding key for the LookupHelper service.
 * This helper is used to resolve entity references in the system.
 * Supports nested property lookups using dot notation (e.g., 'foo.bar.baz')
 */
export const LookupBindings = {
  HELPER: BindingKey.create<LookupHelper>('extensions.lookup.helper'),
} as const;

/**
 * Helper class that handles the resolution of entity references.
 * It supports both single entity and array of entities processing,
 * with the ability to handle nested lookups and field filtering.
 */
@injectable()
export class LookupHelper {
  constructor(
    @repository.getter('EntityRepository')
    private entityRepositoryGetter: Getter<EntityRepository>,
  ) {}

  /**
   * Process lookups for an array of entities.
   * This method resolves references for each entity in the array based on the lookup filter.
   *
   * @param entities - Array of entities to process
   * @param filter - Filter containing lookup definitions
   * @returns Promise resolving to processed entities with resolved references
   */
  async processLookupForArray(
    entities: (GenericEntity & GenericEntityRelations)[],
    filter?: Filter<GenericEntity>,
  ): Promise<(GenericEntity & GenericEntityRelations)[]> {
    const lookup = filter?.lookup;
    if (!lookup) {
      return entities;
    }

    let processedEntities = entities;
    for (const lookupDef of lookup) {
      processedEntities = await this.processLookupBatch(
        processedEntities,
        lookupDef,
      );
    }

    return processedEntities;
  }

  /**
   * Process lookups for a single entity.
   * This method resolves references for a single entity based on the lookup filter.
   *
   * @param entity - Single entity to process
   * @param filter - Filter containing lookup definitions
   * @returns Promise resolving to processed entity with resolved references
   */
  async processLookupForOne(
    entity: GenericEntity & GenericEntityRelations,
    filter?: Filter<GenericEntity>,
  ): Promise<GenericEntity & GenericEntityRelations> {
    const lookup = filter?.lookup;
    if (!lookup) {
      return entity;
    }

    let processedEntity = entity;
    for (const lookupDef of lookup) {
      processedEntity = (
        await this.processLookupBatch([processedEntity], lookupDef)
      )[0];
    }

    return processedEntity;
  }

  /**
   * Process a batch of entities for a specific lookup definition.
   * This is the core method that handles the actual reference resolution.
   *
   * @param entities - Array of entities to process
   * @param lookup - Lookup configuration defining what and how to resolve
   * @returns Promise resolving to processed entities
   */
  private async processLookupBatch(
    entities: (GenericEntity & GenericEntityRelations)[],
    lookup: LookupScope<GenericEntity>,
  ): Promise<(GenericEntity & GenericEntityRelations)[]> {
    const { prop, scope } = lookup;

    // Collect all unique entity IDs that need to be looked up
    const entityIdsToLookup = new Set<string>();
    const referenceMap = new Map<
      string,
      {
        entity: GenericEntity & GenericEntityRelations;
        isArray: boolean;
        path: string;
      }
    >();

    // First pass: collect all entity IDs that need to be resolved
    for (const entity of entities) {
      const references = get(entity, prop);
      if (!references) {
        continue;
      }

      // Handle both array and single reference cases
      const refArray = Array.isArray(references) ? references : [references];
      const validRefs = refArray.filter(
        (ref) =>
          typeof ref === 'string' &&
          ref.startsWith('tapp://localhost/entities/'),
      );

      if (validRefs.length > 0) {
        // Store the original entity, whether its reference was an array, and the property path
        referenceMap.set(entity._id, {
          entity,
          isArray: Array.isArray(references),
          path: prop,
        });

        // Extract and store unique entity IDs to lookup
        for (const ref of validRefs) {
          const entityId = ref.split('/').pop();
          if (entityId) {
            entityIdsToLookup.add(entityId);
          }
        }
      }
    }

    if (entityIdsToLookup.size === 0) {
      return entities;
    }

    // Fetch all referenced entities in a single query
    const entityRepository = await this.entityRepositoryGetter();
    const entityIds = Array.from(entityIdsToLookup);
    const baseWhere = {
      _id: {
        inq: entityIds,
      },
      ...(scope?.where ?? {}),
    };

    // Handle field selection with special consideration for _id field
    let resolvedEntities;
    let userFields: { [key: string]: boolean } | undefined;
    if (scope?.fields) {
      const fields = scope.fields;
      const hasTrueFields = Object.values(fields).includes(true);

      if (hasTrueFields) {
        // Store the user's field selection for later filtering
        userFields = { ...fields };

        // Always include _id field as it's required for reference resolution
        resolvedEntities = await entityRepository.find({
          ...scope,
          where: baseWhere,
          fields: {
            ...fields,
            _id: true,
          },
        });
      } else {
        resolvedEntities = await entityRepository.find({
          where: baseWhere,
          ...scope,
        });
      }
    } else {
      resolvedEntities = await entityRepository.find({
        where: baseWhere,
        ...scope,
      });
    }

    // Handle nested lookups recursively
    if (scope?.lookup && resolvedEntities.length > 0) {
      for (const nestedLookup of scope.lookup) {
        resolvedEntities = await this.processLookupBatch(
          resolvedEntities,
          nestedLookup,
        );
      }
    }

    // Create an efficient lookup map for resolved entities
    const resolvedEntitiesMap = new Map(
      resolvedEntities.map((entity) => [entity._id, entity]),
    );

    // Replace references with resolved entities
    return entities.map((entity) => {
      const referenceInfo = referenceMap.get(entity._id);
      if (!referenceInfo) {
        return entity;
      }

      const { isArray, path } = referenceInfo;
      const references = get(entity, path);
      const refArray = Array.isArray(references) ? references : [references];

      // Process each reference and resolve it to an entity
      const resolvedRefs = refArray.map((ref) => {
        if (
          typeof ref !== 'string' ||
          !ref.startsWith('tapp://localhost/entities/')
        ) {
          return ref;
        }

        const entityId = ref.split('/').pop();
        if (!entityId) {
          return ref;
        }

        const resolvedEntity = resolvedEntitiesMap.get(entityId);
        if (!resolvedEntity) {
          return ref;
        }

        // Apply field filtering if specified by user
        if (userFields) {
          const filteredEntity: Partial<GenericEntity> = {};
          for (const [key, include] of Object.entries(userFields)) {
            if (include) {
              filteredEntity[key as keyof GenericEntity] =
                resolvedEntity[key as keyof GenericEntity];
            }
          }

          return filteredEntity;
        }

        return resolvedEntity;
      });

      // Restore the original format (array or single value) using lodash set
      set(entity, path, isArray ? resolvedRefs : resolvedRefs[0]);

      return entity;
    });
  }
}

/**
 * Factory function to create a new LookupHelper instance.
 *
 * @param entityRepositoryGetter - Getter function for the EntityRepository
 * @returns A new instance of LookupHelper
 */
export function createLookupHelper(
  entityRepositoryGetter: Getter<EntityRepository>,
): LookupHelper {
  return new LookupHelper(entityRepositoryGetter);
}
