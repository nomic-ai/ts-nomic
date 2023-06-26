import { AtlasProject } from './project';
import { AtlasOrganization, OrganizationProjectInfo } from './organization';

type Tenant = {
  'frontend_domain': string,
  'api_domain': string,
}

const ATLAS_PROD: Tenant = {
  frontend_domain: 'atlas.nomic.ai',
  api_domain: 'api-atlas.nomic.ai',
}

type TokenRefreshResponse = any;
interface Credentials {
  refresh_token: string | null;
  token: string;
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

function getTenantDomains(): Tenant {
  const env_frontend_domain = process.env.ATLAS_FRONTEND_DOMAIN;
  const env_api_domain = process.env.ATLAS_API_DOMAIN;
  if (env_frontend_domain !== undefined && env_api_domain !== undefined) {
    return {
      'frontend_domain': env_frontend_domain,
      'api_domain': env_api_domain,
    };
  }
  if (env_frontend_domain !== undefined || env_api_domain !== undefined) {
    throw new Error(
      'env variables ATLAS_FRONTEND_DOMAIN and ATLAS_API_DOMAIN must both be set, or neither.'
    );
  }
  return ATLAS_PROD;
}

/**
 *
 * @param apiKey The Atlas user API key to use.
 * @param tenant The tenant object to use. Contains the frontend and API domains.
 * @returns
 */
async function get_access_token(
  apiKey: string | undefined,
  tenant: Tenant,
): Promise<Credentials> {

  if (apiKey === undefined) {
    throw new Error(
      'Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.'
    );
  }

  const response = await fetch(
    `https://${tenant.api_domain}/v1/user/token/refresh/${apiKey}`
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
    expires: Date.now() + 80000,
  };

  return tokenInfo;
}

let user: AtlasUser | undefined = undefined;
export function get_env_user(): AtlasUser {
  if (user === undefined) {
    console.warn('CREATING USER FROM ENV');
    user = new AtlasUser({ useEnvToken: true });
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
  useEnvToken: true;
  apiKey?: never;
  bearerToken?: never;
};

type ApiKeyLogin = {
  useEnvToken?: never;
  apiKey: string;
  bearerToken?: never;
};

type BearerTokenLogin = {
  useEnvToken?: never;
  bearerToken: string;
  apiKey?: never;
};

type AnonUser = {
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
  tenant: Tenant = getTenantDomains();
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
   *
   */

  constructor(params: Envlogin);
  constructor(params: ApiKeyLogin);
  constructor(params: BearerTokenLogin);
  constructor(params: AnonUser);
  constructor(params: LoginParams) {
    const { useEnvToken, apiKey, bearerToken } = params;
    

    if (useEnvToken) {
      // using the token in the environment
      const apiKey = process.env.ATLAS_API_KEY;
      this.credentials = get_access_token(apiKey, this.tenant);
    } else if (apiKey) {
      // using an api key
      this.credentials = get_access_token(apiKey, this.tenant);
    } else if (bearerToken) {
      // using a bearer token
      this.credentials = Promise.resolve({
        refresh_token: null,
        token: bearerToken,
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

    const url = `https://${this.tenant.api_domain}${endpoint}`;
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
