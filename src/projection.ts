import { Md5 } from 'ts-md5';
import { Schema, Type, tableFromIPC, tableToIPC } from 'apache-arrow';
import { BaseAtlasClass } from './general.js';
import type { AtlasUser } from './user.js';
import { AtlasProject } from './project.js';
import type { AtlasIndex } from './index.js';

type UUID = string;

type ProjectionInitializationOptions = {
  project?: AtlasProject;
  index?: AtlasIndex;
  project_id?: UUID;
  user?: AtlasUser;
};

type TagResponse = {
  tag_id: UUID;
  tag_definition_id: string;
  tag_name?: string;
  user_id?: string;
  dsl_rule?: string;
};

type TagComponent = Record<string, any>;

type TagComposition =
  | TagComponent
  | ['OR' | 'AND' | 'NOT' | 'ANY' | 'ALL', ...TagComposition[]];

type TagRequestOptions = {
  tag_name: string;
  dsl_rule: TagComposition;
  tag_id: UUID;
};

type RoboTagOptions = {
  tag_id: UUID;
};

export type UpdateTagOptions =
  | {
      tag_id: UUID;
      dsl_rule: TagComposition;
      tag_definition_id: string;
      tag_name: never;
    }
  | {
      tag_id: UUID;
      tag_name: string;
      tag_definition_id: never;
      dsl_rule: never;
    };

export type UpdateTagMaskOptions = {
  tag_id: UUID;
  tag_definition_id: string;
  complete: boolean | undefined;
};
type CreateTagOptions = {
  tag_name: string;
  dsl_rule: TagComposition;
  tag_definition_id: string;
};

type TagDefinition = {
  tag_definition_id: string;
  dsl_json: string;
};

type TagStatus = {
  is_complete: boolean;
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

  async createTag(options: CreateTagOptions): Promise<TagResponse> {
    const endpoint = '/v1/project/projection/tags/create';
    const { tag_name, dsl_rule, tag_definition_id } = options;

    if (tag_name === undefined) {
      throw new Error('tag_name is required');
    }

    if (dsl_rule === undefined) {
      throw new Error('dsl_rule is required');
    }

    const data = {
      project_id: this.project_id,
      tag_name,
      dsl_rule: JSON.stringify(dsl_rule),
      projection_id: this.id,
      tag_definition_id,
    };

    const response = (await this.apiCall(
      endpoint,
      'POST',
      data
    )) as TagResponse;
    return response;
  }

  async updateTag(options: UpdateTagOptions): Promise<TagResponse> {
    const endpoint = '/v1/project/projection/tags/update';
    const { tag_name, dsl_rule, tag_id, tag_definition_id } = options;
    if (tag_id === undefined) {
      throw new Error('tag_id is required');
    }

    const dsl_json =
      dsl_rule === undefined ? undefined : JSON.stringify(dsl_rule);

    const request = {
      tag_id,
      tag_name,
      dsl_rule: dsl_json,
      tag_definition_id,
    };

    return this.apiCall(endpoint, 'POST', request) as Promise<TagResponse>;
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
    return this.apiCall(`${endpoint}?${params}`, 'GET') as Promise<
      Array<TagResponse>
    >;
  }

  async getTagStatus(options: TagRequestOptions): Promise<TagStatus> {
    const { tag_id } = options;
    if (tag_id === undefined) {
      throw new Error('tag_id is required');
    }
    const endpoint = '/v1/project/projection/tags/status';
    const params = new URLSearchParams({
      project_id: this.project_id,
      tag_id,
    }).toString();
    return this.apiCall(`${endpoint}?${params}`, 'GET') as Promise<TagStatus>;
  }

  async updateTagMask(
    bitmask_bytes: Uint8Array,
    options: UpdateTagMaskOptions
  ): Promise<void> {
    const endpoint = '/v1/project/projection/tags/update/mask';
    const { tag_id, tag_definition_id, complete } = options;

    // Upsert tag mask with tag definition id
    let post_tag_definition_id = tag_definition_id;

    if (tag_definition_id === undefined) {
      throw new Error('tag_definition_id or dsl_rule is required');
    }

    // Deserialize the bitmask
    const bitmask = tableFromIPC(bitmask_bytes);

    bitmask.schema.metadata.set('tag_id', tag_id as string);
    bitmask.schema.metadata.set('project_id', this.project_id);
    bitmask.schema.metadata.set(
      'tag_definition_id',
      post_tag_definition_id as string
    );
    bitmask.schema.metadata.set('complete', JSON.stringify(!!complete));
    const fields = bitmask.schema.fields;
    const bitmask_column = fields.find((f) => f.name === 'bitmask');
    if (!bitmask_column || bitmask_column.type.id === Type.List) {
      throw new Error('bitmask column of type list not found');
    }

    if (bitmask_column.type.children[0].typeId !== Type.Bool) {
      throw new Error('bitmask column of type list<bool> not found');
    }

    const serialized = tableToIPC(bitmask, 'file');
    await this.apiCall(endpoint, 'POST', serialized);
  }

  async roboTag(options: RoboTagOptions): Promise<void> {
    const { tag_id } = options;
    const request = {
      tag_id,
      project_id: this.project_id,
    };
    const endpoint = '/v1/project/projection/tags/robotag';
    await this.apiCall(endpoint, 'POST', request);
  }

  _schema: Uint8Array | null = null;

  async schema(): Promise<Uint8Array> {
    // Returns a uint8 view of
    if (this._schema !== null) {
      return this._schema;
    }
    const schema = await this.apiCall(
      `/v1/project/projection/${this.id}/schema`,
      'GET'
    );
    this._schema = schema as Uint8Array;
    return this._schema;
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
