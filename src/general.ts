import { get_user } from "./user.js";
import type { AtlasUser } from "./user.js";

export const isNode =
  typeof process !== "undefined" && process.versions && process.versions.node;

export abstract class BaseAtlasClass {
  user: AtlasUser;
  constructor(user?: AtlasUser) {
    if (user === undefined) {
      this.user = get_user();
    } else {
      this.user = user;
    }
  }

  async apiCall(
    endpoint: string,
    method: "GET" | "POST",
    payload: Atlas.Payload = null,
    headers: null | Record<string, string> = null
  ) {
    // make an API call
    return this.user.apiCall(endpoint, method, payload, headers);
  }
}
/*
function isSingleEmbedding(value: any): value is SingleEmbedding {
  return Array.isArray(value) && value.every((element) => typeof element === 'number');
}
function isTypedArrayEmbedding(value: any): value is TypedArrayEmbedding {
  return value instanceof Float32Array || value instanceof Float64Array;
}
function isEmbeddingType(value: any): value is EmbeddingType {
  return isEmbeddingMatrix(value) || isTypedArrayEmbedding(value);
}

function isEmbeddingMatrix(value: any): value is Atlas.EmbeddingMatrix {
  return (
    Array.isArray(value) &&
    value.every((element) => isSingleEmbedding(element))
  );
}*/
function isRecordIngest(
  value: any
): value is Record<string, string | number | Date> {
  return typeof value === "object" && value !== null;
}
function isTextIndexOptions(value: any): value is Atlas.TextIndexOptions {
  return value.indexed_field !== undefined;
}
