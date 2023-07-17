import { AtlasUser, get_env_user } from './user.js';
import { AtlasProject } from './project.js';

type UUID = string;

type OrganizationInfo = {
  id: UUID;
  projects: OrganizationProjectInfo[];
};

export type OrganizationProjectInfo = {
  id: UUID;
};

type ProjectInitOptions = {
  project_name: string;
  unique_id_field: string;
  modality: 'text' | 'embedding';
};

export class AtlasOrganization {
  id: UUID;
  user: AtlasUser;
  private _info: Promise<OrganizationInfo> | undefined = undefined;

  constructor(id: UUID, user?: AtlasUser) {
    this.id = id;
    this.user = user || get_env_user();
  }

  async info() {
    if (this._info !== undefined) {
      return this._info;
    }
    this._info = (await this.user.apiCall(
      `/v1/organization/${this.id}`,
      'GET'
    )) as Promise<OrganizationInfo>;
    return this._info;
  }

  async projects() {
    const info = (await this.info()) as OrganizationInfo;
    return info.projects;
  }

  async create_project(options: ProjectInitOptions): Promise<AtlasProject> {
    const info = (await this.info()) as OrganizationInfo;
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
    return new AtlasProject(data['project_id'], user);
  }
}
