import {inject, uuid} from '@loopback/core';
import {DataObject, DefaultCrudRepository} from '@loopback/repository';
import {EntityDbDataSource} from '../datasources';
import {GenericEntity, GenericEntityRelations, HttpErrorResponse, SingleError} from '../models';

export class GenericEntityRepository extends DefaultCrudRepository<
  GenericEntity,
  typeof GenericEntity.prototype.id,
  GenericEntityRelations
  > {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(GenericEntity, dataSource);
  }

  async create(entity: DataObject<GenericEntity>) {

    /**
     * Check if there is an existing entity with same name
     * and validUntil field does not have a value.
     */
    const activeEntityWithSameName = await super.findOne({
      where: {
        name: entity.name,
        validUntil: {
          inq: [null]
        }
      }
    });

    /**
     * If the query above returns an entity then throw an error as new entity
     * with an existing name can not be created.
     */
    if (activeEntityWithSameName) {

      throw new HttpErrorResponse({
        status: 'Conflict',
        statusCode: 409,
        errors: [new SingleError({
          code: 'NAME-ALREADY-EXISTS',
          message: 'Name already exists',
          source: '/name'
        })]
      });
    }

    entity.id = uuid();

    return super.create(entity);
  }
}
