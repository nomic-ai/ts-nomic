import {get_user} from './user';
import fetch, { Response } from 'node-fetch';

export abstract class BaseAtlasClass {
  user: AtlasUser;
  constructor(user?: AtlasUser) {
    if (user === undefined) {
      this.user = get_user();
    } else {
      this.user = user;
    }
  }

  async apiCall(endpoint : string, method: "GET" | "POST",
    headers: null | Record<string, string> = null, options: FetchOptions = null): Promise<Response> {
    // make an API call
    return this.user.apiCall(endpoint, method, headers, options)
  }
}