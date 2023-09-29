import assert from "node:assert";
import { describe, it } from "node:test";
import { Propagation, TRANSACTIONAL_CONTEXT, transactional } from "../src";

describe("transactional", () => {
  it("should create context for required & no context", async () => {
    // given
    const method = transactional(async () => {
      return TRANSACTIONAL_CONTEXT.getStore();
    }, Propagation.REQUIRED);

    // when
    let store = await method();

    // then
    assert.ok(store);
  });
  it("should reuse context for required & context", async () => {
    // given
    const method = transactional(async () => {
      const inner = await transactional(async () => {
        return TRANSACTIONAL_CONTEXT.getStore();
      })();

      return { outer: TRANSACTIONAL_CONTEXT.getStore(), inner };
    }, Propagation.REQUIRED);

    // when
    let { inner, outer } = await method();

    // then
    assert.equal(inner, outer);
  });

  it("should fail for mandatory & no context", async () => {
    // given
    const method = transactional(async () => {
      return TRANSACTIONAL_CONTEXT.getStore();
    }, Propagation.MANDATORY);

    // when
    const promise = method();

    // then
    assert.rejects(promise);
  });
  it("should pass for mandatory & context", async () => {
    // given
    const method = transactional(async () => {
      const inner = await transactional(async () => {
        return TRANSACTIONAL_CONTEXT.getStore();
      }, Propagation.MANDATORY)();

      return { outer: TRANSACTIONAL_CONTEXT.getStore(), inner };
    }, Propagation.REQUIRED);

    // when
    let { inner, outer } = await method();

    // then
    assert.equal(inner, outer);
  });
});
