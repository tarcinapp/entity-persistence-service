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
import { ListReaction, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { ListReactionsRepository } from '../repositories';

export class ListReactionsController {
  constructor(
    @repository(ListReactionsRepository)
    public listReactionsRepository: ListReactionsRepository,
  ) {}

  @post('/list-reactions', {
    responses: {
      '200': {
        description: 'ListReaction model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(ListReaction) },
        },
      },
      '429': {
        description: 'List reaction limit is exceeded',
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
        description: 'List reaction already exists.',
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
          schema: getModelSchemaRef(ListReaction, {
            title: 'NewListReaction',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof ListReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    listReaction: Omit<ListReaction, UnmodifiableCommonFields>,
  ): Promise<ListReaction> {
    return this.listReactionsRepository.create(listReaction);
  }

  @get('/list-reactions/count')
  @response(200, {
    description: 'ListReaction model count',
    content: { 'application/json': { schema: CountSchema } },
  })
  async count(
    @param.where(ListReaction) where?: Where<ListReaction>,
  ): Promise<Count> {
    return this.listReactionsRepository.count(where);
  }

  @get('/list-reactions')
  @response(200, {
    description: 'Array of ListReaction model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(ListReaction, { includeRelations: true }),
        },
      },
    },
  })
  async find(
    @param.filter(ListReaction) filter?: Filter<ListReaction>,
  ): Promise<ListReaction[]> {
    return this.listReactionsRepository.find(filter);
  }

  @patch('/list-reactions')
  @response(200, {
    description: 'ListReaction PATCH success count',
    content: { 'application/json': { schema: CountSchema } },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListReaction, { partial: true }),
        },
      },
    })
    listReaction: ListReaction,
    @param.where(ListReaction) where?: Where<ListReaction>,
  ): Promise<Count> {
    return this.listReactionsRepository.updateAll(listReaction, where);
  }

  @get('/list-reactions/{id}')
  @response(200, {
    description: 'ListReaction model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(ListReaction, { includeRelations: true }),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(ListReaction, { exclude: 'where' })
    filter?: FilterExcludingWhere<ListReaction>,
  ): Promise<ListReaction> {
    return this.listReactionsRepository.findById(id, filter);
  }

  @patch('/list-reactions/{id}')
  @response(204, {
    description: 'ListReaction PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListReaction, { partial: true }),
        },
      },
    })
    listReaction: ListReaction,
  ): Promise<void> {
    await this.listReactionsRepository.updateById(id, listReaction);
  }

  @put('/list-reactions/{id}')
  @response(204, {
    description: 'ListReaction PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() listReaction: ListReaction,
  ): Promise<void> {
    await this.listReactionsRepository.replaceById(id, listReaction);
  }

  @del('/list-reactions/{id}')
  @response(204, {
    description: 'ListReaction DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.listReactionsRepository.deleteById(id);
  }
}
