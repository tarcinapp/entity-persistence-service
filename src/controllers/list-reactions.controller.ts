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
import { transactional } from '../decorators';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { ListReaction, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
  ALWAYS_HIDDEN_FIELDS,
} from '../models/base-types/unmodifiable-common-fields';
import { getFilterSchemaFor } from '../openapi/filter-schemas';
import { ListReactionsRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class ListReactionsController {
  constructor(
    @repository(ListReactionsRepository)
    public listReactionsRepository: ListReactionsRepository,
    @inject('services.LoggingService')
    private logger: LoggingService,
  ) {}

  @transactional()
  @post('/list-reactions', {
    operationId: 'createListReaction',
    responses: {
      '200': {
        description: 'ListReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListReaction, {
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListReaction)[],
            }),
          },
        },
      },
      '429': {
        description: 'List reaction limit is exceeded',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '409': {
        description: 'List reaction already exists.',
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
          schema: getModelSchemaRef(ListReaction, {
            title: 'NewListReaction',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof ListReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    listReaction: Omit<ListReaction, UnmodifiableCommonFields>,
    @inject('active.transaction.options', {optional: true})
    options: any = {},
  ): Promise<ListReaction> {
    return this.listReactionsRepository.create(listReaction, options);
  }

  @get('/list-reactions/count', {
    operationId: 'countListReactions',
    responses: {
      '200': {
        description: 'ListReaction model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.query.object('set') set?: Set,
    @param.where(ListReaction) where?: Where<ListReaction>,
    @param.query.object('listSet') listSet?: Set,
    @param.query.object('listWhere') listWhere?: Where<ListReaction>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<ListReaction>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<ListReaction>(set, {
        filter: filter,
      }).build();
    }

    // Build list filter
    const listFilterBuilder = new FilterBuilder<ListReaction>();
    if (listWhere) {
      listFilterBuilder.where(listWhere);
    }

    let listFilter = listFilterBuilder.build();
    if (listSet) {
      listFilter = new SetFilterBuilder<ListReaction>(listSet, {
        filter: listFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(listFilter);

    return this.listReactionsRepository.count(filter.where, listFilter.where);
  }

  @get('/list-reactions', {
    operationId: 'findListReactions',
    responses: {
      '200': {
        description: 'Array of ListReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ListReaction, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListReaction)[],
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(ListReaction))
    filter?: Filter<ListReaction>,
    @param.query.object('listSet') listSet?: Set,
    @param.query.object('listFilter', getFilterSchemaFor(ListReaction))
    listFilter?: Filter<ListReaction>,
  ): Promise<ListReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<ListReaction>(set, {
        filter: filter,
      }).build();
    }

    if (listSet) {
      listFilter = new SetFilterBuilder<ListReaction>(listSet, {
        filter: listFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(listFilter);

    return this.listReactionsRepository.find(filter, listFilter, {
      useMongoPipeline: true,
    });
  }

  @transactional()
  @patch('/list-reactions', {
    operationId: 'updateListReactions',
    responses: {
      '200': {
        description: 'ListReaction PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListReaction, {
            title: 'PartialListReaction',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof ListReaction)[],
            includeRelations: false,
            optional: ['_listId'],
          }),
        },
      },
    })
    listReaction: Omit<ListReaction, UnmodifiableCommonFields>,
    @param.query.object('set') set?: Set,
    @param.where(ListReaction) where?: Where<ListReaction>,
    @param.query.object('listSet') listSet?: Set,
    @param.where(ListReaction) listWhere?: Where<ListReaction>,
    @inject('active.transaction.options', {optional: true})
    options: any = {},
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<ListReaction>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<ListReaction>(set, {
        filter: filter,
      }).build();
    }

    // Build list filter
    const listFilterBuilder = new FilterBuilder<ListReaction>();
    if (listWhere) {
      listFilterBuilder.where(listWhere);
    }

    let listFilter = listFilterBuilder.build();
    if (listSet) {
      listFilter = new SetFilterBuilder<ListReaction>(listSet, {
        filter: listFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(listFilter);

    return this.listReactionsRepository.updateAll(
      listReaction,
      filter.where,
      listFilter.where,
      options,
    );
  }

  @get('/list-reactions/{id}', {
    operationId: 'findListReactionById',
    responses: {
      '200': {
        description: 'ListReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListReaction, {
              includeRelations: true,
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListReaction)[],
            }),
          },
        },
      },
      '404': {
        description: 'List reaction not found',
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
    @param.query.object('filter', getFilterSchemaFor(ListReaction))
    filter?: FilterExcludingWhere<ListReaction>,
  ): Promise<ListReaction> {
    sanitizeFilterFields(filter);

    return this.listReactionsRepository.findById(id, filter);
  }

  @transactional()
  @patch('/list-reactions/{id}', {
    operationId: 'updateListReactionById',
    responses: {
      '204': {
        description: 'ListReaction PATCH success',
      },
      '404': {
        description: 'List reaction not found',
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
          schema: getModelSchemaRef(ListReaction, {
            title: 'PartialListReaction',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof ListReaction)[],
            includeRelations: false,
            optional: ['_listId'],
          }),
        },
      },
    })
    listReaction: Omit<ListReaction, UnmodifiableCommonFields>,
    @inject('active.transaction.options', {optional: true})
    options: any = {},
  ): Promise<void> {
    await this.listReactionsRepository.updateById(id, listReaction, options);
  }

  @transactional()
  @put('/list-reactions/{id}', {
    operationId: 'replaceListReactionById',
    responses: {
      '204': {
        description: 'ListReaction PUT success',
      },
      '404': {
        description: 'List reaction not found',
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
          schema: getModelSchemaRef(ListReaction, {
            title: 'ReplaceListReaction',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof ListReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    listReaction: Omit<ListReaction, UnmodifiableCommonFields>,
    @inject('active.transaction.options', {optional: true})
    options: any = {},
  ): Promise<void> {
    await this.listReactionsRepository.replaceById(id, listReaction, options);
  }

  @transactional()
  @del('/list-reactions/{id}', {
    operationId: 'deleteListReactionById',
    responses: {
      '204': {
        description: 'ListReaction DELETE success',
      },
      '404': {
        description: 'List reaction not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async deleteById(
    @param.path.string('id') id: string,
    @inject('active.transaction.options', {optional: true})
    options: any = {},
  ): Promise<void> {
    await this.listReactionsRepository.deleteById(id, options);
  }

  @get('/list-reactions/{id}/parents', {
    operationId: 'findParentsByListReactionId',
    responses: {
      '200': {
        description: 'Array of parent ListReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ListReaction, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListReaction)[],
              }),
            },
          },
        },
      },
      '404': {
        description: 'List reaction not found',
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
    @param.query.object('filter', getFilterSchemaFor(ListReaction))
    filter?: Filter<ListReaction>,
    @param.query.object('listSet') listSet?: Set,
    @param.query.object('listFilter', getFilterSchemaFor(ListReaction))
    listFilter?: Filter<ListReaction>,
  ): Promise<ListReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<ListReaction>(set, {
        filter: filter,
      }).build();
    }

    if (listSet) {
      listFilter = new SetFilterBuilder<ListReaction>(listSet, {
        filter: listFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(listFilter);

    return this.listReactionsRepository.findParents(id, filter, listFilter, {
      useMongoPipeline: true,
    });
  }

  @get('/list-reactions/{id}/children', {
    operationId: 'findChildrenByListReactionId',
    responses: {
      '200': {
        description: 'Array of child ListReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ListReaction, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListReaction)[],
              }),
            },
          },
        },
      },
      '404': {
        description: 'List reaction not found',
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
    @param.query.object('filter', getFilterSchemaFor(ListReaction))
    filter?: Filter<ListReaction>,
    @param.query.object('listSet') listSet?: Set,
    @param.query.object('listFilter', getFilterSchemaFor(ListReaction))
    listFilter?: Filter<ListReaction>,
  ): Promise<ListReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<ListReaction>(set, {
        filter: filter,
      }).build();
    }

    if (listSet) {
      listFilter = new SetFilterBuilder<ListReaction>(listSet, {
        filter: listFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(listFilter);

    return this.listReactionsRepository.findChildren(id, filter, listFilter, {
      useMongoPipeline: true,
    });
  }

  @transactional()
  @post('/list-reactions/{id}/children', {
    operationId: 'createChildListReaction',
    responses: {
      '200': {
        description: 'ListReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListReaction, {
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListReaction)[],
            }),
          },
        },
      },
      '429': {
        description: 'List reaction limit is exceeded',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '409': {
        description: 'List reaction already exists.',
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
        description: 'Parent list reaction not found',
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
          schema: getModelSchemaRef(ListReaction, {
            title: 'NewChildListReaction',
            exclude: [
              ...UNMODIFIABLE_COMMON_FIELDS,
              '_parents',
            ] as (keyof ListReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    listReaction: Omit<ListReaction, UnmodifiableCommonFields | '_parents'>,
    @inject('active.transaction.options', {optional: true})
    options: any = {},
  ): Promise<ListReaction> {
    return this.listReactionsRepository.createChild(id, listReaction, options);
  }
}
