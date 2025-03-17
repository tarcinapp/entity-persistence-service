import { inject } from '@loopback/context';
import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
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
  Request,
  RestBindings,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { ListToEntityRelation } from '../models';
import { ListEntityRelationRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class GenericListEntityRelController {
  constructor(
    @repository(ListEntityRelationRepository)
    public listEntityRelationRepository: ListEntityRelationRepository,
    @inject('services.LoggingService')
    private loggingService: LoggingService,
    @inject(RestBindings.Http.REQUEST)
    private request: Request,
  ) {}

  @post('/list-entity-relations', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListToEntityRelation),
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListToEntityRelation, {
            title: 'NewGenericListEntityRelation',
            exclude: [
              '_id',
              '_fromMetadata',
              '_toMetadata',
              '_version',
              '_idempotencyKey',
            ],
          }),
        },
      },
    })
    listEntityRelation: Omit<ListToEntityRelation, 'id'>,
  ): Promise<ListToEntityRelation> {
    this.loggingService.debug('Creating new list-entity relation', {
      listEntityRelation,
    });
    const result =
      await this.listEntityRelationRepository.create(listEntityRelation);
    this.loggingService.info('List-entity relation created successfully', {
      relationId: result._id,
    });

    return result;
  }

  @get('/list-entity-relations/count', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.where(ListToEntityRelation)
    where?: Where<ListToEntityRelation>,
    @param.query.object('set') set?: Set,
  ): Promise<Count> {
    this.loggingService.debug('Counting list-entity relations', { set, where });
    const filterBuilder = new FilterBuilder<ListToEntityRelation>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<ListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    const result = await this.listEntityRelationRepository.count(filter.where);
    this.loggingService.info('List-entity relations counted successfully', {
      count: result.count,
    });

    return result;
  }

  @get('/list-entity-relations', {
    responses: {
      '200': {
        description: 'Array of GenericListEntityRelation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ListToEntityRelation, {
                includeRelations: true,
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.filter(ListToEntityRelation)
    filter?: Filter<ListToEntityRelation>,
  ): Promise<ListToEntityRelation[]> {
    this.loggingService.debug('Finding list-entity relations', { set, filter });
    if (set) {
      filter = new SetFilterBuilder<ListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    const result = await this.listEntityRelationRepository.find(filter);
    this.loggingService.info('List-entity relations found successfully', {
      count: result.length,
    });

    return result;
  }

  @patch('/list-entity-relations', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListToEntityRelation, {
            exclude: [
              '_id',
              '_fromMetadata',
              '_toMetadata',
              '_version',
              '_idempotencyKey',
            ],
            partial: true,
          }),
        },
      },
    })
    listEntityRelation: ListToEntityRelation,
    @param.where(ListToEntityRelation)
    where?: Where<ListToEntityRelation>,
  ): Promise<Count> {
    return this.listEntityRelationRepository.updateAll(
      listEntityRelation,
      where,
    );
  }

  @get('/list-entity-relations/{id}', {
    responses: {
      '200': {
        description: 'GenericListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListToEntityRelation, {
              includeRelations: true,
            }),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(ListToEntityRelation, { exclude: 'where' })
    filter?: FilterExcludingWhere<ListToEntityRelation>,
  ): Promise<ListToEntityRelation> {
    return this.listEntityRelationRepository.findById(id, filter);
  }

  @patch('/list-entity-relations/{id}', {
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
          schema: getModelSchemaRef(ListToEntityRelation, {
            exclude: [
              '_id',
              '_fromMetadata',
              '_toMetadata',
              '_version',
              '_idempotencyKey',
            ],
            partial: true,
          }),
        },
      },
    })
    listEntityRelation: ListToEntityRelation,
  ): Promise<void> {
    await this.listEntityRelationRepository.updateById(id, listEntityRelation);
  }

  @put('/list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'GenericListEntityRelation PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        exclude: [
          '_id',
          '_fromMetadata',
          '_toMetadata',
          '_version',
          '_idempotencyKey',
        ],
      },
    })
    listEntityRelation: ListToEntityRelation,
  ): Promise<void> {
    await this.listEntityRelationRepository.replaceById(id, listEntityRelation);
  }

  @del('/list-entity-relations/{id}', {
    responses: {
      '204': {
        description: 'GenericListEntityRelation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.listEntityRelationRepository.deleteById(id);
  }
}
