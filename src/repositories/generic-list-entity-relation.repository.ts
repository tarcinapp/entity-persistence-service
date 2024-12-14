import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, repository} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import {EntityDbDataSource} from '../datasources';
import {IdempotencyConfigurationReader} from '../extensions';
import {GenericListEntityRelation, GenericListEntityRelationRelations} from '../models';
import {GenericEntityRepository} from './generic-entity.repository';

export class GenericListEntityRelationRepository extends DefaultCrudRepository<
  GenericListEntityRelation,
  typeof GenericListEntityRelation.prototype.id,
  GenericListEntityRelationRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('GenericEntityRepository') protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>,
    @inject('extensions.idempotency.configurationreader') private idempotencyConfigReader: IdempotencyConfigurationReader
  ) {
    super(GenericListEntityRelation, dataSource);
  }

  async create(data: DataObject<GenericListEntityRelation>) {
    const idempotencyKey = this.calculateIdempotencyKey(data);
    const genericEntityRepo = this.genericEntityRepositoryGetter();
    //    const genericListRepo = this.

    genericEntityRepo.then((repo) => repo.findById(data.entityId))
      .then(e => console.log(e))
      .catch(e => console.log(e));



    return super.create(data);
  }

  calculateIdempotencyKey(data: DataObject<GenericListEntityRelation>) {
    const idempotencyFields = this.idempotencyConfigReader.getIdempotencyForListEntityRels(data.kind);

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
