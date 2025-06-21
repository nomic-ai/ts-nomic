import type { paths } from '../type-gen/openapi';
import { version } from '../version';
import createClient from 'openapi-fetch';

export interface NomicOptions {
  apiDomain?: string;
}

const BASE_API_URL = 'https://api-atlas.nomic.ai';

export class APIV2Error extends Error {
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
    super(`Error ${status} (${statusText}): ${responseBody}`);
    this.status = status;
    this.statusText = statusText;
    this.headers = headers;
    this.responseBody = responseBody || null;
    Object.setPrototypeOf(this, APIV2Error.prototype);
  }
}

/**
 * User API resource for user-related operations
 */
export class UserAPI {
  private client: ReturnType<typeof createClient<paths>>;

  constructor(client: ReturnType<typeof createClient<paths>>) {
    this.client = client;
  }

  /**
   * Fetch the current user's information
   * @returns User information response
   */
  async load() {
    const { data, error } = await this.client.GET('/v1/user/', {});

    if (error) {
      throw new Error(`Failed to fetch user info: ${error}`);
    }

    return data;
  }
}

export class Nomic {
  private apiKey: string;
  private apiDomain: string;
  client: ReturnType<typeof createClient<paths>>;

  /**
   * User-related API methods
   */
  user: UserAPI;

  constructor(apiKey: string, options: NomicOptions = {}) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.apiKey = apiKey;
    this.apiDomain = options.apiDomain || BASE_API_URL;
    this.client = createClient<paths>({
      baseUrl: `${this.apiDomain}`,
    });
    this.client.use({
      // Add a middleware to add the Authorization header to all requests
      onRequest: async ({ request }) => {
        request.headers.set('Authorization', `Bearer ${apiKey}`);
        request.headers.set('User-Agent', `ts-nomic/${version}`);
      },
      // Add a middleware to handle errors
      onResponse: async ({ response }) => {
        // This is a holdover from the old apiCall method. Do we still want to do this?
        if (!response.ok) {
          const responseBody = await response.text();
          throw new APIV2Error(
            response.status,
            response.statusText,
            response.headers,
            responseBody
          );
        }
      },
    });

    // Initialize API resources
    this.user = new UserAPI(this.client);
  }
}
