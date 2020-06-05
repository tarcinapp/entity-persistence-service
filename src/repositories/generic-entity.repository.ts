import {inject, uuid} from '@loopback/core';
import {DataObject, DefaultCrudRepository} from '@loopback/repository';
import {EntityDbDataSource} from '../datasources';
import {GenericEntity, GenericEntityRelations} from '../models';

export class GenericEntityRepository extends DefaultCrudRepository<
  GenericEntity,
  typeof GenericEntity.prototype.id,
  GenericEntityRelations
  > {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(GenericEntity, dataSource);
  }

  async create(entity: DataObject<GenericEntity>) {
    entity.id = uuid();
    return super.create(entity);
  }
}
