import { AtlasProject } from './project';
import { AtlasOrganization, OrganizationProjectInfo } from './organization';

const tenants = {
  staging: {
    frontend_domain: 'staging-atlas.nomic.ai',
    api_domain: 'staging-api-atlas.nomic.ai',
  },
  production: {
    frontend_domain: 'atlas.nomic.ai',
    api_domain: 'api-atlas.nomic.ai',
  },
} as const;

type TokenRefreshResponse = any;
interface Credentials {
  refresh_token: string | null;
  token: string;
  tenant: string;
  expires: number;
}

function validateApiHttpResponse(response: Response): Response {
  if (response.status >= 500 && response.status < 600) {
    throw new Error(
      'Cannot contact establish a connection with Nomic services.'
    );
  }
  return response;
}

function getTenant(env: undefined | 'staging' | 'production' = undefined) {
  if (![undefined, 'staging', 'production'].includes(env))
    throw new Error(
      'Invalid environment. Valid environments are [undefined, "staging", "production"]'
    );
  return (env ||
    process.env.ATLAS_TENANT ||
    'production') as keyof typeof tenants;
}

/**
 *
 * @param apiKey The Atlas user API key to use.
 * @param env The endpoint on which to log in. Values other than 'production' are extremely rare.
 * @returns
 */
async function get_access_token(
  apiKey: string | undefined,
  env: keyof typeof tenants
): Promise<Credentials> {
  const tenant = getTenant(env);

  if (apiKey === undefined) {
    throw new Error(
      'Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.'
    );
  }

  const environment = tenants[tenant];
  const response = await fetch(
    `https://${environment.api_domain}/v1/user/token/refresh/${apiKey}`
  );
  const validatedResponse = validateApiHttpResponse(response);

  if (validatedResponse.status !== 200) {
    throw new Error(
      'Could not authorize you with Nomic. Run `nomic login` to re-authenticate.'
    );
  }

  const access_token = (
    (await validatedResponse.json()) as TokenRefreshResponse
  ).access_token as string;

  if (access_token === undefined) {
    throw new Error(
      'Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.'
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
export function get_env_user(): AtlasUser {
  if (user === undefined) {
    console.warn('CREATING USER FROM ENV');
    // if the env variable ATLAS_TENANT is set, use that tenant
    // otherwise, use production
    user = new AtlasUser({ environment: getTenant(), useEnvToken: true });
  }
  return user;
}

type UUID = string;

type OrganizationUserInfo = {
  organization_id: UUID;
  nickname: string;
  user_id: string;
  access_role: 'OWNER' | 'MEMBER';
};

export type UserInfo = {
  sub: string;
  nickname: string;
  name: string;
  picture: string;
  updated_at: string;
  organizations: OrganizationUserInfo[];
};

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

type LoginParams = Envlogin | ApiKeyLogin | BearerTokenLogin | AnonUser;

export class AtlasUser {
  /* 
  An AtlasUser is a registered user. The class contains 
  both information about the user and the credentials
  needed to make API calls.
  */
  private credentials: Promise<Credentials | null>;
  apiEndpoint: string;
  private bearer_token: string | undefined = undefined;
  _info: UserInfo | undefined = undefined;

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
  constructor(params: LoginParams) {
    const { environment, useEnvToken, apiKey, bearerToken } = params;
    this.apiEndpoint = tenants[environment].api_domain;

    if (useEnvToken) {
      // using the token in the environment
      const apiKey =
        getTenant(environment) === 'production'
          ? process.env.ATLAS_API_KEY
          : process.env.STAGING_ATLAS_API_KEY;

      this.credentials = get_access_token(apiKey, environment);
    } else if (apiKey) {
      // using an api key
      this.credentials = get_access_token(apiKey, environment);
    } else if (bearerToken) {
      // using a bearer token
      this.credentials = Promise.resolve({
        refresh_token: null,
        token: bearerToken,
        tenant: getTenant(environment),
        expires: Date.now() + 80000,
      });
    } else {
      // no credentials
      this.credentials = Promise.resolve(null);
    }
  }

  async projects() {
    const organizations = (await this.info()).organizations;
    const all_projects: OrganizationProjectInfo[] = [];
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
    const response = await this.apiCall('/v1/user/', 'GET');
    const info = (await response.json()) as UserInfo;
    this._info = info;
    return info;
  }

  async apiCall(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    payload: Atlas.Payload = null,
    headers: null | Record<string, string> = null
  ): Promise<Response> {
    // make an API call
    if (headers === null) {
      const credentials = await this.credentials;
      if (credentials === null) {
        headers = {};
      } else {
        headers = { Authorization: `Bearer ${credentials.token}` };
      }
    }
    const replacer = (key: any, value: any) =>
      typeof value === 'bigint' ? value.toString() : value;

    let body: RequestInit['body'] = null;
    if (payload instanceof Uint8Array) {
      headers['Content-Type'] = 'application/octet-stream';
      body = payload;
    } else if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload, replacer);
    } else {
      headers['Content-Type'] = 'application/json';
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
