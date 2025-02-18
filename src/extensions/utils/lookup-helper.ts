import { BindingKey, Getter, injectable } from '@loopback/core';
import { Filter, repository } from '@loopback/repository';
import { GenericEntity, GenericEntityRelations } from '../../models';
import { EntityRepository } from '../../repositories/entity.repository';
import { LookupScope } from '../types/filter-augmentation';

export const LookupBindings = {
  HELPER: BindingKey.create<LookupHelper>('extensions.lookup.helper'),
} as const;

@injectable()
export class LookupHelper {
  constructor(
    @repository.getter('EntityRepository')
    private entityRepositoryGetter: Getter<EntityRepository>,
  ) {}

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

  private async processLookupBatch(
    entities: (GenericEntity & GenericEntityRelations)[],
    lookup: LookupScope<GenericEntity>,
  ): Promise<(GenericEntity & GenericEntityRelations)[]> {
    const { prop, scope } = lookup;

    // Collect all unique entity IDs that need to be looked up
    const entityIdsToLookup = new Set<string>();
    const referenceMap = new Map<
      string,
      { entity: GenericEntity & GenericEntityRelations; isArray: boolean }
    >();

    for (const entity of entities) {
      const references = entity[prop];
      if (!references) {
        continue;
      }

      const refArray = Array.isArray(references) ? references : [references];
      const validRefs = refArray.filter(
        (ref) =>
          typeof ref === 'string' &&
          ref.startsWith('tapp://localhost/entities/'),
      );

      if (validRefs.length > 0) {
        referenceMap.set(entity._id, {
          entity,
          isArray: Array.isArray(references),
        });

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

    const entityRepository = await this.entityRepositoryGetter();
    const entityIds = Array.from(entityIdsToLookup);
    const baseWhere = {
      _id: {
        inq: entityIds,
      },
      ...(scope?.where ?? {}),
    };

    // Handle field selection
    let resolvedEntities;
    let userFields: { [key: string]: boolean } | undefined;
    if (scope?.fields) {
      const fields = scope.fields;
      const hasTrueFields = Object.values(fields).includes(true);

      if (hasTrueFields) {
        // Store the user's field selection
        userFields = { ...fields };

        // Fetch entities with both _id and selected fields
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

    // Create a map for quick lookup
    const resolvedEntitiesMap = new Map(
      resolvedEntities.map((entity) => [entity._id, entity]),
    );

    // Replace references with resolved entities
    return entities.map((entity) => {
      const referenceInfo = referenceMap.get(entity._id);
      if (!referenceInfo) {
        return entity;
      }

      const { isArray } = referenceInfo;
      const references = entity[prop];
      const refArray = Array.isArray(references) ? references : [references];

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

        // If we have user-specified fields, filter the resolved entity to only include those fields
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

      entity[prop] = isArray ? resolvedRefs : resolvedRefs[0];

      return entity;
    });
  }
}

export function createLookupHelper(
  entityRepositoryGetter: Getter<EntityRepository>,
): LookupHelper {
  return new LookupHelper(entityRepositoryGetter);
}
