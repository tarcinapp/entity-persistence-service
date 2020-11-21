import {BindingKey} from '@loopback/core';

export namespace UniquenessBindings {
  export const VALIDATOR = BindingKey.create<UniquenessValidator>(
    'extensions.uniqueness.validator',
  );
}

export class UniquenessValidator {

  writeSomething() {
    console.log('something');
  }
}
