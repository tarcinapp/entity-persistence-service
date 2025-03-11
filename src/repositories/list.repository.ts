import { Getter, inject } from '@loopback/core';
import {
  Count,
  DataObject,
  DefaultCrudRepository,
  Filter,
  FilterBuilder,
  FilterExcludingWhere,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
  InclusionResolver,
  Options,
  Where,
  WhereBuilder,
  repository,
} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import slugify from 'slugify';
import { EntityDbDataSource } from '../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  RecordLimitsConfigurationReader,
  UniquenessConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
} from '../extensions';
import { ResponseLimitConfigurationReader } from '../extensions/config-helpers/response-limit-config-helper';
import { FilterMatcher } from '../extensions/utils/filter-matcher';
import {
  LookupBindings,
  LookupHelper,
} from '../extensions/utils/lookup-helper';
import { SetFilterBuilder } from '../extensions/utils/set-helper';
import {
  GenericEntity,
  List,
  ListToEntityRelation,
  HttpErrorResponse,
  ListReactions,
  ListRelations,
  SingleError,
  Tag,
  TagListRelation,
} from '../models';
import { CustomEntityThroughListRepository } from './custom-entity-through-list.repository';
import { EntityRepository } from './entity.repository';
import { ListEntityRelationRepository } from './list-entity-relation.repository';
import { ListReactionsRepository } from './list-reactions.repository';
import { ListRelationRepository } from './list-relation.repository';
import { TagListRelationRepository } from './tag-list-relation.repository';
import { TagRepository } from './tag.repository';

export class ListRepository extends DefaultCrudRepository<
  List,
  typeof List.prototype._id,
  ListRelations
> {
  public readonly entities: (
    listId: typeof List.prototype._id,
  ) => CustomEntityThroughListRepository;

  public readonly reactions: HasManyRepositoryFactory<
    ListReactions,
    typeof List.prototype._id
  >;

  public readonly tags: HasManyThroughRepositoryFactory<
    Tag,
    typeof Tag.prototype.id,
    TagListRelation,
    typeof List.prototype._id
  >;

  private static responseLimit = _.parseInt(
    process.env.response_limit_list ?? '50',
  );

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('ListEntityRelationRepository')
    protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>,

    @repository.getter('EntityRepository')
    protected entityRepositoryGetter: Getter<EntityRepository>,

    @repository.getter('ListRelationRepository')
    protected listRelationRepositoryGetter: Getter<ListRelationRepository>,

    @repository.getter('ListReactionsRepository')
    protected listReactionsRepositoryGetter: Getter<ListReactionsRepository>,

    @repository.getter('TagListRelationRepository')
    protected tagListRelationRepositoryGetter: Getter<TagListRelationRepository>,

    @repository.getter('TagRepository')
    protected tagRepositoryGetter: Getter<TagRepository>,

    @repository.getter('CustomListEntityRelRepository')
    protected customListEntityRelRepositoryGetter: Getter<CustomEntityThroughListRepository>,

    @inject('extensions.uniqueness.configurationreader')
    private uniquenessConfigReader: UniquenessConfigurationReader,

    @inject('extensions.record-limits.configurationreader')
    private recordLimitConfigReader: RecordLimitsConfigurationReader,

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
  ) {
    super(List, dataSource);

    this.tags = this.createHasManyThroughRepositoryFactoryFor(
      'tags',
      tagRepositoryGetter,
      tagListRelationRepositoryGetter,
    );
    this.reactions = this.createHasManyRepositoryFactoryFor(
      'reactions',
      listReactionsRepositoryGetter,
    );
    this.registerInclusionResolver(
      'reactions',
      this.reactions.inclusionResolver,
    );

    // make genericEntities inclusion available through a custom repository
    this.entities = (listId: typeof List.prototype._id) => {
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

    //const genericEntitiesInclusionResolver = this.createHasManyThroughRepositoryFactoryFor('_genericEntities', entityRepositoryGetter, listEntityRelationRepositoryGetter).inclusionResolver

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

    return super
      .find(filter, options)
      .then((lists) => this.processLookups(lists, filter));
  }

  async findById(id: string, filter?: FilterExcludingWhere<List>) {
    return super
      .findById(id, filter)
      .catch(() => null)
      .then((list) => {
        if (!list) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: "List with id '" + id + "' could not be found.",
            code: 'LIST-NOT-FOUND',
            status: 404,
          });
        }

        return list;
      })
      .then((list) => this.processLookup(list, filter));
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

      const entityIds = listEntityRelations.map((rel) => rel._entityId);

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

      listEntityRelations.forEach((rel) => {
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

    return this.enrichIncomingListForCreation(data)
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
  private async enrichIncomingListForCreation(
    data: DataObject<List>,
  ): Promise<DataObject<List>> {
    data._kind = data._kind ?? this.kindConfigReader.defaultListKind;

    // take the date of now to make sure we have exactly the same date in all date fields
    const now = new Date().toISOString();

    // use incoming creationDateTime and lastUpdateDateTime if given. Override with default if it does not exist.
    data._createdDateTime = data._createdDateTime ? data._createdDateTime : now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime
      ? data._lastUpdatedDateTime
      : now;

    // If validFromDateTime is already set, use that value
    // Otherwise, check if auto-validation is enabled for this kind
    // If enabled, set to current time, if not, leave undefined
    const shouldAutoValidate = this.validfromConfigReader.getValidFromForLists(
      data._kind,
    );
    data._validFromDateTime =
      data._validFromDateTime ?? (shouldAutoValidate ? now : undefined);

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
    if (
      !this.recordLimitConfigReader.isRecordLimitsConfiguredForLists(
        newData._kind,
      )
    ) {
      return;
    }

    const limit = this.recordLimitConfigReader.getRecordLimitsCountForLists(
      newData._kind,
    );
    const set = this.recordLimitConfigReader.getRecordLimitsSetForLists(
      newData._ownerUsers,
      newData._ownerGroups,
      newData._kind,
    );

    let filterBuilder: FilterBuilder<List>;

    if (
      this.recordLimitConfigReader.isLimitConfiguredForKindForLists(
        newData._kind,
      )
    ) {
      filterBuilder = new FilterBuilder<List>({
        where: {
          _kind: newData._kind,
        },
      });
    } else {
      filterBuilder = new FilterBuilder<List>();
    }

    let filter = filterBuilder.build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();

      // Check if the new record would match the set filter
      if (!this.wouldRecordMatchFilter(newData, filter.where)) {
        // Record wouldn't be part of the set, no need to check limits
        return;
      }
    }

    const currentCount = await this.count(filter.where);

    if (currentCount.count >= limit!) {
      throw new HttpErrorResponse({
        statusCode: 429,
        name: 'LimitExceededError',
        message: `List limit is exceeded.`,
        code: 'LIST-LIMIT-EXCEEDED',
        status: 429,
        details: [
          new SingleError({
            code: 'LIST-LIMIT-EXCEEDED',
            info: {
              limit: limit,
            },
          }),
        ],
      });
    }
  }

  /**
   * Evaluates if a record would match a given filter
   * @param record The record to evaluate
   * @param whereClause The filter conditions to check
   * @returns boolean indicating if the record would match the filter
   */
  private wouldRecordMatchFilter(
    record: DataObject<List>,
    whereClause: Where<List> | undefined,
  ): boolean {
    return FilterMatcher.matches(record, whereClause);
  }

  private generateSlug(data: DataObject<List>) {
    if (data._name && !data._slug) {
      data._slug = slugify(data._name ?? '', { lower: true, strict: true });
    }
  }

  private setCountFields(data: DataObject<List>) {
    if (_.isArray(data._ownerUsers)) {
      data._ownerUsersCount = data._ownerUsers?.length;
    }

    if (_.isArray(data._ownerGroups)) {
      data._ownerGroupsCount = data._ownerGroups?.length;
    }

    if (_.isArray(data._viewerUsers)) {
      data._viewerUsersCount = data._viewerUsers?.length;
    }

    if (_.isArray(data._viewerGroups)) {
      data._viewerGroupsCount = data._viewerGroups?.length;
    }
  }

  private checkDataKindFormat(data: DataObject<List>) {
    // make sure data kind is slug format
    if (data._kind) {
      const slugKind: string = slugify(data._kind, { lower: true });

      if (slugKind !== data._kind) {
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
    /**
     * This function checks if the 'kind' field in the 'data' object is valid
     * for the list. Although 'kind' is required, we ensure it has a value by
     * this point. If it's not valid, we raise an error with the allowed valid
     * values for 'kind'.
     */
    const kind = data._kind ?? '';

    if (!this.kindConfigReader.isKindAcceptableForList(kind)) {
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
    // return if no uniqueness is configured
    if (
      !this.uniquenessConfigReader.isUniquenessConfiguredForLists(newData._kind)
    ) {
      return;
    }

    const whereBuilder: WhereBuilder<List> = new WhereBuilder<List>();

    // read the fields (name, slug) array for this kind
    const fields: string[] = this.uniquenessConfigReader.getFieldsForLists(
      newData._kind,
    );
    const set = this.uniquenessConfigReader.getSetForLists(
      newData._ownerUsers,
      newData._ownerGroups,
      newData._kind,
    );

    // add uniqueness fields to where builder
    _.forEach(fields, (field) => {
      whereBuilder.and({
        [field]: _.get(newData, field),
      });
    });

    let filter = new FilterBuilder<List>().where(whereBuilder.build()).build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    const existingList = await super.findOne(filter);

    if (existingList) {
      throw new HttpErrorResponse({
        statusCode: 409,
        name: 'DataUniquenessViolationError',
        message: 'List already exists.',
        code: 'LIST-ALREADY-EXISTS',
        status: 409,
      });
    }
  }

  private async checkUniquenessForUpdate(
    id: string,
    newData: DataObject<List>,
  ) {
    // return if no uniqueness is configured
    if (
      !this.uniquenessConfigReader.isUniquenessConfiguredForLists(newData._kind)
    ) {
      return;
    }

    const whereBuilder: WhereBuilder<List> = new WhereBuilder<List>();

    // read the fields (name, slug) array for this kind
    const fields: string[] = this.uniquenessConfigReader.getFieldsForLists(
      newData._kind,
    );

    const set = this.uniquenessConfigReader.getSetForLists(
      newData._ownerUsers,
      newData._ownerGroups,
      newData._kind,
    );

    _.forEach(fields, (field) => {
      whereBuilder.and({
        [field]: _.get(newData, field),
      });
    });

    // this is for preventing the same data to be returned
    whereBuilder.and({
      _id: {
        neq: id,
      },
    });

    let filter = new FilterBuilder<List>()
      .where(whereBuilder.build())
      .fields('_id')
      .build();

    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    const violatingList = await super.findOne(filter);

    if (violatingList) {
      throw new HttpErrorResponse({
        statusCode: 409,
        name: 'DataUniquenessViolationError',
        message: 'List already exists.',
        code: 'LIST-ALREADY-EXISTS',
        status: 409,
      });
    }
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

    return this.find(childFilter, options);
  }
}
