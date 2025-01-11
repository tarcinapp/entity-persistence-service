import { inject } from '@loopback/core';
import { DefaultCrudRepository } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { TagListRelation, TagListRelationRelations } from '../models';

export class TagListRelationRepository extends DefaultCrudRepository<
  TagListRelation,
  typeof TagListRelation.prototype.id,
  TagListRelationRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(TagListRelation, dataSource);
  }
}
