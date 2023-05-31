import { AtlasProject } from "./project.js";
interface Credentials {
  refresh_token: string;
  token: string;
  tenant: string;
  expires: number;
}
export declare function get_user(): AtlasUser;
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
export declare class AtlasOrganization {
  id: UUID;
  user: AtlasUser;
  constructor(id: UUID, user?: AtlasUser);
  info(): Promise<any>;
  projects(): Promise<AtlasProject[]>;
}
export declare class AtlasUser {
  credentials: Promise<Credentials> | Promise<"include">;
  apiEndpoint: string;
  _info: UserInfo | undefined;
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
  constructor(
    api_key?: undefined | null | string,
    env?: "staging" | "production"
  );
  header(): Promise<Record<string, string>>;
  projects(): Promise<AtlasProject[]>;
  info(): Promise<UserInfo>;
  apiCall(
    endpoint: string,
    method?: "GET" | "POST",
    payload?: Atlas.Payload,
    headers?: null | Record<string, string>
  ): Promise<Response>;
}
export {};
