/** Schema decode at IPC boundaries; parse errors stay typed for callers to map. */

import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import type * as ParseResult from "effect/ParseResult";
import * as Schema from "effect/Schema";

/**
 * Decode a wire value against a schema at an IPC boundary. The parse error
 * stays in the error channel so each boundary can map it into its own error
 * type. The input is generic because some boundaries decode loose wire
 * unions (`IPCCommand | IPCCommand["payload"]`) validated at runtime.
 */
export const decodeAtBoundary = <A, B>(
  schema: Schema.Schema<A>,
  value: B
): Effect.Effect<A, ParseResult.ParseError> => {
  const result = Schema.decodeUnknownEither(schema)(value);
  return Either.isLeft(result)
    ? Effect.fail(result.left)
    : Effect.succeed(result.right);
};
