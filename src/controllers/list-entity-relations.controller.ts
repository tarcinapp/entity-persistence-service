import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { GenericListToEntityRelation } from '../models';
import { GenericListEntityRelationRepository } from '../repositories';

export class GenericListEntityRelController {
  constructor(
    @repository(GenericListEntityRelationRepository)
    public genericListEntityRelationRepository: GenericListEntityRelationRepository,
  ) {}

  @post('/list-entity-relations', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(GenericListToEntityRelation),
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericListToEntityRelation, {
            title: 'NewGenericListEntityRelation',
            exclude: [
              '_id',
              '_fromMetadata',
              '_toMetadata',
              '_version',
              '_idempotencyKey',
            ],
          }),
        },
      },
    })
    listEntityRelation: Omit<GenericListToEntityRelation, 'id'>,
  ): Promise<GenericListToEntityRelation> {
    return this.genericListEntityRelationRepository.create(listEntityRelation);
  }

  @get('/list-entity-relations/count', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.where(GenericListToEntityRelation)
    where?: Where<GenericListToEntityRelation>,
    @param.query.object('set') set?: Set,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<GenericListToEntityRelation>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<GenericListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    return this.genericListEntityRelationRepository.count(filter.where);
  }

  @get('/list-entity-relations', {
    responses: {
      '200': {
        description: 'Array of GenericListEntityRelation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(GenericListToEntityRelation, {
                includeRelations: true,
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.filter(GenericListToEntityRelation)
    filter?: Filter<GenericListToEntityRelation>,
  ): Promise<GenericListToEntityRelation[]> {
    if (set) {
      filter = new SetFilterBuilder<GenericListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.genericListEntityRelationRepository.find(filter);
  }

  @patch('/list-entity-relations', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericListToEntityRelation, {
            exclude: [
              '_id',
              '_fromMetadata',
              '_toMetadata',
              '_version',
              '_idempotencyKey',
            ],
            partial: true,
          }),
        },
      },
    })
    listEntityRelation: GenericListToEntityRelation,
    @param.where(GenericListToEntityRelation)
    where?: Where<GenericListToEntityRelation>,
  ): Promise<Count> {
    return this.genericListEntityRelationRepository.updateAll(
      listEntityRelation,
      where,
    );
  }

  @get('/list-entity-relations/{id}', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(GenericListToEntityRelation, {
              includeRelations: true,
            }),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(GenericListToEntityRelation, { exclude: 'where' })
    filter?: FilterExcludingWhere<GenericListToEntityRelation>,
  ): Promise<GenericListToEntityRelation> {
    return this.genericListEntityRelationRepository.findById(id, filter);
  }

  @patch('/list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'GenericListEntityRelation PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericListToEntityRelation, {
            exclude: [
              '_id',
              '_fromMetadata',
              '_toMetadata',
              '_version',
              '_idempotencyKey',
            ],
            partial: true,
          }),
        },
      },
    })
    listEntityRelation: GenericListToEntityRelation,
  ): Promise<void> {
    await this.genericListEntityRelationRepository.updateById(
      id,
      listEntityRelation,
    );
  }

  @put('/list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'GenericListEntityRelation PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        exclude: [
          '_id',
          '_fromMetadata',
          '_toMetadata',
          '_version',
          '_idempotencyKey',
        ],
      },
    })
    listEntityRelation: GenericListToEntityRelation,
  ): Promise<void> {
    await this.genericListEntityRelationRepository.replaceById(
      id,
      listEntityRelation,
    );
  }

  @del('/list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'GenericListEntityRelation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.genericListEntityRelationRepository.deleteById(id);
  }
}
