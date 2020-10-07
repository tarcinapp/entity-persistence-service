import {inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, Filter, FilterBuilder, Options, Where} from '@loopback/repository';
import _ from 'lodash';
import {EntityDbDataSource} from '../datasources';
import {HttpErrorResponse, Tag, TagRelations} from '../models';

export class TagRepository extends DefaultCrudRepository<
  Tag,
  typeof Tag.prototype.id,
  TagRelations
  > {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(Tag, dataSource);
  }

  async create(data: DataObject<Tag>) {

    await this.checkUniqueness(data);

    return super.create(data);
  }

  async replaceById(id: string, data: DataObject<Tag>, options?: Options) {

    await this.checkUniqueness(data);

    return super.replaceById(id, data, options);
  }

  async updateById(id: string, data: DataObject<Tag>, options?: Options) {

    if (_.has(data, 'content')) {
      await this.checkUniqueness(data);
    }

    return super.updateById(id, data, options);
  }

  async checkUniqueness(data: DataObject<Tag>) {

    const where: Where<Tag> = {
      content: data.content
    };

    let filter: Filter<Tag> = new FilterBuilder()
      .fields('id')
      .where(where)
      .build();

    /**
     * Check if there is an existing entity
     */
    const activeEntityWithSameName = await super.findOne(filter);

    if (activeEntityWithSameName) {

      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "Entity already exists.",
        code: "ENTITY-ALREADY-EXISTS",
        status: 409,
      });
    }
  }
}
