import { AsyncLocalStorage } from "async_hooks";

export interface TransactionalContext<O = any> {
  $commit?: () => Promise<void>;
  $rollback?: () => Promise<void>;
  [key: string]: any;
  options?: O;
}

export const TRANSACTIONAL_CONTEXT =
  new AsyncLocalStorage<TransactionalContext | null>();

export enum Propagation {
  MANDATORY,
  NEVER,
  NOT_SUPPORTED,
  REQUIRED,
  REQUIRES_NEW,
  SUPPORTS,
}
export const Transactional =
  <O = any>(propagation: Propagation = Propagation.REQUIRED, options?: O) =>
  (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    if (descriptor.value) {
      descriptor.value = transactional(originalMethod, propagation, options);
    }
  };

export const transactional = <
  O extends any,
  T extends (...args: any) => Promise<any> = any
>(
  method: T,
  propagation: Propagation = Propagation.REQUIRED,
  options?: O
): T => {
  return async function (this: any, ...args: any[]) {
    const store = TRANSACTIONAL_CONTEXT.getStore();

    if (Propagation.SUPPORTS === propagation) {
      return method.call(this, ...args);
    }

    if (
      [Propagation.REQUIRED, Propagation.MANDATORY].includes(propagation) &&
      store
    ) {
      return method.call(this, ...args);
    }

    if (Propagation.REQUIRED === propagation && !store) {
      return TRANSACTIONAL_CONTEXT.run({ options }, async () => run.call(this));
    }

    if (Propagation.MANDATORY === propagation && !store) {
      throw new Error(
        "Transaction is mandatory but no active transaction was found"
      );
    }

    if (Propagation.NOT_SUPPORTED === propagation && !store) {
      return method.call(this, ...args);
    }

    if (Propagation.NOT_SUPPORTED === propagation && store) {
      return TRANSACTIONAL_CONTEXT.run(null, () => run.call(this));
    }

    if (Propagation.REQUIRES_NEW === propagation) {
      return TRANSACTIONAL_CONTEXT.run({ options }, () => run.call(this));
    }

    if (Propagation.NEVER === propagation && store) {
      throw new Error("Transaction is forbidden yet a transaction was found");
    }

    if (Propagation.NEVER === propagation && !store) {
      return method.call(this, ...args);
    }

    async function run(this: any) {
      try {
        const result = await method.call(this, ...args);
        const store = TRANSACTIONAL_CONTEXT.getStore();
        if (store?.$commit) {
          await store.$commit();
        }
        return result;
      } catch (error) {
        const store = TRANSACTIONAL_CONTEXT.getStore();
        if (store?.$rollback) {
          await store.$rollback();
        }
        throw error;
      }
    }
  } as T;
};
