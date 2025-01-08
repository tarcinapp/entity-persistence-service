import {
  Count,
  CountSchema,
  Filter,
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
import {EntityRelation} from '../models';
import {RelationRepository} from '../repositories';

export class RelationController {
  constructor(
    @repository(RelationRepository)
    public relationRepository: RelationRepository,
  ) { }

  @post('/relations', {
    responses: {
      '200': {
        description: 'Relation model instance',
        content: {'application/json': {schema: getModelSchemaRef(EntityRelation)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityRelation, {
            title: 'NewRelation',
            exclude: ['id'],
          }),
        },
      },
    })
    relation: Omit<EntityRelation, 'id'>,
  ): Promise<EntityRelation> {
    return this.relationRepository.create(relation);
  }

  @get('/relations/count', {
    responses: {
      '200': {
        description: 'Relation model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(EntityRelation) where?: Where<EntityRelation>,
  ): Promise<Count> {
    return this.relationRepository.count(where);
  }

  @get('/relations', {
    responses: {
      '200': {
        description: 'Array of Relation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityRelation, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(EntityRelation) filter?: Filter<EntityRelation>,
  ): Promise<EntityRelation[]> {
    return this.relationRepository.find(filter);
  }

  @patch('/relations', {
    responses: {
      '200': {
        description: 'Relation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityRelation, {partial: true}),
        },
      },
    })
    relation: EntityRelation,
    @param.where(EntityRelation) where?: Where<EntityRelation>,
  ): Promise<Count> {
    return this.relationRepository.updateAll(relation, where);
  }

  @get('/relations/{id}', {
    responses: {
      '200': {
        description: 'Relation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(EntityRelation, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(EntityRelation, {exclude: 'where'}) filter?: FilterExcludingWhere<EntityRelation>
  ): Promise<EntityRelation> {
    return this.relationRepository.findById(id, filter);
  }

  @patch('/relations/{id}', {
    responses: {
      '204': {
        description: 'Relation PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityRelation, {partial: true}),
        },
      },
    })
    relation: EntityRelation,
  ): Promise<void> {
    await this.relationRepository.updateById(id, relation);
  }

  @put('/relations/{id}', {
    responses: {
      '204': {
        description: 'Relation PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() relation: EntityRelation,
  ): Promise<void> {
    await this.relationRepository.replaceById(id, relation);
  }

  @del('/relations/{id}', {
    responses: {
      '204': {
        description: 'Relation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.relationRepository.deleteById(id);
  }
}
