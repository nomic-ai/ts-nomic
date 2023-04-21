import { Command } from 'commander';
const program = new Command();
program.version('0.0.1');

import fetch, { Response } from 'node-fetch';
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
type TokenRefreshResponse = operations["auth0_obtain_token_from_refresh_v1_user_token_refresh__refresh_token__get"]["responses"]["200"]["content"]["application/json"];

interface Credentials {
  refresh_token: string;
  token: string;
  tenant: string;
  expires: number;
}

async function get_access_token(): Promise<Credentials> {
  const tenant = (process.env.ATLAS_TENANT || 'production') as keyof typeof tenants;
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
export class AtlasUser {
  credentials: Promise<Credentials>;
  
  constructor() {
    this.credentials = get_access_token();
  }

  async header() {
    const token = (await this.credentials).token;
    return {"Authorization": `Bearer ${token}"`}
  }
}