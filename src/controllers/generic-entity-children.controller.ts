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
import { EntityRelation, GenericEntity } from '../models';
import { EntityRepository } from '../repositories';

export class GenericEntityChildrenController {
  constructor(
    @repository(EntityRepository)
    protected entityRepo: EntityRepository,
  ) {}

  @get('/generic-entities/{id}/children', {
    responses: {
      '200': {
        description: 'Array of GenericEntity has many Relation',
        content: {
          'application/json': {
            schema: { type: 'array', items: getModelSchemaRef(EntityRelation) },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<EntityRelation>,
  ): Promise<EntityRelation[]> {
    return this.entityRepo.children(id).find(filter);
  }

  @post('/generic-entities/{id}/children', {
    responses: {
      '200': {
        description: 'GenericEntity model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(EntityRelation) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof GenericEntity.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityRelation, {
            title: 'NewRelationInGenericEntity',
            exclude: ['_id'],
            optional: ['from'],
          }),
        },
      },
    })
    relation: Omit<EntityRelation, 'id'>,
  ): Promise<EntityRelation> {
    return this.entityRepo.children(id).create(relation);
  }

  @patch('/generic-entities/{id}/children', {
    responses: {
      '200': {
        description: 'GenericEntity.Relation PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityRelation, { partial: true }),
        },
      },
    })
    relation: Partial<EntityRelation>,
    @param.query.object('where', getWhereSchemaFor(EntityRelation))
    where?: Where<EntityRelation>,
  ): Promise<Count> {
    return this.entityRepo.children(id).patch(relation, where);
  }

  @del('/generic-entities/{id}/children', {
    responses: {
      '200': {
        description: 'GenericEntity.Relation DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(EntityRelation))
    where?: Where<EntityRelation>,
  ): Promise<Count> {
    return this.entityRepo.children(id).delete(where);
  }
}
