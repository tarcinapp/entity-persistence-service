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
import {Set, SetFilterBuilder} from '../extensions/set';
import {sanitizeFilterFields} from '../helpers/filter.helper';
import {GenericListEntityRelation} from '../models';
import {GenericListEntityRelationRepository} from '../repositories';

export class GenericListEntityRelController {
  constructor(
    @repository(GenericListEntityRelationRepository)
    public genericListEntityRelationRepository: GenericListEntityRelationRepository,
  ) { }

  @post('/generic-list-entity-relations', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model instance',
        content: {'application/json': {schema: getModelSchemaRef(GenericListEntityRelation)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericListEntityRelation, {
            title: 'NewGenericListEntityRelation',
            exclude: ['id'],
          }),
        },
      },
    })
    listEntityRelation: Omit<GenericListEntityRelation, 'id'>,
  ): Promise<GenericListEntityRelation> {
    return this.genericListEntityRelationRepository.create(listEntityRelation);
  }

  @get('/generic-list-entity-relations/count', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(GenericListEntityRelation) where?: Where<GenericListEntityRelation>,
  ): Promise<Count> {
    return this.genericListEntityRelationRepository.count(where);
  }

  @get('/generic-list-entity-relations', {
    responses: {
      '200': {
        description: 'Array of GenericListEntityRelation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(GenericListEntityRelation, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.filter(GenericListEntityRelation) filter?: Filter<GenericListEntityRelation>,
  ): Promise<GenericListEntityRelation[]> {

    if (set)
      filter = new SetFilterBuilder<GenericListEntityRelation>(set, {
        filter: filter
      }).build();

    sanitizeFilterFields(filter);

    return this.genericListEntityRelationRepository.find(filter);
  }

  @patch('/generic-list-entity-relations', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericListEntityRelation, {partial: true}),
        },
      },
    })
    listEntityRelation: GenericListEntityRelation,
    @param.where(GenericListEntityRelation) where?: Where<GenericListEntityRelation>,
  ): Promise<Count> {
    return this.genericListEntityRelationRepository.updateAll(listEntityRelation, where);
  }

  @get('/generic-list-entity-relations/{id}', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(GenericListEntityRelation, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(GenericListEntityRelation, {exclude: 'where'}) filter?: FilterExcludingWhere<GenericListEntityRelation>
  ): Promise<GenericListEntityRelation> {
    return this.genericListEntityRelationRepository.findById(id, filter);
  }

  @patch('/generic-list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'GenericListEntityRelation PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericListEntityRelation, {partial: true}),
        },
      },
    })
    listEntityRelation: GenericListEntityRelation,
  ): Promise<void> {
    await this.genericListEntityRelationRepository.updateById(id, listEntityRelation);
  }

  @put('/generic-list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'GenericListEntityRelation PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() listEntityRelation: GenericListEntityRelation,
  ): Promise<void> {
    await this.genericListEntityRelationRepository.replaceById(id, listEntityRelation);
  }

  @del('/generic-list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'GenericListEntityRelation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.genericListEntityRelationRepository.deleteById(id);
  }
}
