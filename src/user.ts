import { AtlasProject } from "./project.js";

const tenants = {
  staging: {
    frontend_domain: "staging-atlas.nomic.ai",
    api_domain: "staging-api-atlas.nomic.ai",
  },
  production: {
    frontend_domain: "atlas.nomic.ai",
    api_domain: "api-atlas.nomic.ai",
  },
} as const;

function validateApiHttpResponse(response: Response): Response {
  if (response.status >= 500 && response.status < 600) {
    throw new Error(
      "Cannot contact establish a connection with Nomic services."
    );
  }
  return response;
}

type TokenRefreshResponse = any;
interface Credentials {
  refresh_token: string | null;
  token: string;
  tenant: string;
  expires: number;
}

function getTenant(env: undefined | "staging" | "production" = undefined) {
  if (![undefined, "staging", "production"].includes(env))
    throw new Error(
      'Invalid environment. Valid environments are [undefined, "staging", "production"]'
    );
  return (env ||
    process.env.ATLAS_TENANT ||
    "production") as keyof typeof tenants;
}

/**
 *
 * @param key The Atlas user API key to use. If undefined, will use the ATLAS_API_KEY environment variable.
 * @param env The endpoint on which to log in. Values other than 'production' are extremely rare.
 * @returns
 */
async function get_access_token(
  key: string | undefined = undefined,
  env: "staging" | "production" | undefined = undefined
): Promise<Credentials> {
  const tenant = getTenant(env);
  const apiKey =
    key !== undefined
      ? key
      : tenant === "production"
      ? process.env.ATLAS_API_KEY
      : process.env.ATLAS_STAGING_API_KEY;

  if (apiKey === undefined) {
    throw new Error(
      "Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path."
    );
  }

  const environment = tenants[tenant];
  const response = await fetch(
    `https://${environment.api_domain}/v1/user/token/refresh/${apiKey}`
  );
  const validatedResponse = validateApiHttpResponse(response);

  if (validatedResponse.status !== 200) {
    throw new Error(
      "Could not authorize you with Nomic. Run `nomic login` to re-authenticate."
    );
  }

  const access_token = (
    (await validatedResponse.json()) as TokenRefreshResponse
  ).access_token as string;

  if (access_token === undefined) {
    throw new Error(
      "Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path."
    );
  }

  const tokenInfo: Credentials = {
    refresh_token: apiKey,
    token: access_token,
    tenant: tenant,
    expires: Date.now() + 80000,
  };

  return tokenInfo;
}

let user: AtlasUser | undefined = undefined;
export function get_user(): AtlasUser {
  if (user === undefined) {
    console.warn("CREATING USER WITHOUT PARAMETERS");
    user = new AtlasUser();
  }
  return user;
}

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

type OrganizationInfoFull = {
  id: UUID;
  projects: AtlasProject[];
};

export class AtlasOrganization {
  id: UUID;
  user: AtlasUser;
  constructor(id: UUID, user?: AtlasUser) {    
    this.id = id;
    this.user = user || get_user();
  }
  async info() {
    const response = await this.user.apiCall(
      `/v1/organization/${this.id}`,
      "GET"
    );
    return response.json();
  }

  async projects() {
    const info = (await this.info()) as OrganizationInfoFull;
    return info.projects;
  }
}

type AtlasUserOptions = {
  api_key?: string;
  bearer_token?: string;
  env?: "staging" | "production";
}

export class AtlasUser {
  /* 
  An AtlasUser is a registered user. The class contains 
  both information about the user and the credentials
  needed to make API calls.
  */
  private credentials: Promise<Credentials> | Promise<"include">;
  apiEndpoint: string;
  private bearer_token: string | undefined = undefined;
  _info: UserInfo | undefined = undefined;

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
   * @param bearer_token
   *  If a string, will be used to handle requests.
   * @param env The Nomic environment to use. Currently must be 'production' or 'staging'.
   */

  constructor(
    options: AtlasUserOptions = {
      api_key: undefined,
      bearer_token: undefined,
      env: "production",
    }
  ) {
    const { api_key, bearer_token, env } = options;
    if (api_key) {
      // if the api key is provided, we need to get a bearer token
      this.credentials = get_access_token(api_key, env);
    } else if (bearer_token) {
      this.credentials = Promise.resolve({
        refresh_token: null,
        token: bearer_token,
        tenant: getTenant(env),
        expires: Date.now() + 80000,
      });
    } else if (api_key === undefined) { 
      // if the api key is not provided, we'll use the environment variable
      this.credentials = get_access_token(api_key, env);
    } else {
      // if the api key is null, we can use the browser's credentials
      this.credentials = Promise.resolve("include" as const);
    }
    this.apiEndpoint = tenants[getTenant(env)].api_domain;
  }

  async header(): Promise<Record<string, string>> {
    const credentials = await this.credentials;
    if (credentials === "include") {
      return { };
    }
    const token = credentials.token;
    return { Authorization: `Bearer ${token}` };
  }

  async projects() {
    const organizations = (await this.info()).organizations;
    const all_projects: AtlasProject[] = [];
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
    const info = (await response.json()) as UserInfo;
    this._info = info;
    return info;
  }

  async apiCall(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    payload: Atlas.Payload = null,
    headers: null | Record<string, string> = null
  ): Promise<Response> {
    // make an API call
    if (headers === null) {
      headers = await this.header();
    }
    const replacer = (key: any, value: any) =>
      typeof value === "bigint" ? value.toString() : value;

    let body: RequestInit["body"] = null;
    if (payload instanceof Uint8Array) {
      headers["Content-Type"] = "application/octet-stream";
      body = payload;
    } else if (payload !== null) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(payload, replacer);
    } else {
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
    } as RequestInit;
    if ((await this.credentials) === "include") {
      delete headers.credentials;
      console.log("INCLUDING")
      if (
        typeof window !== "undefined" &&
        window.localStorage.isLoggedIn === "true"
      ) {
        console.log("SETTING CREDENTIALS")
        params.credentials = "include";
      }
    }
    console.log("FETCHING", url, params)
    const response = await fetch(url, params);

    if (response.status < 200 || response.status > 299) {
      const body = await response.clone();
      throw new Error(
        `Error ${response.status}, ${JSON.stringify(
          response.headers
        )}, fetching project info: ${response.statusText}, ${body}`
      );
    }
    return response;
  }
}
