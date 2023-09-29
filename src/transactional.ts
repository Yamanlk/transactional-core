import { AsyncLocalStorage } from "async_hooks";

export interface TransactionalContext {
  $commit?: () => Promise<void>;
  [key: string]: any;
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
  (propagation: Propagation = Propagation.REQUIRED) =>
  (method: any, descriptor: any) =>
    transactional(method, propagation);

export const transactional = <T extends (...args: any) => Promise<any>>(
  method: T,
  propagation: Propagation = Propagation.REQUIRED
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
      return TRANSACTIONAL_CONTEXT.run({}, async () => run.call(this));
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
      return TRANSACTIONAL_CONTEXT.run({}, () => run.call(this));
    }

    if (Propagation.NEVER === propagation && store) {
      throw new Error("Transaction is forbidden yet a transaction was found");
    }

    if (Propagation.NEVER === propagation && !store) {
      return method.call(this, ...args);
    }

    async function run(this: any) {
      const result = await method.call(this, ...args);
      const store = TRANSACTIONAL_CONTEXT.getStore();
      if (store?.$commit) {
        await store.$commit();
      }
      return result;
    }
  } as T;
};
