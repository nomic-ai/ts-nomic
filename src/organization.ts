import { AtlasUser, BaseAtlasClass, get_env_user } from './user.js';
import { AtlasDataset } from './project.js';
import type { components } from 'api-raw-types.js';
type UUID = string;

export type OrganizationInfo =
  | components['schemas']['PublicOrganizationResponse']
  | components['schemas']['Organization'];

type ProjectInitOptions = {
  project_name: string;
  unique_id_field: string;
  modality: 'text' | 'embedding';
};

export class AtlasOrganization extends BaseAtlasClass<OrganizationInfo> {
  id: UUID;

  constructor(id: UUID, user?: AtlasUser) {
    super(user);
    this.id = id;
  }

  endpoint() {
    return `/v1/organization/${this.id}`;
  }

  async projects() {
    const info = (await this.fetchAttributes()) as OrganizationInfo;
    return info.projects;
  }

  async create_project(options: ProjectInitOptions): Promise<AtlasDataset> {
    const user = this.user;
    if (options.unique_id_field === undefined) {
      throw new Error('unique_id_field is required');
    }
    if (options.project_name === undefined) {
      throw new Error('Project name is required');
    }
    options['modality'] = options['modality'] || 'text';
    type CreateResponse = {
      project_id: UUID;
    };
    const data = (await user.apiCall(`/v1/project/create`, 'POST', {
      ...options,
      organization_id: this.id,
    })) as CreateResponse;
    return new AtlasDataset(data['project_id'], user);
  }
}
