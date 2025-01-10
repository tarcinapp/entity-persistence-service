import { inject } from '@loopback/core';
import { DefaultCrudRepository } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { EntityRelation, RelationRelations } from '../models';

export class RelationRepository extends DefaultCrudRepository<
  EntityRelation,
  typeof EntityRelation.prototype.id,
  RelationRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(EntityRelation, dataSource);
  }
}
