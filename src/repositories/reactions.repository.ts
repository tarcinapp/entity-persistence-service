import {DefaultCrudRepository} from '@loopback/repository';
import {Reactions, ReactionsRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class ReactionsRepository extends DefaultCrudRepository<
  Reactions,
  typeof Reactions.prototype.id,
  ReactionsRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(Reactions, dataSource);
  }
}
