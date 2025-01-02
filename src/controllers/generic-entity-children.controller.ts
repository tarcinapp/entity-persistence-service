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
import {
  GenericEntity,
  Relation,
} from '../models';
import {GenericEntityRepository} from '../repositories';

export class GenericEntityChildrenController {
  constructor(
    @repository(GenericEntityRepository) protected genericEntityRepository: GenericEntityRepository,
  ) { }

  @get('/generic-entities/{id}/children', {
    responses: {
      '200': {
        description: 'Array of GenericEntity has many Relation',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Relation)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Relation>,
  ): Promise<Relation[]> {
    return this.genericEntityRepository.relations(id).find(filter);
  }

  @post('/generic-entities/{id}/children', {
    responses: {
      '200': {
        description: 'GenericEntity model instance',
        content: {'application/json': {schema: getModelSchemaRef(Relation)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof GenericEntity.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Relation, {
            title: 'NewRelationInGenericEntity',
            exclude: ['_id'],
            optional: ['from']
          }),
        },
      },
    }) relation: Omit<Relation, 'id'>,
  ): Promise<Relation> {
    return this.genericEntityRepository.relations(id).create(relation);
  }

  @patch('/generic-entities/{id}/children', {
    responses: {
      '200': {
        description: 'GenericEntity.Relation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Relation, {partial: true}),
        },
      },
    })
    relation: Partial<Relation>,
    @param.query.object('where', getWhereSchemaFor(Relation)) where?: Where<Relation>,
  ): Promise<Count> {
    return this.genericEntityRepository.relations(id).patch(relation, where);
  }

  @del('/generic-entities/{id}/children', {
    responses: {
      '200': {
        description: 'GenericEntity.Relation DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Relation)) where?: Where<Relation>,
  ): Promise<Count> {
    return this.genericEntityRepository.relations(id).delete(where);
  }
}
