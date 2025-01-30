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
import { GenericEntity, EntityReactions } from '../models';
import { EntityRepository } from '../repositories';

export class ReactionsThroughEntitiesController {
  constructor(
    @repository(EntityRepository)
    protected entityRepo: EntityRepository,
  ) {}

  @get('/entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'Array of GenericEntity has many Reactions',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityReactions),
            },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<EntityReactions>,
  ): Promise<EntityReactions[]> {
    return this.entityRepo.reactions(id).find(filter);
  }

  @post('/entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'Entity model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(EntityReactions) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof GenericEntity.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReactions, {
            title: 'NewReactionsInGenericEntity',
            exclude: ['_id'],
            optional: ['entityId'],
          }),
        },
      },
    })
    reactions: Omit<EntityReactions, 'id'>,
  ): Promise<EntityReactions> {
    return this.entityRepo.reactions(id).create(reactions);
  }

  @patch('/entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'Entity.Reactions PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReactions, { partial: true }),
        },
      },
    })
    reactions: Partial<EntityReactions>,
    @param.query.object('where', getWhereSchemaFor(EntityReactions))
    where?: Where<EntityReactions>,
  ): Promise<Count> {
    return this.entityRepo.reactions(id).patch(reactions, where);
  }

  @del('/entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'Entity.Reactions DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(EntityReactions))
    where?: Where<EntityReactions>,
  ): Promise<Count> {
    return this.entityRepo.reactions(id).delete(where);
  }
}
