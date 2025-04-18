import { AtlasUser, BaseAtlasClass } from './user.js';
import { AtlasDataset } from './project.js';
import type { components } from './type-gen/openapi.js';
import { AtlasViewer } from './viewer.js';

type UUID = string;

// The response here depends on the authorization
export type OrganizationInfo =
  | components['schemas']['PublicOrganizationResponse']
  | components['schemas']['OrganizationResponse'];

type ProjectInitOptions = components['schemas']['CreateProjectRequest'];

export class AtlasOrganization extends BaseAtlasClass<OrganizationInfo> {
  id: UUID;

  constructor(id: UUID, viewer?: AtlasViewer) {
    super(viewer);
    this.id = id;
  }

  protected endpoint() {
    return `/v1/organization/${this.id}`;
  }

  async projects() {
    const info = (await this.fetchAttributes()) as OrganizationInfo;
    return info.projects;
  }

  async create_project(options: ProjectInitOptions): Promise<AtlasDataset> {
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
    const data = (await this.apiCall(`/v1/project/create`, 'POST', {
      ...options,
      organization_id: this.id,
    })) as CreateResponse;
    return new AtlasDataset(data['project_id'], this.viewer);
  }
}
