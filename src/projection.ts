import type { Table } from 'apache-arrow';
import { tableFromIPC, tableToIPC } from 'apache-arrow';
import { BaseAtlasClass } from './general.js';
import type { AtlasUser } from './user.js';
import { AtlasProject } from './project.js';
import type { AtlasIndex } from './index.js';
import { createHash } from 'node:crypto';

type UUID = string;

type ProjectionInitializationOptions = {
  project?: AtlasProject;
  index?: AtlasIndex;
  project_id?: UUID;
  user?: AtlasUser;
};

type TagResponse = {
  tag_id: UUID;
  tag_name: string;
  user_id: string;
};

type TagComponent = Record<string, any>;

type TagComposition =
  | ['OR' | 'AND' | 'NOT' | 'ANY' | 'ALL', ...TagComposition]
  | TagComponent;

type TagRequestOptions = {
  tag_name?: string;
  dsl_rule?: TagComposition;
  tag_id?: UUID;
};

export class AtlasProjection extends BaseAtlasClass {
  _project?: AtlasProject;
  project_id: UUID;
  _index?: AtlasIndex;
  private _info?: Promise<Record<string, any>>;

  constructor(
    public id: UUID,
    user?: AtlasUser,
    options: ProjectionInitializationOptions = {}
  ) {
    const { project, project_id } = options;
    super(user || project?.user);

    if (project_id === undefined && project === undefined) {
      throw new Error('project_id or project is required');
    }
    if (project_id !== undefined && project !== undefined) {
      throw new Error('project_id and project are mutually exclusive');
    }

    if (project_id !== undefined) {
      this.project_id = project_id;
    } else {
      this.project_id = project!.id;
      this._project = project;
    }
    if (options.index) {
      this._index = options.index;
    }
  }

  private _generate_tag_definition_id(dsl_rule: JSON): string {
    const json_string = JSON.stringify(dsl_rule);
    return createHash('md5').update(json_string).digest('hex');
  }

  async createTag(options: TagRequestOptions): Promise<UUID> {
    const endpoint = '/v1/project/projection/tags/create';
    const { tag_name, dsl_rule } = options;

    if (tag_name === undefined) {
      throw new Error('tag_name is required');
    }

    const data = {
      project_id: this.project_id,
      tag_name,
      dsl_rule,
      projection_id: this.id,
    };

    const response = (await this.apiCall(endpoint, 'POST', data)) as Record<
      string,
      any
    >;
    return response['tag_id'] as string;
  }

  async updateTag(options: TagRequestOptions): Promise<void> {
    const endpoint = '/v1/project/projection/tags/update';
    const { tag_name, dsl_rule, tag_id } = options;
    if (tag_id === undefined) {
      throw new Error('tag_id is required');
    }
    let tag_definition_id: undefined | string = undefined;
    if (dsl_rule !== null) {
      tag_definition_id = this._generate_tag_definition_id(
        dsl_rule as TagComposition
      );
    }

    const data = {
      project_id: this.project_id,
      tag_id,
      tag_name,
      dsl_rule,
      tag_definition_id,
    };
    await this.apiCall(endpoint, 'POST', data);
  }

  async deleteTag(options: TagRequestOptions): Promise<void> {
    const endpoint = '/v1/project/projection/tags/delete';
    const { tag_id } = options;
    if (tag_id === undefined) {
      throw new Error('tag_id is required');
    }
    const data = {
      project_id: this.project_id,
      tag_id,
    };
    await this.apiCall(endpoint, 'POST', data);
  }

  async getTags(): Promise<Array<TagResponse>> {
    const endpoint = '/v1/project/projection/tags/get/all';
    const params = new URLSearchParams({
      project_id: this.project_id,
      projection_id: this.id,
    }).toString();
    const response = await this.apiCall(`${endpoint}?${params}`, 'GET');
    return response as Array<TagResponse>;
  }

  async upsertTagMask(
    bitmask_bytes: Uint8Array,
    options: TagRequestOptions
  ): Promise<void> {
    const endpoint = '/v1/project/projection/tags/update/mask';
    const { tag_id } = options;

    // deserialize the bitmask
    const bitmask = tableFromIPC(bitmask_bytes);

    bitmask.schema.metadata.set('tag_id', tag_id as string);
    bitmask.schema.metadata.set('project_id', this.project_id);
    // Hard code upsert operation for now as it's the only one allowed
    bitmask.schema.metadata.set('operation', 'upsert');

    const serialized = tableToIPC(bitmask, 'file');
    await this.apiCall(endpoint, 'POST', serialized);
  }

  async project(): Promise<AtlasProject> {
    if (this._project === undefined) {
      this._project = new AtlasProject(this.project_id, this.user);
    }
    return this._project;
  }

  async index(): Promise<AtlasIndex> {
    if (this._index) {
      return this._index;
    }
    const indices = await this.project().then((d) => d.indices());
    for (let index of indices) {
      for (let projection of await index.projections()) {
        if (projection.id === this.id) {
          this._index = index;
          return index;
        }
      }
    }
    throw new Error('Could not find index for projection');
  }

  async atomInformation(ids: string[] | number[] | bigint[]) {
    const index = await this.index();
    return index.atomInformation(ids);
  }

  /**
   * @returns the URL for the quadtree root for this projection.
   * 'public' may be be added in fetching.
   */
  get quadtree_root(): string {
    const protocol = this.user.apiLocation.startsWith('localhost')
      ? 'http'
      : 'https';
    return `${protocol}://${this.user.apiLocation}/v1/project/${this.project_id}/index/projection/${this.id}/quadtree`;
  }

  async info() {
    if (this._info !== undefined) {
      return this._info;
    }
    this._info = this.apiCall(
      `/v1/project/${this.project_id}/index/projection/${this.id}`,
      'GET'
    ) as Promise<Record<string, any>>;
    return this._info;
  }
}
