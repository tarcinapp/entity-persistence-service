import { inject } from '@loopback/core';
import { DefaultCrudRepository } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { TagEntityRelation, TagEntityRelationRelations } from '../models';

export class TagEntityRelationRepository extends DefaultCrudRepository<
  TagEntityRelation,
  typeof TagEntityRelation.prototype.id,
  TagEntityRelationRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(TagEntityRelation, dataSource);
  }
}
