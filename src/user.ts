import { Command } from 'commander';
const program = new Command();
program.version('0.0.1');

import fetch, { RequestInit, Response } from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const tenants = {
  'staging': {'frontend_domain': 'staging-atlas.nomic.ai', 'api_domain': 'staging-api-atlas.nomic.ai'},
  'production': {'frontend_domain': 'atlas.nomic.ai', 'api_domain': 'api-atlas.nomic.ai'},
} as const;

function validateApiHttpResponse(response: Response): Response {
  if (response.status >= 500 && response.status < 600) {
    throw new Error('Cannot contact establish a connection with Nomic services.');
  }
  return response;
}

import { operations } from "./openapi";
import { type } from 'os';

type TokenRefreshResponse = operations["auth0_obtain_token_from_refresh_v1_user_token_refresh__refresh_token__get"]["responses"]["200"]["content"]["application/json"];

interface Credentials {
  refresh_token: string;
  token: string;
  tenant: string;
  expires: number;
}

function getTenant() {
  return (process.env.ATLAS_TENANT || 'production') as keyof typeof tenants;
}

async function get_access_token(): Promise<Credentials> {
  const tenant = getTenant()
  const apiKey = tenant === 'production' ? 
    process.env.ATLAS_API_KEY :
    process.env.ATLAS_STAGING_API_KEY;

  if (apiKey === undefined) {
    throw new Error('Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.');
  }

  const environment = tenants[tenant];
  const response = await fetch(`https://${environment.api_domain}/v1/user/token/refresh/${apiKey}`);
  const validatedResponse = validateApiHttpResponse(response);

  if (validatedResponse.status !== 200) {
    throw new Error('Could not authorize you with Nomic. Run `nomic login` to re-authenticate.');
  }

  const access_token = (await validatedResponse.json() as TokenRefreshResponse).access_token as string;

  if (access_token === undefined) {
    throw new Error('Could not authorize you with Nomic. Please see the readme for instructions on setting ATLAS_API_KEY in your path.');
  }

  const tokenInfo: Credentials = {
    refresh_token: apiKey,
    token: access_token,
    tenant: tenant,
    expires: Date.now() + 80000,
  };

  return tokenInfo;

}

let user : AtlasUser | undefined = undefined
export function get_user() : AtlasUser {
  if (user === undefined) {
    user = new AtlasUser();
  }
  return user;
}
type UUID = string;
export type OrganizationInfo = {
  organization_id: UUID,
  nickname: string,
  user_id: string,
  access_role: "OWNER" | "MEMBER",
}
export type UserInfo = {
  'sub': string,
  'nickname': string,
  'name': string,
  'picture': string,
  'updated_at': string,
  'organizations': OrganizationInfo[],
}

type Payload = Uint8Array | Record<string, number | string | boolean | string[]> | null;

export class AtlasUser {
  /* 
  An AtlasUser is a registered user. The class contains 
  both information about the user and the credentials
  needed to make API calls.
  */
  credentials: Promise<Credentials>;
  apiEndpoint: string;
  _info: UserInfo | undefined = undefined;

  constructor() {
    this.credentials = get_access_token();
    this.apiEndpoint = tenants[getTenant()].api_domain;
  }

  async header() {
    const token = (await this.credentials).token;
    return {"Authorization": `Bearer ${token}`}
  }

  async info() {
    if (this._info !== undefined) {
      return this._info;
    }
    const response = await this.apiCall('/v1/user', 'GET');
    const info = await response.json() as UserInfo;
    this._info = info;
    return info;
  }

  async apiCall(endpoint : string, method: "GET" | "POST" = "GET",
    payload: Payload = null, headers: null | Record<string, string> = null): Promise<Response> {
    // make an API call
    if (headers === null) {
      headers = await this.header()
    }
    let body : RequestInit["body"] = null;
    if (payload instanceof Uint8Array) {
      headers['Content-Type'] = 'application/octet-stream';
      body = payload;
    } else if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    } else {
      body = null;
    }


    const url =  `https://${this.apiEndpoint}${endpoint}`
    const response = await fetch(
      url,
      {
        method,
        headers: {
          ...headers,
        },
        body
      });

      if (response.status < 200 || response.status > 299) {
        const body = await response.clone()
        console.log({body})
        throw new Error(`Error ${response.status}, ${JSON.stringify(response.headers)}, fetching project info: ${response.statusText}, ${body}`)
      }
    return response;
  }  
}