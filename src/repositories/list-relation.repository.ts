import { inject } from '@loopback/core';
import { DefaultCrudRepository } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { ListRelation, ListRelationRelations } from '../models';

export class ListRelationRepository extends DefaultCrudRepository<
  ListRelation,
  typeof ListRelation.prototype.id,
  ListRelationRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(ListRelation, dataSource);
  }
}
