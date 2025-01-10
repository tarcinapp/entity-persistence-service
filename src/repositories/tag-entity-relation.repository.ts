import { DefaultCrudRepository } from '@loopback/repository';
import { TagEntityRelation, TagEntityRelationRelations } from '../models';
import { EntityDbDataSource } from '../datasources';
import { inject } from '@loopback/core';

export class TagEntityRelationRepository extends DefaultCrudRepository<
  TagEntityRelation,
  typeof TagEntityRelation.prototype.id,
  TagEntityRelationRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(TagEntityRelation, dataSource);
  }
}
