import assert from "node:assert";
import { describe, it } from "node:test";
import { Propagation, TRANSACTIONAL_CONTEXT, Transactional } from "../src";

describe("Transactional", () => {
  it("should create context for required & no context", async () => {
    // given
    class ClassA {
      @Transactional(Propagation.REQUIRED)
      async method() {
        return TRANSACTIONAL_CONTEXT.getStore();
      }
    }

    // when
    let store = await new ClassA().method();

    // then
    assert.ok(store);
  });
});
