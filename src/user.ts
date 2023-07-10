import { AtlasOrganization, OrganizationProjectInfo } from './organization.js';
import { Table, tableFromIPC } from 'apache-arrow';

export type ApiCallOptions = {
  octetStreamAsUint8?: boolean;
};

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

/**
 *
 * @param apiKey The Atlas user API key to use.
 * @param apiLocation The URL of the API to query.
 * @returns
 */
async function get_access_token(
  apiKey: string | undefined,
  apiLocation: string = 'api-atlas.nomic.ai'
): Promise<Credentials> {
  if (apiKey === undefined) {
    throw new Error(
      'Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.'
    );
  }

  const protocol = apiLocation.startsWith('localhost') ? 'http' : 'https';

  const response = await fetch(
    `${protocol}://${apiLocation}/v1/user/token/refresh/${apiKey}`
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
  apiLocation?: never;
  apiKey?: never;
  bearerToken?: never;
};

type ApiKeyLogin = {
  useEnvToken?: never;
  apiLocation?: string;
  apiKey: string;
  bearerToken?: never;
};

type BearerTokenLogin = {
  useEnvToken?: never;
  bearerToken: string;
  apiLocation?: string;
  apiKey?: never;
};

type AnonUser = {
  useEnvToken?: never;
  bearerToken?: never;
  apiLocation?: string;
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
  public anonymous: boolean = false;
  apiLocation: string;
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
    const { useEnvToken, apiKey, bearerToken, apiLocation } = params;

    // If apiLocation is not specified, use the environment variable
    // If the environment variable is not set, use the default
    if (apiLocation) {
      this.apiLocation = apiLocation;
    } else if (process.env.ATLAS_API_DOMAIN) {
      this.apiLocation = process.env.ATLAS_API_DOMAIN;
    } else {
      this.apiLocation = 'api-atlas.nomic.ai';
    }

    if (useEnvToken) {
      // using the token in the environment
      const apiKey = process.env.ATLAS_API_KEY;
      this.credentials = get_access_token(apiKey, this.apiLocation);
    } else if (apiKey) {
      // using an api key
      this.credentials = get_access_token(apiKey, this.apiLocation);
    } else if (bearerToken) {
      // using a bearer token
      this.credentials = Promise.resolve({
        refresh_token: null,
        token: bearerToken,
        expires: Date.now() + 80000,
      });
    } else {
      // no credentials
      this.anonymous = true;
      this.credentials = Promise.resolve(null);
    }
  }
  /**
   *
   * @returns All projects that the user has access to
   */
  async projects() {
    const all_projects: OrganizationProjectInfo[] = [];
    for (const org of await this.organizations()) {
      const projects = await org.projects();
      all_projects.push(...projects);
    }
    return all_projects;
  }
  /**
   *
   * @param role return only organizations where the user has this role (default: null, return all organizations)
   * @returns A list of organizations where the user has the specified role
   */
  async organizations(role: 'OWNER' | 'MEMBER' | null = null) {
    let organizations = (await this.info()).organizations;
    if (role !== null) {
      organizations = organizations.filter((org) => org.access_role === role);
    }
    return organizations.map(
      (org) => new AtlasOrganization(org.organization_id, this)
    );
  }

  async info() {
    if (this._info !== undefined) {
      return this._info;
    }
    const info = (await this.apiCall('/v1/user/', 'GET')) as UserInfo;
    this._info = info;
    return info;
  }

  /**
   * Call the API and return the results as deserialized JSON
   * or Arrow.
   *
   * @param endpoint The nomic API endpoint to call. If it doesn't begin with a slash, it will be added.
   * @param method POST or GET
   * @param payload The binary or JSON payload sent with the request.
   * @param headers Additional headers to send with the request
   * @returns
   */

  async apiCall(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    payload: Atlas.Payload = null,
    headers: null | Record<string, string> = null,
    options: ApiCallOptions = { octetStreamAsUint8: false }
  ): Promise<Record<string, any> | string | Array<any> | Table | Uint8Array> {
    // make an API call

    if (headers === null) {
      const credentials = await this.credentials;
      if (credentials === null) {
        headers = {};
      } else {
        headers = { Authorization: `Bearer ${credentials.token}` };
      }
    }

    // Bigints are passed to the API
    // which would break JSON.stringify.
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
    const protocol = this.apiLocation.startsWith('localhost')
      ? 'http'
      : 'https';

    const url = `${protocol}://${this.apiLocation}${endpoint}`;
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
    // Deserialize the response
    let returnval;
    if (response.headers.get('Content-Type') === 'application/json') {
      const json = await response.json();
      returnval = json;
    } else if (
      response.headers.get('Content-Type') === 'application/octet-stream'
    ) {
      const buffer = await response.arrayBuffer();
      const view = new Uint8Array(buffer);
      // Test that the first five bytes are the magic number 'ARROW'
      if (view.slice(0, 5).toString() === '65,82,82,79,87') {
        // It's Arrow.
        console.log({ options });
        if (options.octetStreamAsUint8) {
          returnval = view;
        } else {
          returnval = tableFromIPC(view);
        }
      }
    } else {
      throw new Error(
        `Unknown response type: ${response.headers.get('Content-Type')}`
      );
    }
    return returnval;
  }
}
