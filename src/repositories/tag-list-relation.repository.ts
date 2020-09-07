import {DefaultCrudRepository} from '@loopback/repository';
import {TagListRelation, TagListRelationRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class TagListRelationRepository extends DefaultCrudRepository<
  TagListRelation,
  typeof TagListRelation.prototype.id,
  TagListRelationRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(TagListRelation, dataSource);
  }
}
