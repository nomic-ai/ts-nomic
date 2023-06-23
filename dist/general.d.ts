import type { AtlasUser } from "./user";
export declare const isNode: string | false;
export declare abstract class BaseAtlasClass {
    user: AtlasUser;
    constructor(user?: AtlasUser);
    apiCall(endpoint: string, method: "GET" | "POST", payload?: Atlas.Payload, headers?: null | Record<string, string>): Promise<Response>;
}
