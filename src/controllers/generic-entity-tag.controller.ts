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
TagEntityRelation,
Tag,
} from '../models';
import {GenericEntityRepository} from '../repositories';

export class GenericEntityTagController {
  constructor(
    @repository(GenericEntityRepository) protected genericEntityRepository: GenericEntityRepository,
  ) { }

  @get('/generic-entities/{id}/tags', {
    responses: {
      '200': {
        description: 'Array of GenericEntity has many Tag through TagEntityRelation',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Tag)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Tag>,
  ): Promise<Tag[]> {
    return this.genericEntityRepository.tags(id).find(filter);
  }

  @post('/generic-entities/{id}/tags', {
    responses: {
      '200': {
        description: 'create a Tag model instance',
        content: {'application/json': {schema: getModelSchemaRef(Tag)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof GenericEntity.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {
            title: 'NewTagInGenericEntity',
            exclude: ['id'],
          }),
        },
      },
    }) tag: Omit<Tag, 'id'>,
  ): Promise<Tag> {
    return this.genericEntityRepository.tags(id).create(tag);
  }

  @patch('/generic-entities/{id}/tags', {
    responses: {
      '200': {
        description: 'GenericEntity.Tag PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Partial<Tag>,
    @param.query.object('where', getWhereSchemaFor(Tag)) where?: Where<Tag>,
  ): Promise<Count> {
    return this.genericEntityRepository.tags(id).patch(tag, where);
  }

  @del('/generic-entities/{id}/tags', {
    responses: {
      '200': {
        description: 'GenericEntity.Tag DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Tag)) where?: Where<Tag>,
  ): Promise<Count> {
    return this.genericEntityRepository.tags(id).delete(where);
  }
}
