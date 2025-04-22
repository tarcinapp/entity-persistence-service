import { inject } from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
  getJsonSchema,
} from '@loopback/rest';
import { EntityReaction, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { EntityReactionsRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class EntityReactionController {
  constructor(
    @repository(EntityReactionsRepository)
    public entityReactionsRepository: EntityReactionsRepository,
    @inject('services.LoggingService')
    private logger: LoggingService,
  ) {}

  @post('/entity-reactions', {
    responses: {
      '200': {
        description: 'EntityReaction model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(EntityReaction) },
        },
      },
      '429': {
        description: 'Entity reaction limit is exceeded',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '409': {
        description: 'Entity reaction already exists.',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '422': {
        description: 'Unprocessable entity',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'NewEntityReaction',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
  ): Promise<EntityReaction> {
    return this.entityReactionsRepository.create(entityReaction);
  }

  @get('/entity-reactions/count')
  @response(200, {
    description: 'EntityReaction model count',
    content: { 'application/json': { schema: CountSchema } },
  })
  async count(
    @param.where(EntityReaction) where?: Where<EntityReaction>,
  ): Promise<Count> {
    return this.entityReactionsRepository.count(where);
  }

  @get('/entity-reactions')
  @response(200, {
    description: 'Array of EntityReaction model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(EntityReaction, { includeRelations: true }),
        },
      },
    },
  })
  async find(
    @param.filter(EntityReaction) filter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    return this.entityReactionsRepository.find(filter);
  }

  @patch('/entity-reactions')
  @response(200, {
    description: 'EntityReaction PATCH success count',
    content: { 'application/json': { schema: CountSchema } },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, { partial: true }),
        },
      },
    })
    entityReaction: EntityReaction,
    @param.where(EntityReaction) where?: Where<EntityReaction>,
  ): Promise<Count> {
    return this.entityReactionsRepository.updateAll(entityReaction, where);
  }

  @get('/entity-reactions/{id}')
  @response(200, {
    description: 'EntityReaction model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(EntityReaction, { includeRelations: true }),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(EntityReaction, { exclude: 'where' })
    filter?: FilterExcludingWhere<EntityReaction>,
  ): Promise<EntityReaction> {
    return this.entityReactionsRepository.findById(id, filter);
  }

  @patch('/entity-reactions/{id}')
  @response(204, {
    description: 'EntityReaction PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, { partial: true }),
        },
      },
    })
    entityReaction: EntityReaction,
  ): Promise<void> {
    await this.entityReactionsRepository.updateById(id, entityReaction);
  }

  @put('/entity-reactions/{id}')
  @response(204, {
    description: 'EntityReaction PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() entityReaction: EntityReaction,
  ): Promise<void> {
    await this.entityReactionsRepository.replaceById(id, entityReaction);
  }

  @del('/entity-reactions/{id}')
  @response(204, {
    description: 'EntityReaction DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.entityReactionsRepository.deleteById(id);
  }
}
