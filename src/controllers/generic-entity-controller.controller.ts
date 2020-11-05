import {Count, CountSchema, Filter, FilterBuilder, FilterExcludingWhere, repository, Where, WhereBuilder} from '@loopback/repository';
import {del, get, getJsonSchema, getModelSchemaRef, param, patch, post, put, requestBody} from '@loopback/rest';
import _ from 'lodash';
import {GenericEntity, HttpErrorResponse} from '../models';
import {GenericEntityRepository} from '../repositories';
import {Set, SetFactory} from '../sets/set';

export class GenericEntityControllerController {
  constructor(
    @repository(GenericEntityRepository)
    public genericEntityRepository: GenericEntityRepository,
  ) {}

  @post('/generic-entities', {
    responses: {
      '200': {
        description: 'GenericEntity model instance',
        content: {'application/json': {schema: getModelSchemaRef(GenericEntity)}},
      },
      '409': {
        description: 'Entity name already exists.',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse)
              }
            }
          }
        }
      }
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewGenericEntity',
            exclude: ['id'],
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, 'id'>,
  ): Promise<GenericEntity> {
    return this.genericEntityRepository.create(genericEntity);
  }

  @get('/generic-entities/count', {
    responses: {
      '200': {
        description: 'GenericEntity model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(GenericEntity) where?: Where<GenericEntity>,
  ): Promise<Count> {
    return this.genericEntityRepository.count(where);
  }

  @get('/generic-entities', {
    responses: {
      '200': {
        description: 'Array of GenericEntity model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(GenericEntity, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.filter(GenericEntity) filter?: Filter<GenericEntity>
  ): Promise<GenericEntity[]> {

    if (set) {
      let setFactory = new SetFactory();
      let whereBuilder = new WhereBuilder<GenericEntity>();
      let keys = _.keys(set);

      _.each(keys, (key, i) => {
        let clause = setFactory.produceWhereClauseFor(key);

        if (i == 0) {
          whereBuilder = new WhereBuilder(clause)
        } else {
          whereBuilder.and(clause);
        }
      });

      if (filter?.where) {
        whereBuilder.and(filter.where);
      }

      let filterBuilder = new FilterBuilder(filter);
      filter = filterBuilder.where(whereBuilder.build())
        .build();
    }

    return this.genericEntityRepository.find(filter);
  }

  @patch('/generic-entities', {
    responses: {
      '200': {
        description: 'GenericEntity PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {partial: true}),
        },
      },
    })
    genericEntity: GenericEntity,
    @param.where(GenericEntity) where?: Where<GenericEntity>,
  ): Promise<Count> {
    return this.genericEntityRepository.updateAll(genericEntity, where);
  }

  @get('/generic-entities/{id}', {
    responses: {
      '200': {
        description: 'GenericEntity model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(GenericEntity, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(GenericEntity, {exclude: 'where'}) filter?: FilterExcludingWhere<GenericEntity>
  ): Promise<GenericEntity> {
    return this.genericEntityRepository.findById(id, filter);
  }

  @patch('/generic-entities/{id}', {
    responses: {
      '204': {
        description: 'GenericEntity PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {partial: true}),
        },
      },
    })
    genericEntity: GenericEntity,
  ): Promise<void> {
    await this.genericEntityRepository.updateById(id, genericEntity);
  }

  @put('/generic-entities/{id}', {
    responses: {
      '204': {
        description: 'GenericEntity PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() genericEntity: GenericEntity,
  ): Promise<void> {
    await this.genericEntityRepository.replaceById(id, genericEntity);
  }

  @del('/generic-entities/{id}', {
    responses: {
      '204': {
        description: 'GenericEntity DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.genericEntityRepository.deleteById(id);
  }
}
