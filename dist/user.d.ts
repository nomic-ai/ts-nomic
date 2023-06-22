import { AtlasProject } from "./project.js";
declare const tenants: {
    readonly staging: {
        readonly frontend_domain: "staging-atlas.nomic.ai";
        readonly api_domain: "staging-api-atlas.nomic.ai";
    };
    readonly production: {
        readonly frontend_domain: "atlas.nomic.ai";
        readonly api_domain: "api-atlas.nomic.ai";
    };
};
export declare function get_user(): AtlasUser;
type UUID = string;
export type OrganizationInfo = {
    organization_id: UUID;
    nickname: string;
    user_id: string;
    access_role: "OWNER" | "MEMBER";
};
export type UserInfo = {
    sub: string;
    nickname: string;
    name: string;
    picture: string;
    updated_at: string;
    organizations: OrganizationInfo[];
};
export declare class AtlasOrganization {
    id: UUID;
    user: AtlasUser;
    constructor(id: UUID, user?: AtlasUser);
    info(): Promise<any>;
    projects(): Promise<AtlasProject[]>;
}
type Envlogin = {
    environment: keyof typeof tenants;
    useEnvToken: true;
    apiKey?: never;
    bearerToken?: never;
};
type ApiKeyLogin = {
    environment: keyof typeof tenants;
    useEnvToken?: never;
    apiKey: string;
    bearerToken?: never;
};
type BearerTokenLogin = {
    environment: keyof typeof tenants;
    useEnvToken?: never;
    bearerToken: string;
    apiKey?: never;
};
type AnonUser = {
    environment: keyof typeof tenants;
    useEnvToken?: never;
    bearerToken?: never;
    apiKey?: never;
};
export declare class AtlasUser {
    private credentials;
    apiEndpoint: string;
    private bearer_token;
    _info: UserInfo | undefined;
    /**
     *
     * @param params
     *  An object that corresponds to one of the accepted login methods
     *    Envlogin: Uses the environment variable
     *      must have `useEnvToken: true`
     *    ApiKeyLogin: Uses an api key
     *      must have `apiKey: string`
     *    BearerTokenLogin: Uses a bearer token
     *      must have `bearerToken: string`
     *    AnonUser: No credentials, used for anonymous users
     *  All login methods must have `environment: "staging" | "production"`
     *
     */
    constructor(params: Envlogin);
    constructor(params: ApiKeyLogin);
    constructor(params: BearerTokenLogin);
    constructor(params: AnonUser);
    projects(): Promise<AtlasProject[]>;
    info(): Promise<UserInfo>;
    apiCall(endpoint: string, method?: "GET" | "POST", payload?: Atlas.Payload, headers?: null | Record<string, string>): Promise<Response>;
}
export {};
