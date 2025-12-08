import { Getter, inject } from '@loopback/core';
import {
  Count,
  DataObject,
  DefaultCrudRepository,
  Filter,
  FilterExcludingWhere,
  HasManyRepositoryFactory,
  InclusionResolver,
  Options,
  Where,
  repository,
} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import slugify from 'slugify';
import { EntityDbDataSource } from '../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
} from '../extensions';
import {
  GenericEntity,
  List,
  ListToEntityRelation,
  HttpErrorResponse,
  ListReaction,
  ListRelations,
} from '../models';
import { CustomEntityThroughListRepository } from './custom-entity-through-list.repository';
import { EntityRepository } from './entity.repository';
import { ListEntityRelationRepository } from './list-entity-relation.repository';
import { ListReactionsRepository } from './list-reactions.repository';
import { ResponseLimitConfigurationReader } from '../extensions/config-helpers/response-limit-config-helper';
import {
  LookupBindings,
  LookupHelper,
} from '../extensions/utils/lookup-helper';
import { UnmodifiableCommonFields } from '../models/base-types/unmodifiable-common-fields';
import { LoggingService } from '../services/logging.service';
import { RecordLimitCheckerBindings } from '../services/record-limit-checker.bindings';
import { RecordLimitCheckerService } from '../services/record-limit-checker.service';

export class ListRepository extends DefaultCrudRepository<
  List,
  typeof List.prototype._id,
  ListRelations
> {
  public readonly entities: (
    listId: typeof List.prototype._id,
  ) => Promise<CustomEntityThroughListRepository>;

  public readonly reactions: HasManyRepositoryFactory<
    ListReaction,
    typeof List.prototype._id
  >;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('ListEntityRelationRepository')
    protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>,

    @repository.getter('EntityRepository')
    protected entityRepositoryGetter: Getter<EntityRepository>,

    @repository.getter('ListReactionsRepository')
    protected listReactionsRepositoryGetter: Getter<ListReactionsRepository>,

    @repository.getter('CustomListEntityRelRepository')
    protected customListEntityRelRepositoryGetter: Getter<CustomEntityThroughListRepository>,

    @repository.getter('ListRepository')
    protected listRepositoryGetter: Getter<ListRepository>,

    @inject('extensions.kind.configurationreader')
    private kindConfigReader: KindConfigurationReader,

    @inject('extensions.visibility.configurationreader')
    private visibilityConfigReader: VisibilityConfigurationReader,

    @inject('extensions.validfrom.configurationreader')
    private validfromConfigReader: ValidfromConfigurationReader,

    @inject('extensions.idempotency.configurationreader')
    private idempotencyConfigReader: IdempotencyConfigurationReader,

    @inject('extensions.response-limit.configurationreader')
    private responseLimitConfigReader: ResponseLimitConfigurationReader,

    @inject(LookupBindings.HELPER)
    private lookupHelper: LookupHelper,

    @inject('services.LoggingService')
    private loggingService: LoggingService,

    @inject(RecordLimitCheckerBindings.SERVICE)
    private recordLimitChecker: RecordLimitCheckerService,
  ) {
    super(List, dataSource);

    this.reactions = this.createHasManyRepositoryFactoryFor(
      '_reactions',
      listReactionsRepositoryGetter,
    );
    this.registerInclusionResolver(
      '_reactions',
      this.reactions.inclusionResolver,
    );

    // Define the entities method
    this.entities = async (listId: typeof List.prototype._id) => {
      // First verify that the list exists - this will throw 404 if not found
      await this.findById(listId);

      const repo = new CustomEntityThroughListRepository(
        this.dataSource,
        this.entityRepositoryGetter,
        this.listEntityRelationRepositoryGetter,
      );

      // set the sourceListId to the custom repo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (repo as any).sourceListId = listId;

      return repo;
    };

    this.registerInclusionResolver(
      '_entities',
      this.createEntitiesInclusionResolver(
        listEntityRelationRepositoryGetter,
        entityRepositoryGetter,
      ),
    );

    // standard inclusion resolver definition
    //this.registerInclusionResolver('_genericEntities', genericEntitiesInclusionResolver);
  }

  private forceKindInclusion(filter: Filter<List> | undefined): Filter<List> | undefined {
    if (!filter) {
      return filter;
    }

    if (!filter.fields) {
      return filter;
    }

    // If fields is an array, ensure _kind is included
    if (Array.isArray(filter.fields)) {
      if (!filter.fields.includes('_kind' as any)) {
        return {
          ...filter,
          fields: [...filter.fields, '_kind' as any],
        };
      }
      return filter;
    }

    // If fields is an object (inclusion/exclusion mode)
    const fieldEntries = Object.entries(filter.fields);
    const hasInclusionMode = fieldEntries.some(([_, value]) => value === true);

    if (hasInclusionMode) {
      // Inclusion mode: ensure _kind: true
      return {
        ...filter,
        fields: {
          ...filter.fields,
          _kind: true,
        } as any,
      };
    }

    // Exclusion mode: remove _kind if it's set to false
    const updatedFields = { ...filter.fields };
    if ((updatedFields as any)._kind === false) {
      delete (updatedFields as any)._kind;
    }

    return {
      ...filter,
      fields: updatedFields,
    };
  }

  private async processLookups(
    lists: (List & ListRelations)[],
    filter?: Filter<List>,
  ): Promise<(List & ListRelations)[]> {
    if (!filter?.lookup) {
      return lists;
    }

    return this.lookupHelper.processLookupForArray(lists, filter);
  }

  private async processLookup(
    list: List & ListRelations,
    filter?: Filter<List>,
  ): Promise<List & ListRelations> {
    if (!filter?.lookup) {
      return list;
    }

    return this.lookupHelper.processLookupForOne(list, filter);
  }

  async find(filter?: Filter<List>, options?: Options) {
    const limit =
      filter?.limit ?? this.responseLimitConfigReader.getListResponseLimit();

    filter = {
      ...filter,
      limit: Math.min(
        limit,
        this.responseLimitConfigReader.getListResponseLimit(),
      ),
    };

    // Ensure _kind is always included
    filter = this.forceKindInclusion(filter);

    this.loggingService.info('ListRepository.find - Modified filter:', {
      filter,
    });

    const lists = await super.find(filter, options);

    return this.processLookups(lists, filter);
  }

  async findById(
    id: string,
    filter?: FilterExcludingWhere<List>,
  ): Promise<List> {
    try {
      // Ensure _kind is always included (cast to Filter for the helper)
      const forcedFilter = this.forceKindInclusion(filter as Filter<List>);
      const typedFilter = forcedFilter as FilterExcludingWhere<List>;

      // Call the LoopBack super method, which already throws an error if not found
      const list = await super.findById(id, typedFilter);

      // Return the successfully found entity
      return await this.processLookup(list, filter);
    } catch (error) {
      // Handle specific known errors, such as "Entity not found"
      if (error.code === 'ENTITY_NOT_FOUND') {
        this.loggingService.warn(`List with id '${id}' not found.`);
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message: `List with id '${id}' could not be found.`,
          code: 'LIST-NOT-FOUND',
          status: 404,
        });
      }

      // Log and rethrow unexpected errors for better debugging
      this.loggingService.error('Unexpected Error in findById:', {
        error,
        id,
      });

      // Re-throw the error to allow global error handlers to process it
      throw error;
    }
  }

  async create(data: DataObject<List>) {
    const idempotencyKey = this.calculateIdempotencyKey(data);

    return this.findIdempotentList(idempotencyKey).then((foundIdempotent) => {
      if (foundIdempotent) {
        return foundIdempotent;
      }

      if (idempotencyKey) {
        data._idempotencyKey = idempotencyKey;
      }

      // we do not have identical data in the db
      // go ahead, validate, enrich and create the data
      return this.createNewListFacade(data);
    });
  }

  async replaceById(
    id: string,
    data: DataObject<List>,
    options?: Options,
  ): Promise<void> {
    return this.modifyIncomingListForUpdates(id, data)
      .then((collection) => {
        // calculate idempotency key
        const idempotencyKey = this.calculateIdempotencyKey(collection.data);

        // set idempotency key to the data
        if (idempotencyKey) {
          collection.data._idempotencyKey = idempotencyKey;
        }

        return collection;
      })
      .then((collection) =>
        this.validateIncomingListForReplace(id, collection.data),
      )
      .then((validEnrichedData) =>
        super.replaceById(id, validEnrichedData, options),
      );
  }

  async updateById(
    id: string,
    data: DataObject<List>,
    options?: Options,
  ): Promise<void> {
    return this.modifyIncomingListForUpdates(id, data)
      .then((collection) => {
        const mergedData = _.defaults(
          {},
          collection.data,
          collection.existingData,
        );

        // calculate idempotency key
        const idempotencyKey = this.calculateIdempotencyKey(mergedData);

        if (idempotencyKey) {
          collection.data._idempotencyKey = idempotencyKey;
        }

        return collection;
      })
      .then((collection) =>
        this.validateIncomingDataForUpdate(
          id,
          collection.existingData,
          collection.data,
        ),
      )
      .then((validEnrichedData) =>
        super.updateById(id, validEnrichedData, options),
      );
  }

  async updateAll(
    data: DataObject<List>,
    where?: Where<List>,
    options?: Options,
  ) {
    const now = new Date().toISOString();
    data._lastUpdatedDateTime = now;

    // Check if trying to change the kind field
    if (data._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'List kind cannot be changed after creation.',
        code: 'IMMUTABLE-LIST-KIND',
        status: 422,
      });
    }

    this.generateSlug(data);
    this.setCountFields(data);

    this.loggingService.info('ListRepository.updateAll - Modified data:', {
      data,
      where,
    });

    return super.updateAll(data, where, options);
  }

  async deleteById(id: string, options?: Options): Promise<void> {
    const listEntityRelationRepo =
      await this.listEntityRelationRepositoryGetter();

    // delete all relations
    await listEntityRelationRepo.deleteAll({
      _listId: id,
    });

    return super.deleteById(id, options);
  }

  async deleteAll(
    where?: Where<List> | undefined,
    options?: Options,
  ): Promise<Count> {
    const listEntityRelationRepo =
      await this.listEntityRelationRepositoryGetter();

    this.loggingService.info('ListRepository.deleteAll - Where condition:', {
      where,
    });

    // delete all relations
    await listEntityRelationRepo.deleteAll({
      _listId: {
        inq: (
          await this.find({
            where: where,
            fields: ['_id'],
          })
        ).map((list) => list._id),
      },
    });

    return super.deleteAll(where, options);
  }

  /**
   * Custom inclusion resolver for the _genericEntities relation aware of whereThrough and setThrough
   * @param listEntityRelationRepositoryGetter
   * @param entityRepositoryGetter
   * @returns
   */
  createEntitiesInclusionResolver(
    listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>,
    entityRepositoryGetter: Getter<EntityRepository>,
  ): InclusionResolver<List, GenericEntity> {
    return async (lists, inclusion) => {
      const listEntityRelationRepo = await listEntityRelationRepositoryGetter();
      const entityRepo = await entityRepositoryGetter();

      // Extract filters from the inclusion object
      const relationFilter: Where<ListToEntityRelation> =
        typeof inclusion === 'object' ? (inclusion.whereThrough ?? {}) : {};
      const entityFilter = typeof inclusion === 'object' ? inclusion.scope : {};

      // Find relationships that match the provided filters
      const listEntityRelations = await listEntityRelationRepo.find({
        where: {
          _listId: { inq: lists.map((l) => l._id) },
          ...relationFilter, // Apply dynamic filters to the through model
        },
      });

      const entityIds = listEntityRelations.map(
        (rel: ListToEntityRelation) => rel._entityId,
      );

      // Find entities matching the related IDs and any additional filters
      const entities = await entityRepo.find({
        where: {
          _id: { inq: entityIds },
          ...entityFilter?.where, // Apply additional filters for the entity
        },
        ...entityFilter, // Apply entity-level filters like limit, order, etc.
      });

      // Map entities back to their respective lists
      const entitiesByListId = new Map<string | undefined, GenericEntity[]>();

      listEntityRelations.forEach((rel: ListToEntityRelation) => {
        if (!entitiesByListId.has(rel._listId)) {
          entitiesByListId.set(rel._listId, []);
        }

        const entity = entities.find((e) => e._id === rel._entityId);
        if (entity) {
          entitiesByListId.get(rel._listId)?.push(entity);
        }
      });

      // Return entities grouped by list, preserving the order of the lists
      return lists.map((list) => entitiesByListId.get(list._id) ?? []);
    };
  }

  private async findIdempotentList(
    idempotencyKey: string | undefined,
  ): Promise<List | null> {
    // check if same record already exists
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      // try to find if a record with this idempotency key is already created
      const sameRecord = this.findOne({
        where: {
          and: [
            {
              _idempotencyKey: idempotencyKey,
            },
          ],
        },
      });

      // if record already created return the existing record as if it newly created
      return sameRecord;
    }

    return Promise.resolve(null);
  }

  calculateIdempotencyKey(data: DataObject<List>) {
    const idempotencyFields =
      this.idempotencyConfigReader.getIdempotencyForLists(data._kind);

    // idempotency is not configured
    if (idempotencyFields.length === 0) {
      return;
    }

    const fieldValues = idempotencyFields.map((idempotencyField) => {
      const value = _.get(data, idempotencyField);

      // If value is an array, sort it before stringifying
      if (Array.isArray(value)) {
        return JSON.stringify([...value].sort());
      }

      return typeof value === 'object' ? JSON.stringify(value) : value;
    });

    const keyString = fieldValues.join(',');
    const hash = crypto.createHash('sha256').update(keyString);

    return hash.digest('hex');
  }

  /**
   * Validates the incoming data, enriches with managed fields then calls super.create
   *
   * @param data Input object to create list from.
   * @returns Newly created list.
   */
  private async createNewListFacade(data: DataObject<List>): Promise<List> {
    /**
     * TODO: MongoDB connector still does not support transactions.
     * Comment out here when we receive transaction support.
     * Then we need to pass the trx to the methods down here.
     */
    /*
    const trxRepo = new DefaultTransactionalRepository(List, this.dataSource);
    const trx = await trxRepo.beginTransaction(IsolationLevel.READ_COMMITTED);
    */

    return this.modifyIncomingListForCreation(data)
      .then((enrichedData) =>
        this.validateIncomingListForCreation(enrichedData),
      )
      .then((validEnrichedData) => super.create(validEnrichedData));
  }

  private async validateIncomingListForCreation(
    data: DataObject<List>,
  ): Promise<DataObject<List>> {
    this.checkDataKindFormat(data);
    this.checkDataKindValues(data);

    return Promise.all([
      this.checkUniquenessForCreate(data),
      this.checkRecordLimits(data),
    ]).then(() => {
      return data;
    });
  }

  private async validateIncomingListForReplace(
    id: string,
    data: DataObject<List>,
  ) {
    const uniquenessCheck = this.checkUniquenessForUpdate(id, data);

    // Check if trying to change the kind field
    const existingList = await this.findById(id);
    if (data._kind && data._kind !== existingList._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'List kind cannot be changed after creation.',
        code: 'IMMUTABLE-LIST-KIND',
        status: 422,
      });
    }

    await uniquenessCheck;

    return data;
  }

  private async validateIncomingDataForUpdate(
    id: string,
    existingData: DataObject<List>,
    data: DataObject<List>,
  ) {
    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value !== null),
      data,
    );
    const uniquenessCheck = this.checkUniquenessForUpdate(id, mergedData);

    // Check if trying to change the kind field
    if (data._kind && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'List kind cannot be changed after creation.',
        code: 'IMMUTABLE-LIST-KIND',
        status: 422,
      });
    }

    this.generateSlug(data);
    this.setCountFields(data);

    await uniquenessCheck;

    return data;
  }

  /**
   * Adds managed fields to the list.
   * @param data Data that is intended to be created
   * @returns New version of the data which have managed fields are added
   */
  private async modifyIncomingListForCreation(
    data: DataObject<List>,
  ): Promise<DataObject<List>> {
    data._kind =
      data._kind ??
      this.kindConfigReader.defaultListKind;

    // take the date of now to make sure we have exactly the same date in all date fields
    const now = new Date().toISOString();

    // use incoming createdDateTime and lastUpdatedDateTime if given. Override with default if it does not exist.
    data._createdDateTime = data._createdDateTime ? data._createdDateTime : now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime
      ? data._lastUpdatedDateTime
      : now;

    // If validFromDateTime is already set, use that value
    // Otherwise, check if auto-validation is enabled for this kind
    // If enabled, set to current time, if not, leave undefined
    const shouldAutoApprove = this.validfromConfigReader.getValidFromForLists(
      data._kind,
    );
    data._validFromDateTime =
      data._validFromDateTime ?? (shouldAutoApprove ? now : undefined);

    // we need to explicitly set validUntilDateTime to null if it is not provided
    // to make filter matcher work correctly while checking record limits
    data._validUntilDateTime = data._validUntilDateTime ?? null;

    // new data is starting from version 1
    data._version = 1;

    // set visibility
    data._visibility = data._visibility
      ? data._visibility
      : this.visibilityConfigReader.getVisibilityForLists(data._kind);

    // prepare slug from the name and set to the record
    this.generateSlug(data);

    // set owners count to make searching easier
    this.setCountFields(data);

    return data;
  }

  /**
   * Enrich the original record with managed fields where applicable.
   * This method can be used by replace and update operations as their requirements are same.
   * @param id Id of the targeted record
   * @param data Payload of the list
   * @returns Enriched list
   */
  private async modifyIncomingListForUpdates(
    id: string,
    data: DataObject<List>,
  ) {
    return this.findById(id)
      .then((existingData) => {
        // check if we have this record in db
        if (!existingData) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: "List with id '" + id + "' could not be found.",
            code: 'LIST-NOT-FOUND',
            status: 404,
          });
        }

        return existingData;
      })
      .then((existingData) => {
        const now = new Date().toISOString();

        // set new version
        data._version = (existingData._version ?? 1) + 1;

        // we may use current date, if it does not exist in the given data
        data._lastUpdatedDateTime = data._lastUpdatedDateTime
          ? data._lastUpdatedDateTime
          : now;

        this.generateSlug(data);

        this.setCountFields(data);

        return {
          data: data,
          existingData: existingData,
        };
      });
  }

  private async checkRecordLimits(newData: DataObject<List>) {
    await this.recordLimitChecker.checkLimits(List, newData, this);
  }

  private generateSlug(data: DataObject<List>) {
    if (data._name && !data._slug) {
      data._slug = slugify(data._name ?? '', { lower: true, strict: true });
    }
  }

  private setCountFields(data: DataObject<List>) {
    // Only update count fields if the related array is present in the data object
    if (_.isArray(data._ownerUsers)) {
      data._ownerUsersCount = data._ownerUsers.length;
    }

    if (_.isArray(data._ownerGroups)) {
      data._ownerGroupsCount = data._ownerGroups.length;
    }

    if (_.isArray(data._viewerUsers)) {
      data._viewerUsersCount = data._viewerUsers.length;
    }

    if (_.isArray(data._viewerGroups)) {
      data._viewerGroupsCount = data._viewerGroups.length;
    }

    if (_.isArray(data._parents)) {
      data._parentsCount = data._parents.length;
    }
  }

  private checkDataKindFormat(data: DataObject<List>) {
    if (data._kind) {
      const slugKind = this.kindConfigReader.validateKindFormat(data._kind);
      if (slugKind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidKindError',
          message: `List kind cannot contain special or uppercase characters. Use '${slugKind}' instead.`,
          code: 'INVALID-LIST-KIND',
          status: 422,
        });
      }
    }
  }

  private checkDataKindValues(data: DataObject<List>) {
    if (
      data._kind &&
      !this.kindConfigReader.isKindAcceptableForList(data._kind)
    ) {
      const validValues = this.kindConfigReader.allowedKindsForLists;
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'InvalidKindError',
        message: `List kind '${data._kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: 'INVALID-LIST-KIND',
        status: 422,
      });
    }
  }

  private async checkUniquenessForCreate(newData: DataObject<List>) {
    await this.recordLimitChecker.checkUniqueness(List, newData, this);
  }

  private async checkUniquenessForUpdate(
    id: string,
    newData: DataObject<List>,
  ) {
    // we need to merge existing data with incoming data in order to check uniqueness
    const existingData = await this.findById(id);
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value !== null),
      newData,
    );
    await this.recordLimitChecker.checkUniqueness(List, mergedData, this);
  }

  async findParents(
    listId: string,
    filter?: Filter<List>,
    options?: Options,
  ): Promise<(List & ListRelations)[]> {
    // First, get the list's parent references
    const list = await this.findById(listId, {
      fields: { _parents: true },
    });

    if (!list) {
      throw new HttpErrorResponse({
        statusCode: 404,
        name: 'NotFoundError',
        message: "List with id '" + listId + "' could not be found.",
        code: 'LIST-NOT-FOUND',
        status: 404,
      });
    }

    if (!list._parents || list._parents.length === 0) {
      return [];
    }

    // Extract parent IDs from the URIs
    const parentIds = list._parents.map((uri: string) => uri.split('/').pop());

    // Create a new filter that includes the parent IDs
    const parentFilter: Filter<List> = {
      ...filter,
      where: {
        and: [
          { _id: { inq: parentIds } },
          ...(filter?.where ? [filter.where] : []),
        ],
      },
    };

    this.loggingService.info('ListRepository.findParents - Parent filter:', {
      parentFilter,
    });

    return this.find(parentFilter, options);
  }

  async findChildren(
    listId: string,
    filter?: Filter<List>,
    options?: Options,
  ): Promise<(List & ListRelations)[]> {
    // First verify that the list exists
    const list = await this.findById(listId, {
      fields: { _id: true },
    });

    if (!list) {
      throw new HttpErrorResponse({
        statusCode: 404,
        name: 'NotFoundError',
        message: "List with id '" + listId + "' could not be found.",
        code: 'LIST-NOT-FOUND',
        status: 404,
      });
    }

    const uri = `tapp://localhost/lists/${listId}`;

    // Create a filter to find lists where _parents contains the given listId
    const childFilter: Filter<List> = {
      ...filter,
      where: {
        and: [{ _parents: uri }, ...(filter?.where ? [filter.where] : [])],
      },
    };

    this.loggingService.info('ListRepository.findChildren - Child filter:', {
      childFilter,
    });

    return this.find(childFilter, options);
  }

  async createChild(
    parentId: string,
    list: Omit<List, UnmodifiableCommonFields | '_parents'>,
  ): Promise<List> {
    // First verify that the parent exists
    await this.findById(parentId);

    // Add the parent reference to the list
    const childList = {
      ...list,
      _parents: [`tapp://localhost/lists/${parentId}`],
    };

    // Create the child list
    return this.create(childList);
  }
}
