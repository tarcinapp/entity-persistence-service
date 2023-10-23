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
} from '@loopback/rest';
import {TagEntityRelation} from '../models';
import {TagEntityRelationRepository} from '../repositories';

export class EntityTagsRelationController {
  constructor(
    @repository(TagEntityRelationRepository)
    public tagEntityRelationRepository : TagEntityRelationRepository,
  ) {}

  @post('/tag-entity-relations', {
    responses: {
      '200': {
        description: 'TagEntityRelation model instance',
        content: {'application/json': {schema: getModelSchemaRef(TagEntityRelation)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(TagEntityRelation, {
            title: 'NewTagEntityRelation',
            exclude: ['id'],
          }),
        },
      },
    })
    tagEntityRelation: Omit<TagEntityRelation, 'id'>,
  ): Promise<TagEntityRelation> {
    return this.tagEntityRelationRepository.create(tagEntityRelation);
  }

  @get('/tag-entity-relations/count', {
    responses: {
      '200': {
        description: 'TagEntityRelation model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(TagEntityRelation) where?: Where<TagEntityRelation>,
  ): Promise<Count> {
    return this.tagEntityRelationRepository.count(where);
  }

  @get('/tag-entity-relations', {
    responses: {
      '200': {
        description: 'Array of TagEntityRelation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(TagEntityRelation, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(TagEntityRelation) filter?: Filter<TagEntityRelation>,
  ): Promise<TagEntityRelation[]> {
    return this.tagEntityRelationRepository.find(filter);
  }

  @patch('/tag-entity-relations', {
    responses: {
      '200': {
        description: 'TagEntityRelation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(TagEntityRelation, {partial: true}),
        },
      },
    })
    tagEntityRelation: TagEntityRelation,
    @param.where(TagEntityRelation) where?: Where<TagEntityRelation>,
  ): Promise<Count> {
    return this.tagEntityRelationRepository.updateAll(tagEntityRelation, where);
  }

  @get('/tag-entity-relations/{id}', {
    responses: {
      '200': {
        description: 'TagEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(TagEntityRelation, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(TagEntityRelation, {exclude: 'where'}) filter?: FilterExcludingWhere<TagEntityRelation>
  ): Promise<TagEntityRelation> {
    return this.tagEntityRelationRepository.findById(id, filter);
  }

  @patch('/tag-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'TagEntityRelation PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(TagEntityRelation, {partial: true}),
        },
      },
    })
    tagEntityRelation: TagEntityRelation,
  ): Promise<void> {
    await this.tagEntityRelationRepository.updateById(id, tagEntityRelation);
  }

  @put('/tag-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'TagEntityRelation PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() tagEntityRelation: TagEntityRelation,
  ): Promise<void> {
    await this.tagEntityRelationRepository.replaceById(id, tagEntityRelation);
  }

  @del('/tag-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'TagEntityRelation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.tagEntityRelationRepository.deleteById(id);
  }
}
