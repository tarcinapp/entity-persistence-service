import { inject } from '@loopback/core';
import type { DataObject, Options } from '@loopback/repository';
import {
  DefaultCrudRepository,
  Filter,
  FilterBuilder,
  Where,
} from '@loopback/repository';
import _ from 'lodash';

import { EntityDbDataSource } from '../datasources';
import type { TagRelations } from '../models';
import { HttpErrorResponse, Tag } from '../models';

export class TagRepository extends DefaultCrudRepository<
  Tag,
  typeof Tag.prototype.id,
  TagRelations
> {
  private static response_limit = _.parseInt(
    process.env.response_limit_tag || '50',
  );

  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(Tag, dataSource);
  }

  async find(filter?: Filter<Tag>, options?: Options) {
    if (filter?.limit && filter.limit > TagRepository.response_limit) {
      filter.limit = TagRepository.response_limit;
    }

    return super.find(filter, options);
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
      content: data.content,
    };

    const filter: Filter<Tag> = new FilterBuilder<Tag>()
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
        name: 'DataUniquenessViolationError',
        message: 'Entity already exists.',
        code: 'ENTITY-ALREADY-EXISTS',
        status: 409,
      });
    }
  }
}
