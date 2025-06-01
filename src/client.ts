import { AtlasUser, LoadedObject } from './user.js';
import { AtlasOrganization } from './organization.js';
import { AtlasDataset } from './project.js';
import { AtlasViewer } from './viewer.js';
import { components } from 'type-gen/openapi.js';

type NomicOptions = {
  apiDomain?: string;
};

const BASE_API_URL = 'https://api-atlas.nomic.ai';

export class Atlas {
  private apiKey: string;
  private apiDomain: string;
  viewer: AtlasViewer;
  private userPromise:
    | Promise<LoadedObject<AtlasUser, NonNullable<AtlasUser['attr']>>>
    | undefined;
  // TODO: Do we need to cache the organization? We get a mini version of it on the user object.
  // private organizationPromise:
  //   | Promise<LoadedObject<AtlasOrganization, NonNullable<AtlasOrganization['attr']>>>
  //   | undefined;

  constructor(apiKey: string, options: NomicOptions = {}) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.apiKey = apiKey;
    this.apiDomain = options.apiDomain || BASE_API_URL;
    this.viewer = new AtlasViewer({
      apiKey: this.apiKey,
      apiLocation: this.apiDomain
        .replace('https://', '')
        .replace('http://', ''),
    });
  }

  /**
   * Loads the Atlas user object for the current API user asynchronously.
   * Will cache the user object for the duration of the client instance.
   * @returns The user object.
   */
  async loadUser() {
    if (this.userPromise === undefined) {
      this.userPromise = new AtlasUser(this.viewer).withLoadedAttributes();
    }
    return this.userPromise;
  }

  private async getSingularOrganizationId() {
    const user = await this.loadUser();
    const orgList = user.attr.organizations;
    if (orgList === undefined || orgList.length !== 1) {
      throw new Error('Expected exactly one organization');
    }
    return orgList[0].organization_id;
  }

  /**
   * Loads an Atlas dataset object for the given dataset ID.
   * @param datasetId - The ID of the dataset to load.
   * @returns The dataset object.
   */
  async loadDataset(datasetId: string) {
    return await new AtlasDataset(
      datasetId,
      this.viewer
    ).withLoadedAttributes();
  }

  /**
   * Loads an Atlas organization object. If no organization ID is provided,
   * the client will automatically load the organization attached to the current
   * user.
   * @param organizationId - Optional organization ID to load.
   * @returns The organization object.
   */
  async loadOrganization(organizationId?: string) {
    if (organizationId === undefined) {
      organizationId = await this.getSingularOrganizationId();
    }
    return await new AtlasOrganization(
      organizationId,
      this.viewer
    ).withLoadedAttributes();
  }

  /**
   * Creates a new Atlas dataset.
   * @param options - The options for creating the dataset.
   * @returns The created dataset object.
   */
  async createDataset(
    options: Omit<
      components['schemas']['CreateProjectRequest'],
      'organization_id'
    >
  ) {
    const organizationId = await this.getSingularOrganizationId();

    const response = (await this.viewer.apiCall(`/v1/project/create`, 'POST', {
      ...options,
      organization_id: organizationId,
    })) as components['schemas']['ProjectCreatedResponse'];

    return await new AtlasDataset(
      response.project_id,
      this.viewer
    ).withLoadedAttributes();
  }
}
