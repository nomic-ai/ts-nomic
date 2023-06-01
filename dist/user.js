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
 * @param key The Atlas user API key to use. If undefined, will use the ATLAS_API_KEY environment variable.
 * @param env The endpoint on which to log in. Values other than 'production' are extremely rare.
 * @returns
 */
async function get_access_token(key = undefined, env = undefined) {
    const tenant = getTenant(env);
    const apiKey = key !== undefined
        ? key
        : tenant === "production"
            ? process.env.ATLAS_API_KEY
            : process.env.ATLAS_STAGING_API_KEY;
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
export function get_user() {
    if (user === undefined) {
        console.warn("CREATING USER WITHOUT PARAMETERS");
        user = new AtlasUser();
    }
    return user;
}
export class AtlasOrganization {
    constructor(id, user) {
        this.id = id;
        this.user = user || get_user();
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
    /**
     *
     * @param api_key
     *  If a string, will be used to generate a bearer token to handle requests.
     *  If undefined, will look for the ATLAS_API_KEY environment variable.
     *  If null, will proceed on with *no* API key. This can go in two directions:
     *    * if window.isLoggedIn === true, will attempt to use credentials in http requests
     *    in the browser, which is a secure way to avoid exposing secrets.
     *    * Otherwise, will attempt to make requests without credentials, which may
     *      succeed if the endpoint is public.
     * @param env The Nomic environment to use. Currently must be 'production' or 'staging'.
     */
    constructor(api_key = undefined, env = "production") {
        this._info = undefined;
        if (api_key === null) {
            this.credentials = Promise.resolve("include");
        }
        else {
            this.credentials = get_access_token(api_key, env);
        }
        this.apiEndpoint = tenants[getTenant(env)].api_domain;
    }
    async header() {
        const credentials = await this.credentials;
        if (credentials === "include") {
            return { credentials: "include" };
        }
        const token = credentials.token;
        return { Authorization: `Bearer ${token}` };
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
        const response = await this.apiCall("/v1/user", "GET");
        const info = (await response.json());
        this._info = info;
        return info;
    }
    async apiCall(endpoint, method = "GET", payload = null, headers = null) {
        // make an API call
        if (headers === null) {
            headers = await this.header();
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
        //    console.log({url, method, headers, body})
        const params = {
            method,
            headers: {
                ...headers,
            },
            body,
        };
        if (headers.credentials === "include") {
            delete headers.credentials;
            if (typeof window !== "undefined" &&
                window.localStorage.isLoggedIn === true) {
                params.credentials = "include";
            }
        }
        //    console.log({params})
        const response = await fetch(url, params);
        if (response.status < 200 || response.status > 299) {
            const body = await response.clone();
            throw new Error(`Error ${response.status}, ${JSON.stringify(response.headers)}, fetching project info: ${response.statusText}, ${body}`);
        }
        return response;
    }
}
