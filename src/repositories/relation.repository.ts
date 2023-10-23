import {DefaultCrudRepository} from '@loopback/repository';
import {Relation, RelationRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class RelationRepository extends DefaultCrudRepository<
  Relation,
  typeof Relation.prototype.id,
  RelationRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(Relation, dataSource);
  }
}
