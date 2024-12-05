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
import {ListEntityRelation} from '../models';
import {ListEntityRelationRepository} from '../repositories';

export class GenericListEntityRelController {
  constructor(
    @repository(ListEntityRelationRepository)
    public listEntityRelationRepository: ListEntityRelationRepository,
  ) { }

  @post('/generic-list-entity-relations', {
    responses: {
      '200': {
        description: 'ListEntityRelation model instance',
        content: {'application/json': {schema: getModelSchemaRef(ListEntityRelation)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListEntityRelation, {
            title: 'NewListEntityRelation',
            exclude: ['id'],
          }),
        },
      },
    })
    listEntityRelation: Omit<ListEntityRelation, 'id'>,
  ): Promise<ListEntityRelation> {
    return this.listEntityRelationRepository.create(listEntityRelation);
  }

  @get('/generic-list-entity-relations/count', {
    responses: {
      '200': {
        description: 'ListEntityRelation model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(ListEntityRelation) where?: Where<ListEntityRelation>,
  ): Promise<Count> {
    return this.listEntityRelationRepository.count(where);
  }

  @get('/generic-list-entity-relations', {
    responses: {
      '200': {
        description: 'Array of ListEntityRelation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ListEntityRelation, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(ListEntityRelation) filter?: Filter<ListEntityRelation>,
  ): Promise<ListEntityRelation[]> {
    return this.listEntityRelationRepository.find(filter);
  }

  @patch('/generic-list-entity-relations', {
    responses: {
      '200': {
        description: 'ListEntityRelation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListEntityRelation, {partial: true}),
        },
      },
    })
    listEntityRelation: ListEntityRelation,
    @param.where(ListEntityRelation) where?: Where<ListEntityRelation>,
  ): Promise<Count> {
    return this.listEntityRelationRepository.updateAll(listEntityRelation, where);
  }

  @get('/generic-list-entity-relations/{id}', {
    responses: {
      '200': {
        description: 'ListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListEntityRelation, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(ListEntityRelation, {exclude: 'where'}) filter?: FilterExcludingWhere<ListEntityRelation>
  ): Promise<ListEntityRelation> {
    return this.listEntityRelationRepository.findById(id, filter);
  }

  @patch('/generic-list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'ListEntityRelation PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListEntityRelation, {partial: true}),
        },
      },
    })
    listEntityRelation: ListEntityRelation,
  ): Promise<void> {
    await this.listEntityRelationRepository.updateById(id, listEntityRelation);
  }

  @put('/generic-list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'ListEntityRelation PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() listEntityRelation: ListEntityRelation,
  ): Promise<void> {
    await this.listEntityRelationRepository.replaceById(id, listEntityRelation);
  }

  @del('/generic-list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'ListEntityRelation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.listEntityRelationRepository.deleteById(id);
  }
}
