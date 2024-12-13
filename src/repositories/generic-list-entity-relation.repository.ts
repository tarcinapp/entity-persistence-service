import {inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository} from '@loopback/repository';
import * as crypto from 'crypto';
import {EntityDbDataSource} from '../datasources';
import {IdempotencyConfigurationReader} from '../extensions';
import {GenericListEntityRelation, GenericListEntityRelationRelations} from '../models';
import _ from 'lodash';

export class GenericListEntityRelationRepository extends DefaultCrudRepository<
  GenericListEntityRelation,
  typeof GenericListEntityRelation.prototype.id,
  GenericListEntityRelationRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @inject('extensions.idempotency.configurationreader') private idempotencyConfigReader: IdempotencyConfigurationReader
  ) {
    super(GenericListEntityRelation, dataSource);
  }

  async create(data: DataObject<GenericListEntityRelation>) {

    const idempotencyKey = this.calculateIdempotencyKey(data);

    console.log(idempotencyKey);

    return super.create(data);
  }

  calculateIdempotencyKey(data: DataObject<GenericListEntityRelation>) {
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
}
