import { BindingKey } from '@loopback/core';

import _ from 'lodash';
import { EnvConfigHelper } from './env-config-helper';

export const VisibilityConfigBindings = {
  CONFIG_READER: BindingKey.create<VisibilityConfigurationReader>(
    'extensions.visibility.configurationreader',
  ),
};

export class VisibilityConfigurationReader {
  private env = EnvConfigHelper.getInstance();
  defaultEntityVisibility: string = 'protected';
  defaultListVisibility: string = 'protected';
  defaultEntityReactionVisibility: string = 'protected';
  defaultListReactionVisibility: string = 'protected';

  public isVisibilityConfiguredForEntities(kind?: string) {
    return (
      !!this.env.VISIBILITY_ENTITY ||
      this.isVisibilityConfiguredForKindForEntities(kind)
    );
  }

  public isVisibilityConfiguredForKindForEntities(kind?: string): boolean {
    if (!kind) {
      return false;
    }

    return !!this.env.getVisibilityEntityForKind(kind);
  }

  public getVisibilityForEntities(kind?: string) {
    if (kind) {
      const kindVal = this.env.getVisibilityEntityForKind(kind);
      if (kindVal !== undefined) {
        return kindVal;
      }
    }

    if (this.env.VISIBILITY_ENTITY !== undefined) {
      return this.env.VISIBILITY_ENTITY;
    }

    return this.defaultEntityVisibility;
  }

  public isVisibilityConfiguredForLists(kind?: string) {
    return (
      !!this.env.VISIBILITY_LIST ||
      this.isVisibilityConfiguredForKindForLists(kind)
    );
  }

  public isVisibilityConfiguredForKindForLists(kind?: string): boolean {
    if (!kind) {
      return false;
    }

    return !!this.env.getVisibilityListForKind(kind);
  }

  public getVisibilityForLists(kind?: string) {
    if (kind) {
      const kindVal = this.env.getVisibilityListForKind(kind);
      if (kindVal !== undefined) {
        return kindVal;
      }
    }

    if (this.env.VISIBILITY_LIST !== undefined) {
      return this.env.VISIBILITY_LIST;
    }

    return this.defaultListVisibility;
  }

  public isVisibilityConfiguredForEntityReactions(kind?: string) {
    return (
      !!this.env.VISIBILITY_ENTITY_REACTION ||
      this.isVisibilityConfiguredForKindForEntityReactions(kind)
    );
  }

  public isVisibilityConfiguredForKindForEntityReactions(
    kind?: string,
  ): boolean {
    if (!kind) {
      return false;
    }

    return !!this.env.getVisibilityEntityReactionForKind(kind);
  }

  public getVisibilityForEntityReactions(kind?: string) {
    if (kind) {
      const kindVal = this.env.getVisibilityEntityReactionForKind(kind);
      if (kindVal !== undefined) {
        return kindVal;
      }
    }

    if (this.env.VISIBILITY_ENTITY_REACTION !== undefined) {
      return this.env.VISIBILITY_ENTITY_REACTION;
    }

    return this.defaultEntityReactionVisibility;
  }

  public isVisibilityConfiguredForListReactions(kind?: string) {
    return (
      !!this.env.VISIBILITY_LIST_REACTION ||
      this.isVisibilityConfiguredForKindForListReactions(kind)
    );
  }

  public isVisibilityConfiguredForKindForListReactions(kind?: string): boolean {
    if (!kind) {
      return false;
    }

    return !!this.env.getVisibilityListReactionForKind(kind);
  }

  public getVisibilityForListReactions(kind?: string) {
    if (kind) {
      const kindVal = this.env.getVisibilityListReactionForKind(kind);
      if (kindVal !== undefined) {
        return kindVal;
      }
    }

    if (this.env.VISIBILITY_LIST_REACTION !== undefined) {
      return this.env.VISIBILITY_LIST_REACTION;
    }

    return this.defaultListReactionVisibility;
  }
}
