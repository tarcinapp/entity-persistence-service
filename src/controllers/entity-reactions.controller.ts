import { inject } from '@loopback/core';
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
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { EntityReaction, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
  ALWAYS_HIDDEN_FIELDS,
} from '../models/base-types/unmodifiable-common-fields';
import { getFilterSchemaFor } from '../openapi/filter-schemas';
import { EntityReactionsRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class EntityReactionsController {
  constructor(
    @repository(EntityReactionsRepository)
    public entityReactionsRepository: EntityReactionsRepository,
    @inject('services.LoggingService')
    private logger: LoggingService,
  ) {}

  @post('/entity-reactions', {
    operationId: 'createEntityReaction',
    responses: {
      '200': {
        description: 'EntityReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(EntityReaction, {
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof EntityReaction)[],
            }),
          },
        },
      },
      '429': {
        description: 'Entity reaction limit is exceeded',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '409': {
        description: 'Entity reaction already exists.',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '422': {
        description: 'Unprocessable entity',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'NewEntityReaction',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
  ): Promise<EntityReaction> {
    return this.entityReactionsRepository.create(entityReaction);
  }

  @get('/entity-reactions/count', {
    operationId: 'countEntityReactions',
    responses: {
      '200': {
        description: 'EntityReaction model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.query.object('set') set?: Set,
    @param.where(EntityReaction) where?: Where<EntityReaction>,
    @param.query.object('entitySet') entitySet?: Set,
    @param.query.object('entityWhere') entityWhere?: Where<EntityReaction>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<EntityReaction>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    // Build entity filter
    const entityFilterBuilder = new FilterBuilder<EntityReaction>();
    if (entityWhere) {
      entityFilterBuilder.where(entityWhere);
    }

    let entityFilter = entityFilterBuilder.build();
    if (entitySet) {
      entityFilter = new SetFilterBuilder<EntityReaction>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);

    return this.entityReactionsRepository.count(
      filter.where,
      entityFilter.where,
    );
  }

  @get('/entity-reactions', {
    operationId: 'findEntityReactions',
    responses: {
      '200': {
        description: 'Array of EntityReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityReaction, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof EntityReaction)[],
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(EntityReaction))
    filter?: Filter<EntityReaction>,
    @param.query.object('entitySet') entitySet?: Set,
    @param.query.object('entityFilter', getFilterSchemaFor(EntityReaction))
    entityFilter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    if (entitySet) {
      entityFilter = new SetFilterBuilder<EntityReaction>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);

    return this.entityReactionsRepository.find(filter, entityFilter, {
      useMongoPipeline: true,
    });
  }

  @patch('/entity-reactions', {
    operationId: 'updateEntityReactions',
    responses: {
      '200': {
        description: 'EntityReaction PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'PartialEntityReaction',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
            optional: ['_entityId'],
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
    @param.query.object('set') set?: Set,
    @param.where(EntityReaction) where?: Where<EntityReaction>,
    @param.query.object('entitySet') entitySet?: Set,
    @param.where(EntityReaction) entityWhere?: Where<EntityReaction>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<EntityReaction>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    // Build entity filter
    const entityFilterBuilder = new FilterBuilder<EntityReaction>();
    if (entityWhere) {
      entityFilterBuilder.where(entityWhere);
    }

    let entityFilter = entityFilterBuilder.build();
    if (entitySet) {
      entityFilter = new SetFilterBuilder<EntityReaction>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);

    return this.entityReactionsRepository.updateAll(
      entityReaction,
      filter.where,
      entityFilter.where,
    );
  }

  @get('/entity-reactions/{id}', {
    operationId: 'findEntityReactionById',
    responses: {
      '200': {
        description: 'EntityReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(EntityReaction, {
              includeRelations: true,
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof EntityReaction)[],
            }),
          },
        },
      },
      '404': {
        description: 'Entity reaction not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.query.object('filter', getFilterSchemaFor(EntityReaction))
    filter?: FilterExcludingWhere<EntityReaction>,
  ): Promise<EntityReaction> {
    sanitizeFilterFields(filter);

    return this.entityReactionsRepository.findById(id, filter);
  }

  @patch('/entity-reactions/{id}', {
    operationId: 'updateEntityReactionById',
    responses: {
      '204': {
        description: 'EntityReaction PATCH success',
      },
      '404': {
        description: 'Entity reaction not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '422': {
        description: 'Unprocessable entity',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'PartialEntityReaction',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
            optional: ['_entityId'],
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.entityReactionsRepository.updateById(id, entityReaction);
  }

  @put('/entity-reactions/{id}', {
    operationId: 'replaceEntityReactionById',
    responses: {
      '204': {
        description: 'EntityReaction PUT success',
      },
      '404': {
        description: 'Entity reaction not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '422': {
        description: 'Unprocessable entity',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'ReplaceEntityReaction',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.entityReactionsRepository.replaceById(id, entityReaction);
  }

  @del('/entity-reactions/{id}', {
    operationId: 'deleteEntityReactionById',
    responses: {
      '204': {
        description: 'EntityReaction DELETE success',
      },
      '404': {
        description: 'Entity reaction not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.entityReactionsRepository.deleteById(id);
  }

  @get('/entity-reactions/{id}/parents', {
    operationId: 'findParentsByEntityReactionId',
    responses: {
      '200': {
        description: 'Array of parent EntityReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityReaction, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof EntityReaction)[],
              }),
            },
          },
        },
      },
      '404': {
        description: 'Entity reaction not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async findParents(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(EntityReaction))
    filter?: Filter<EntityReaction>,
    @param.query.object('entitySet') entitySet?: Set,
    @param.query.object('entityFilter', getFilterSchemaFor(EntityReaction))
    entityFilter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    if (entitySet) {
      entityFilter = new SetFilterBuilder<EntityReaction>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);

    return this.entityReactionsRepository.findParents(
      id,
      filter,
      entityFilter,
      { useMongoPipeline: true },
    );
  }

  @get('/entity-reactions/{id}/children', {
    operationId: 'findChildrenByEntityReactionId',
    responses: {
      '200': {
        description: 'Array of child EntityReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityReaction, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof EntityReaction)[],
              }),
            },
          },
        },
      },
      '404': {
        description: 'Entity reaction not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async findChildren(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(EntityReaction))
    filter?: Filter<EntityReaction>,
    @param.query.object('entitySet') entitySet?: Set,
    @param.query.object('entityFilter', getFilterSchemaFor(EntityReaction))
    entityFilter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    if (entitySet) {
      entityFilter = new SetFilterBuilder<EntityReaction>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);

    return this.entityReactionsRepository.findChildren(
      id,
      filter,
      entityFilter,
      { useMongoPipeline: true },
    );
  }

  @post('/entity-reactions/{id}/children', {
    operationId: 'createChildEntityReaction',
    responses: {
      '200': {
        description: 'EntityReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(EntityReaction, {
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof EntityReaction)[],
            }),
          },
        },
      },
      '429': {
        description: 'Entity reaction limit is exceeded',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '409': {
        description: 'Entity reaction already exists.',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '422': {
        description: 'Unprocessable entity',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '404': {
        description: 'Parent entity reaction not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async createChild(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'NewChildEntityReaction',
            exclude: [
              ...UNMODIFIABLE_COMMON_FIELDS,
              '_parents',
            ] as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields | '_parents'>,
  ): Promise<EntityReaction> {
    return this.entityReactionsRepository.createChild(id, entityReaction);
  }
}
