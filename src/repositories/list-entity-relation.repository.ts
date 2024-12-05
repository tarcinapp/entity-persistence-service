import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {EntityDbDataSource} from '../datasources';
import {GenericListEntityRelation, GenericListEntityRelationRelations} from '../models';

export class GenericListEntityRelationRepository extends DefaultCrudRepository<
  GenericListEntityRelation,
  typeof GenericListEntityRelation.prototype.id,
  GenericListEntityRelationRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(GenericListEntityRelation, dataSource);
  }
}
