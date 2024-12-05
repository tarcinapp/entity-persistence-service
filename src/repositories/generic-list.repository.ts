import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, Filter, FilterBuilder, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, Options, Where, WhereBuilder, repository} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from "lodash";
import qs from 'qs';
import slugify from "slugify";
import {EntityDbDataSource} from '../datasources';
import {IdempotencyConfigurationReader, KindLimitsConfigurationReader, RecordLimitsConfigurationReader, UniquenessConfigurationReader, VisibilityConfigurationReader} from '../extensions';
import {Set, SetFilterBuilder} from '../extensions/set';
import {ValidfromConfigurationReader} from '../extensions/validfrom-config-reader';
import {GenericEntity, GenericList, GenericListEntityRelation, HttpErrorResponse, ListReactions, ListRelation, ListRelations, SingleError, Tag, TagListRelation} from '../models';
import {GenericEntityRepository} from './generic-entity.repository';
import {ListEntityRelationRepository} from './list-entity-relation.repository';
import {ListReactionsRepository} from './list-reactions.repository';
import {ListRelationRepository} from './list-relation.repository';
import {TagListRelationRepository} from './tag-list-relation.repository';
import {TagRepository} from './tag.repository';

export class GenericListRepository extends DefaultCrudRepository<
  GenericList,
  typeof GenericList.prototype.id,
  ListRelations
> {

  public readonly genericEntities: HasManyThroughRepositoryFactory<GenericEntity, typeof GenericEntity.prototype.id,
    GenericListEntityRelation,
    typeof GenericList.prototype.id
  >;

  public readonly relations: HasManyRepositoryFactory<ListRelation, typeof GenericList.prototype.id>;

  public readonly reactions: HasManyRepositoryFactory<ListReactions, typeof GenericList.prototype.id>;

  public readonly tags: HasManyThroughRepositoryFactory<Tag, typeof Tag.prototype.id,
    TagListRelation,
    typeof GenericList.prototype.id
  >;

  private static responseLimit = _.parseInt(process.env.response_limit_list ?? "50");

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('ListEntityRelationRepository') protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>,
    @repository.getter('GenericEntityRepository') protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>,
    @repository.getter('ListRelationRepository') protected listRelationRepositoryGetter: Getter<ListRelationRepository>,
    @repository.getter('ListReactionsRepository') protected listReactionsRepositoryGetter: Getter<ListReactionsRepository>,
    @repository.getter('TagListRelationRepository') protected tagListRelationRepositoryGetter: Getter<TagListRelationRepository>,
    @repository.getter('TagRepository') protected tagRepositoryGetter: Getter<TagRepository>,
    @inject('extensions.uniqueness.configurationreader') private uniquenessConfigReader: UniquenessConfigurationReader,
    @inject('extensions.record-limits.configurationreader') private recordLimitConfigReader: RecordLimitsConfigurationReader,
    @inject('extensions.kind-limits.configurationreader') private kindLimitConfigReader: KindLimitsConfigurationReader,
    @inject('extensions.visibility.configurationreader') private visibilityConfigReader: VisibilityConfigurationReader,
    @inject('extensions.validfrom.configurationreader') private validfromConfigReader: ValidfromConfigurationReader,
    @inject('extensions.idempotency.configurationreader') private idempotencyConfigReader: IdempotencyConfigurationReader
  ) {
    super(GenericList, dataSource);
    this.tags = this.createHasManyThroughRepositoryFactoryFor('tags', tagRepositoryGetter, tagListRelationRepositoryGetter,);
    this.reactions = this.createHasManyRepositoryFactoryFor('reactions', listReactionsRepositoryGetter,);
    this.registerInclusionResolver('reactions', this.reactions.inclusionResolver);
    this.relations = this.createHasManyRepositoryFactoryFor('relations', listRelationRepositoryGetter,);
    this.registerInclusionResolver('relations', this.relations.inclusionResolver);
    this.genericEntities = this.createHasManyThroughRepositoryFactoryFor('genericEntities', genericEntityRepositoryGetter, listEntityRelationRepositoryGetter,);
    this.registerInclusionResolver('genericEntities', this.genericEntities.inclusionResolver);
  }

  async find(filter?: Filter<GenericList>, options?: Options) {

    // Calculate the limit value using optional chaining and nullish coalescing
    // If filter.limit is defined, use its value; otherwise, use ListRepository.response_limit
    const limit = filter?.limit ?? GenericListRepository.responseLimit;

    // Update the filter object by spreading the existing filter and overwriting the limit property
    // Ensure that the new limit value does not exceed ListRepository.response_limit
    filter = {...filter, limit: Math.min(limit, GenericListRepository.responseLimit)};

    return super.find(filter, options);
  }

  async create(data: DataObject<GenericList>) {

    const idempotencyKey = this.calculateIdempotencyKey(data);

    return this.findIdempotentList(idempotencyKey)
      .then(foundIdempotent => {

        if (foundIdempotent) {
          return foundIdempotent;
        }

        data.idempotencyKey = idempotencyKey;

        // we do not have identical data in the db
        // go ahead, validate, enrich and create the data
        return this.createNewListFacade(data);
      });
  }

  async replaceById(id: string, data: DataObject<GenericList>, options?: Options) {

    return this.enrichIncomingListForUpdates(id, data)
      .then(collection => {

        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(collection.data);

        // set idempotencyKey
        collection.data.idempotencyKey = idempotencyKey;

        return collection;
      })
      .then(collection => this.validateIncomingListForReplace(id, collection.data, options))
      .then(validEnrichedData => super.replaceById(id, validEnrichedData, options));
  }

  async updateById(id: string, data: DataObject<GenericList>, options?: Options) {

    return this.enrichIncomingListForUpdates(id, data)
      .then(collection => {
        const mergedData = _.defaults({}, collection.data, collection.existingData);

        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(mergedData);

        // set idempotencyKey
        collection.data.idempotencyKey = idempotencyKey;

        return collection;
      })
      .then(collection => this.validateIncomingDataForUpdate(id, collection.existingData, collection.data, options))
      .then(validEnrichedData => super.updateById(id, validEnrichedData, options));
  }

  async updateAll(data: DataObject<GenericList>, where?: Where<GenericList>, options?: Options) {

    const now = new Date().toISOString();
    data.lastUpdatedDateTime = now;

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    return super.updateAll(data, where, options);
  }

  private async findIdempotentList(idempotencyKey: string | undefined): Promise<GenericList | null> {

    // check if same record already exists
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {

      // try to find if a record with this idempotency key is already created
      const sameRecord = this.findOne({
        where: {
          and: [
            {
              idempotencyKey: idempotencyKey
            }
          ]
        }
      });

      // if record already created return the existing record as if it newly created
      return sameRecord;
    }

    return Promise.resolve(null);
  }

  calculateIdempotencyKey(data: DataObject<GenericList>) {
    const idempotencyFields = this.idempotencyConfigReader.getIdempotencyForLists(data.kind);

    // idempotency is not configured
    if (idempotencyFields.length === 0) return;

    const fieldValues = idempotencyFields.map((idempotencyField) => {
      const value = _.get(data, idempotencyField);
      return typeof value === 'object' ? JSON.stringify(value) : value;
    });

    const keyString = fieldValues.join(',');
    const hash = crypto
      .createHash('sha256')
      .update(keyString);

    return hash.digest('hex');
  }

  /**
   * Validates the incoming data, enriches with managed fields then calls super.create
   * 
   * @param data Input object to create list from.
   * @returns Newly created list.
   */
  private async createNewListFacade(data: DataObject<GenericList>): Promise<GenericList> {

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
      .then(enrichedData => this.validateIncomingListForCreation(enrichedData))
      .then(validEnrichedData => super.create(validEnrichedData));
  }

  private async validateIncomingListForCreation(data: DataObject<GenericList>): Promise<DataObject<GenericList>> {

    this.checkDataKindFormat(data);
    this.checkDataKindValues(data);

    return Promise.all([
      this.checkUniquenessForCreate(data),
      this.checkRecordLimits(data)
    ]).then(() => {
      return data;
    });
  }

  private async validateIncomingListForReplace(id: string, data: DataObject<GenericList>, options?: Options) {
    const uniquenessCheck = this.checkUniquenessForUpdate(id, data);

    this.checkDataKindValues(data);
    this.checkDataKindFormat(data);

    await uniquenessCheck;

    return data;
  }

  private async validateIncomingDataForUpdate(id: string, existingData: DataObject<GenericList>, data: DataObject<GenericList>, options?: Options) {

    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    const mergedData = _.defaults({}, data, existingData);
    const uniquenessCheck = this.checkUniquenessForUpdate(id, mergedData);

    if (data.kind) {
      this.checkDataKindFormat(data);
      this.checkDataKindValues(data);
    }

    this.generateSlug(data);
    this.setOwnersCount(data);

    await uniquenessCheck;

    return data;
  }

  /**
  * Adds managed fields to the list.
  * @param data Data that is intended to be created
  * @returns New version of the data which have managed fields are added
  */
  private async enrichIncomingListForCreation(data: DataObject<GenericList>): Promise<DataObject<GenericList>> {

    // take the date of now to make sure we have exactly the same date in all date fields
    const now = new Date().toISOString();

    // use incoming creationDateTime and lastUpdateDateTime if given. Override with default if it does not exist.
    data.creationDateTime = data.creationDateTime ? data.creationDateTime : now;
    data.lastUpdatedDateTime = data.lastUpdatedDateTime ? data.lastUpdatedDateTime : now;

    // autoapprove the record if it is configured

    data.validFromDateTime = this.validfromConfigReader.getValidFromForLists(data.kind) ? now : undefined;

    // new data is starting from version 1
    data.version = 1;

    // set visibility
    data.visibility = this.visibilityConfigReader.getVisibilityForLists(data.kind);

    // prepare slug from the name and set to the record 
    this.generateSlug(data);

    // set owners count to make searching easier
    this.setOwnersCount(data);

    return data;
  }

  /**
   * Enrich the original record with managed fields where applicable.
   * This method can be used by replace and update operations as their requirements are same.
   * @param id Id of the targeted record
   * @param data Payload of the list
   * @returns Enriched list
   */
  private async enrichIncomingListForUpdates(id: string, data: DataObject<GenericList>) {

    return this.findById(id)
      .then(existingData => {

        // check if we have this record in db
        if (!existingData) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: "NotFoundError",
            message: "List with id '" + id + "' could not be found.",
            code: "LIST-NOT-FOUND",
            status: 404
          });
        }

        return existingData;
      })
      .then(existingData => {
        const now = new Date().toISOString();

        // set new version
        data.version = (existingData.version ?? 1) + 1;

        // we may use current date, if it does not exist in the given data
        data.lastUpdatedDateTime = data.lastUpdatedDateTime ? data.lastUpdatedDateTime : now;

        this.generateSlug(data);

        this.setOwnersCount(data);

        return {
          data: data,
          existingData: existingData
        };
      });
  }

  private async checkRecordLimits(newData: DataObject<GenericList>) {

    if (!this.recordLimitConfigReader.isRecordLimitsConfiguredForLists(newData.kind))
      return;

    const limit = this.recordLimitConfigReader.getRecordLimitsCountForLists(newData.kind)
    const set = this.recordLimitConfigReader.getRecordLimitsSetForLists(newData.ownerUsers, newData.ownerGroups, newData.kind);
    let filterBuilder: FilterBuilder<GenericList>;

    if (this.recordLimitConfigReader.isLimitConfiguredForKindForLists(newData.kind))
      filterBuilder = new FilterBuilder<GenericList>({
        where: {
          kind: newData.kind
        }
      })
    else {
      filterBuilder = new FilterBuilder<GenericList>()
    }

    let filter = filterBuilder.build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericList>(set, {
        filter: filter
      })
        .build();
    }

    const currentCount = await this.count(filter.where);

    if (currentCount.count >= limit!) {
      throw new HttpErrorResponse({
        statusCode: 429,
        name: "LimitExceededError",
        message: `List limit is exceeded.`,
        code: "LIST-LIMIT-EXCEEDED",
        status: 429,
        details: [new SingleError({
          code: "LIST-LIMIT-EXCEEDED",
          info: {
            limit: limit
          }
        })]
      });
    }

  }

  private generateSlug(data: DataObject<GenericList>) {

    if (data.name && !data.slug)
      data.slug = slugify(data.name ?? '', {lower: true, strict: true});
  }

  private setOwnersCount(data: DataObject<GenericList>) {

    if (_.isArray(data.ownerUsers))
      data.ownerUsersCount = data.ownerUsers?.length;

    if (_.isArray(data.ownerGroups))
      data.ownerGroupsCount = data.ownerGroups?.length;

    if (_.isArray(data.viewerUsers))
      data.viewerUsersCount = data.viewerUsers?.length;

    if (_.isArray(data.viewerGroups))
      data.viewerGroupsCount = data.viewerGroups?.length;
  }

  private checkDataKindFormat(data: DataObject<GenericList>) {

    // make sure data kind is slug format
    if (data.kind) {
      const slugKind: string = slugify(data.kind, {lower: true});

      if (slugKind !== data.kind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: "InvalidKindError",
          message: `List kind cannot contain special or uppercase characters. Use '${slugKind}' instead.`,
          code: "INVALID-LIST-KIND",
          status: 422,
        });
      }
    }
  }

  private checkDataKindValues(data: DataObject<GenericList>) {

    /**
     * This function checks if the 'kind' field in the 'data' object is valid
     * for the list. Although 'kind' is required, we ensure it has a value by
     * this point. If it's not valid, we raise an error with the allowed valid
     * values for 'kind'.
     */
    const kind = data.kind ?? '';

    if (!this.kindLimitConfigReader.isKindAcceptableForList(kind)) {
      const validValues = this.kindLimitConfigReader.allowedKindsForLists;

      throw new HttpErrorResponse({
        statusCode: 422,
        name: "InvalidKindError",
        message: `List kind '${data.kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: "INVALID-LIST-KIND",
        status: 422,
      });
    }
  }

  private async checkUniquenessForCreate(newData: DataObject<GenericList>) {

    // return if no uniqueness is configured
    if (!this.uniquenessConfigReader.isUniquenessConfiguredForLists(newData.kind))
      return;

    const whereBuilder: WhereBuilder<GenericList> = new WhereBuilder<GenericList>();

    // read the fields (name, slug) array for this kind
    const fields: string[] = this.uniquenessConfigReader.getFieldsForLists(newData.kind);
    const set = this.uniquenessConfigReader.getSetForLists(newData.ownerUsers, newData.ownerGroups, newData.kind);

    // add uniqueness fields to where builder
    _.forEach(fields, (field) => {

      whereBuilder.and({
        [field]: _.get(newData, field)
      });
    });

    let filter = new FilterBuilder<GenericList>()
      .where(whereBuilder.build())
      .build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericList>(set, {
        filter: filter
      })
        .build();
    }

    const existingList = await super.findOne(filter);

    if (existingList) {

      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "List already exists.",
        code: "LIST-ALREADY-EXISTS",
        status: 409,
      });
    }
  }

  private async checkUniquenessForUpdate(id: string, newData: DataObject<GenericList>) {

    // return if no uniqueness is configured
    if (!process.env.uniqueness_list_fields && !process.env.uniqueness_list_set) return;

    const whereBuilder: WhereBuilder<GenericList> = new WhereBuilder<GenericList>();

    // add uniqueness fields if configured
    if (process.env.uniqueness_list_fields) {
      const fields: string[] = process.env.uniqueness_list_fields
        .replace(/\s/g, '')
        .split(',');

      // if there is at least single field in the fields array that does not present on new data, then we should find it from the db.
      if (_.some(fields, _.negate(_.partial(_.has, newData)))) {
        const existingList = await super.findById(id);

        _.forEach(fields, (field) => {

          whereBuilder.and({
            [field]: _.has(newData, field) ? _.get(newData, field) : _.get(existingList, field)
          });
        });

      } else {
        _.forEach(fields, (field) => {

          whereBuilder.and({
            [field]: _.get(newData, field)
          });
        });
      }
    }

    //
    whereBuilder.and({
      id: {
        neq: id
      }
    });

    let filter = new FilterBuilder<GenericList>()
      .where(whereBuilder.build())
      .fields('id')
      .build();

    // add set filter if configured
    if (process.env.uniqueness_list_set) {

      let uniquenessStr = process.env.uniqueness_list_set;
      uniquenessStr = uniquenessStr.replace(/(set\[.*owners\])/g, '$1='
        + (newData.ownerUsers ? newData.ownerUsers?.join(',') : '')
        + ';'
        + (newData.ownerGroups ? newData.ownerGroups?.join(',') : ''));

      const uniquenessSet = (qs.parse(uniquenessStr)).set as Set;

      filter = new SetFilterBuilder<GenericList>(uniquenessSet, {
        filter: filter
      })
        .build();
    }

    // final uniqueness controlling filter
    // console.log('Uniqueness Filter: ', JSON.stringify(filter));

    const existingList = await super.findOne(filter);

    if (existingList) {

      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "List already exists.",
        code: "LIST-ALREADY-EXISTS",
        status: 409,
      });
    }
  }
}
