import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import { GenericEntity, Reactions } from '../models';
import { GenericEntityRepository } from '../repositories';

export class GenericEntityReactionsController {
  constructor(
    @repository(GenericEntityRepository)
    protected genericEntityRepository: GenericEntityRepository,
  ) {}

  @get('/generic-entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'Array of GenericEntity has many Reactions',
        content: {
          'application/json': {
            schema: { type: 'array', items: getModelSchemaRef(Reactions) },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Reactions>,
  ): Promise<Reactions[]> {
    return this.genericEntityRepository.reactions(id).find(filter);
  }

  @post('/generic-entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'GenericEntity model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(Reactions) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof GenericEntity.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Reactions, {
            title: 'NewReactionsInGenericEntity',
            exclude: ['_id'],
            optional: ['entityId'],
          }),
        },
      },
    })
    reactions: Omit<Reactions, 'id'>,
  ): Promise<Reactions> {
    return this.genericEntityRepository.reactions(id).create(reactions);
  }

  @patch('/generic-entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'GenericEntity.Reactions PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Reactions, { partial: true }),
        },
      },
    })
    reactions: Partial<Reactions>,
    @param.query.object('where', getWhereSchemaFor(Reactions))
    where?: Where<Reactions>,
  ): Promise<Count> {
    return this.genericEntityRepository.reactions(id).patch(reactions, where);
  }

  @del('/generic-entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'GenericEntity.Reactions DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Reactions))
    where?: Where<Reactions>,
  ): Promise<Count> {
    return this.genericEntityRepository.reactions(id).delete(where);
  }
}
