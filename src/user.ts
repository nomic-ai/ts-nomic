import { AtlasViewer } from 'viewer.js';
import type { OrganizationProjectInfo } from './organization.js';

export const isNode =
  typeof process !== 'undefined' && process.versions && process.versions.node;

export type LoadedObject<
  T extends BaseAtlasClass<U>,
  U extends Record<string, any>
> = T & { i: U };

export abstract class BaseAtlasClass<InfoType extends Record<string, any>> {
  viewer: AtlasViewer;
  // To avoid multiple calls, the first request sets the _info property.
  protected _info: Promise<InfoType> | undefined;
  // Once info resolves, it populates here.
  protected _i: InfoType | undefined;

  constructor(viewer?: AtlasUser | AtlasViewer) {
    if (viewer === undefined) {
      this.viewer = getEnvViewer();
    } else {
      // Back-compatibility. Remove in 1.0.
      if ((viewer as AtlasUser).projects !== undefined) {
        this.viewer = (viewer as AtlasUser).viewer;
      } else {
        this.viewer = viewer as AtlasViewer;
      }
    }
  }

  // Defines which endpoint returns the info object.
  protected abstract endpoint(): string;

  /**
   * returns the object's information; this may be undefined
   */
  get i() {
    return this._i;
  }

  /**
   * Fetches basic information about the object.
   * By default, this caches the call; if you want to
   * bust the cache.
   *
   * @param bustCache Whether to refetch the relevant information
   * @returns A promise that resolves to the organization info.
   */
  info(bustCache = false): Promise<InfoType> {
    if (!bustCache && this._info !== undefined) {
      return this._info;
    }
    this._info = this.viewer.apiCall(this.endpoint(), 'GET').then((info) => {
      this._i = info as InfoType;
      return info;
    }) as Promise<InfoType>;
    return this._info;
  }

  /**
   * Loads the information associated with the class, removing any
   * existing caches.
   *
   * @returns a LoadedObject instance of the class that is guaranteed to
   *  have its `i` slot populated with appropriate information.
   */
  async load(): Promise<LoadedObject<this, InfoType>> {
    await this.info(true);
    return this as LoadedObject<this, InfoType>;
  }

  async apiCall(
    endpoint: string,
    method: 'GET' | 'POST',
    payload: Atlas.Payload = null,
    headers: null | Record<string, string> = null
  ) {
    // make an API call
    return this.viewer.apiCall(endpoint, method, payload, headers);
  }
}

let viewer: AtlasViewer | undefined = undefined;

export function getEnvViewer(): AtlasViewer {
  if (viewer === undefined) {
    console.warn('CREATING USER FROM ENV');
    viewer = new AtlasViewer({ useEnvToken: true });
  }
  return viewer;
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
  default_organization?: UUID;
  organizations: OrganizationUserInfo[];
};

type ViewMakerArgs = ConstructorParameters<typeof AtlasViewer>;

export class AtlasUser extends BaseAtlasClass<UserInfo> {
  /* 
  An AtlasUser is a registered user. The class contains 
  both information about the user and the credentials
  needed to make API calls.
  */

  // @deprecated
  constructor(...args: ViewMakerArgs) {
    // For the time being, the AtlasUser can be constructed to created a viewer inside of it.
    // As time goes on, this will be deprecated.
    const viewer = new AtlasViewer(...args);
    super(viewer);
  }

  protected endpoint() {
    return '/v1/user/';
  }

  get anonymous() {
    return this.viewer.anonymous;
  }

  get apiLocation() {
    return this.viewer.apiLocation;
  }
  /**
   *
   * @returns All projects that the user has access to.
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
    const AtlasOrganization = await import('./organization.js').then(
      (d) => d.AtlasOrganization
    );
    return organizations.map(
      (org) => new AtlasOrganization(org.organization_id, this)
    );
  }
}
