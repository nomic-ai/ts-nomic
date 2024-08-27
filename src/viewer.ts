import { Table, tableFromIPC } from 'apache-arrow';
import { version } from './version.js';
import { Atlas } from 'global.js';
export class AtlasViewer {
  /* 
  An AtlasViewer represents an agent in atlas system; it manages all credentials
  needed to make API calls. All fetch requests to the Atlas API must be mediated through
  this class.
  */

  // The credentials for the user.
  private credentials: Promise<Atlas.Credentials | null>;
  // Is this the anonymous viewer who has no special credentials with the API?
  public anonymous: boolean = false;
  // The location of the endpoint being called. Usually api-atlas.nomic.ai, but may
  // differ in testing or enterprise deployments.
  apiLocation: string;

  /**`
   *
   * @param params
   *  An object that corresponds to one of the accepted login methods
   *    Envlogin: Uses the environment variable
   *      must have `useEnvToken: true`
   *    TokenLogin: Uses a bearer token or Nomic API key.
   *      must have `token: string`
   *    AnonUser: No credentials, used for anonymous Viewer
   *
   */

  constructor(params: Atlas.Envlogin);
  constructor(params: Atlas.ApiKeyLogin);
  constructor(params: Atlas.BearerTokenLogin);
  constructor(params: Atlas.AnonViewerLogin);
  constructor(params: Atlas.LoginParams) {
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
    options: Atlas.ApiCallOptions = { octetStreamAsUint8: false }
  ): Promise<
    Record<string, any> | string | Array<any> | Table | Uint8Array | null
  > {
    // make an API call

    if (headers === null) {
      const credentials = await this.credentials;
      if (credentials === null) {
        headers = {};
      } else {
        headers = { Authorization: `Bearer ${credentials.token}` };
      }
    }

    headers['User-Agent'] = `ts-nomic/${version}`;

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
      const responseBody = await response.text();
      throw new APIError(
        response.status,
        response.statusText,
        response.headers,
        responseBody
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
        if (options.octetStreamAsUint8) {
          returnval = view;
        } else {
          returnval = tableFromIPC(view);
        }
      } else {
        // It's not Arrow.
        returnval = view;
      }
    } else if (response.headers.get('Content-Type') === null) {
      // Successful deletion attempts return this.
      return null;
    } else {
      throw new Error(
        `Unknown unhandled type: ${response.headers.get('Content-Type')}`
      );
    }
    return returnval;
  }
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
): Promise<Atlas.Credentials> {
  if (apiKey === undefined) {
    throw new Error(
      'Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.'
    );
  }

  if (apiKey.startsWith('nk-')) {
    const tokenInfo: Atlas.Credentials = {
      token: apiKey,
      refresh_token: null,
      expires: Date.now() + 80000,
    };
    return tokenInfo;
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
    (await validatedResponse.json()) as Atlas.TokenRefreshResponse
  ).access_token as string;

  if (access_token === undefined) {
    throw new Error(
      'Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.'
    );
  }

  const tokenInfo: Atlas.Credentials = {
    refresh_token: apiKey,
    token: access_token,
    expires: Date.now() + 80000,
  };

  return tokenInfo;
}

function validateApiHttpResponse(response: Response): Response {
  if (response.status >= 500 && response.status < 600) {
    throw new Error(
      'Cannot contact establish a connection with Nomic services.'
    );
  }
  return response;
}

export class APIError extends Error {
  status: number;
  statusText: string;
  headers: any;
  responseBody: string | null;

  constructor(
    status: number,
    statusText: string,
    headers: any,
    responseBody?: string
  ) {
    super(`Error ${status}: ${statusText}`);
    this.status = status;
    this.statusText = statusText;
    this.headers = headers;
    this.responseBody = responseBody || null;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}
