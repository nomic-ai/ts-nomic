const tenants = {
    staging: {
        frontend_domain: "staging-atlas.nomic.ai",
        api_domain: "staging-api-atlas.nomic.ai",
    },
    production: {
        frontend_domain: "atlas.nomic.ai",
        api_domain: "api-atlas.nomic.ai",
    },
};
function validateApiHttpResponse(response) {
    if (response.status >= 500 && response.status < 600) {
        throw new Error("Cannot contact establish a connection with Nomic services.");
    }
    return response;
}
function getTenant(env = undefined) {
    if (![undefined, "staging", "production"].includes(env))
        throw new Error('Invalid environment. Valid environments are [undefined, "staging", "production"]');
    return (env ||
        process.env.ATLAS_TENANT ||
        "production");
}
/**
 *
 * @param apiKey The Atlas user API key to use.
 * @param env The endpoint on which to log in. Values other than 'production' are extremely rare.
 * @returns
 */
async function get_access_token(apiKey, env) {
    const tenant = getTenant(env);
    if (apiKey === undefined) {
        throw new Error("Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.");
    }
    const environment = tenants[tenant];
    const response = await fetch(`https://${environment.api_domain}/v1/user/token/refresh/${apiKey}`);
    const validatedResponse = validateApiHttpResponse(response);
    if (validatedResponse.status !== 200) {
        throw new Error("Could not authorize you with Nomic. Run `nomic login` to re-authenticate.");
    }
    const access_token = (await validatedResponse.json()).access_token;
    if (access_token === undefined) {
        throw new Error("Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.");
    }
    const tokenInfo = {
        refresh_token: apiKey,
        token: access_token,
        tenant: tenant,
        expires: Date.now() + 80000,
    };
    return tokenInfo;
}
let user = undefined;
export function get_env_user() {
    if (user === undefined) {
        console.warn("CREATING USER FROM ENV");
        user = new AtlasUser({ environment: "production", useEnvToken: true });
    }
    return user;
}
export class AtlasOrganization {
    constructor(id, user) {
        this.id = id;
        this.user = user || get_env_user();
    }
    async info() {
        const response = await this.user.apiCall(`/v1/organization/${this.id}`, "GET");
        return response.json();
    }
    async projects() {
        const info = (await this.info());
        return info.projects;
    }
}
export class AtlasUser {
    constructor(params) {
        this.bearer_token = undefined;
        this._info = undefined;
        const { environment, useEnvToken, apiKey, bearerToken } = params;
        this.apiEndpoint = tenants[environment].api_domain;
        if (useEnvToken) {
            // using the token in the environment
            const apiKey = getTenant(environment) === "production"
                ? process.env.ATLAS_API_KEY
                : process.env.ATLAS_STAGING_API_KEY;
            this.credentials = get_access_token(apiKey, environment);
        }
        else if (apiKey) {
            // using an api key
            this.credentials = get_access_token(apiKey, environment);
        }
        else if (bearerToken) {
            // using a bearer token
            this.credentials = Promise.resolve({
                refresh_token: null,
                token: bearerToken,
                tenant: getTenant(environment),
                expires: Date.now() + 80000,
            });
        }
        else {
            // no credentials
            this.credentials = Promise.resolve(null);
        }
    }
    async projects() {
        const organizations = (await this.info()).organizations;
        const all_projects = [];
        for (const org of organizations) {
            const orgInfo = new AtlasOrganization(org.organization_id, this);
            const projects = await orgInfo.projects();
            all_projects.push(...projects);
        }
        return all_projects;
    }
    async info() {
        if (this._info !== undefined) {
            return this._info;
        }
        const response = await this.apiCall("/v1/user/", "GET");
        const info = (await response.json());
        this._info = info;
        return info;
    }
    async apiCall(endpoint, method = "GET", payload = null, headers = null) {
        // make an API call
        if (headers === null) {
            const credentials = await this.credentials;
            if (credentials === null) {
                headers = {};
            }
            else {
                headers = { Authorization: `Bearer ${credentials.token}` };
            }
        }
        const replacer = (key, value) => typeof value === "bigint" ? value.toString() : value;
        let body = null;
        if (payload instanceof Uint8Array) {
            headers["Content-Type"] = "application/octet-stream";
            body = payload;
        }
        else if (payload !== null) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(payload, replacer);
        }
        else {
            headers["Content-Type"] = "application/json";
            body = null;
        }
        const url = `https://${this.apiEndpoint}${endpoint}`;
        const params = {
            method,
            headers: {
                ...headers,
            },
            body,
        };
        const response = await fetch(url, params);
        if (response.status < 200 || response.status > 299) {
            const body = await response.clone();
            throw new Error(`Error ${response.status}, ${JSON.stringify(response.headers)}, fetching project info: ${response.statusText}, ${body}`);
        }
        return response;
    }
}
