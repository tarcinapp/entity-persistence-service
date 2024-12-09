import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {EntityDbDataSource} from '../datasources';
import {GenericListEntityRelation, ListEntityRelationRelations} from '../models';

export class ListEntityRelationRepository extends DefaultCrudRepository<
  GenericListEntityRelation,
  typeof GenericListEntityRelation.prototype.id,
  ListEntityRelationRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(GenericListEntityRelation, dataSource);
  }
}
