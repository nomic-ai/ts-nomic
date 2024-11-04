import { expect, test, describe } from 'vitest';

import { AtlasDataset } from '../src/project';
import { make_test_table } from './arrow';
import { AtlasProjection } from '../src/projection';
import { AtlasUser } from '../src/user';
import { AtlasViewer } from '../src/viewer';
import { AtlasOrganization } from '../src/organization';

describe('Project Flow Suite', () => {
  let viewer: AtlasViewer;
  let user: AtlasUser;
  let organization: AtlasOrganization;
  let project: AtlasDataset;
  let index: any;
  let projection: AtlasProjection;

  beforeAll(async () => {
    viewer = await new AtlasViewer({ useEnvToken: true });
    user = await new AtlasUser(viewer).withLoadedAttributes();
    const orgId = user.attr.organizations[0].organization_id;
    organization = new AtlasOrganization(orgId, viewer);
  });

  afterAll(async () => {
    if (project) await project.delete();
  });

  test('Verify organization has no attributes initially', async () => {
    expect(organization.attr).toBe(undefined);
    await organization.fetchAttributes();
    expect(organization.attr).toBeInstanceOf(Object);
  });

  test('Create project in organization', async () => {
    project = await organization.create_project({
      project_name: 'test-a typescript test text project',
      unique_id_field: 'id',
      modality: 'text',
    });

    const fetchedProject = await new AtlasDataset(
      project.id,
      viewer
    ).withLoadedAttributes();
    expect(fetchedProject.id).toBe(project.id);
  });

  test('Upload arrow table to project', async () => {
    const table = make_test_table({ length: 50, modality: 'text' });
    await project.uploadArrow(table).catch((err) => {
      console.error(err);
      throw err;
    });
  });

  test('Create index on project and verify it', async () => {
    const index = await project.createIndex({
      index_name: 'test index',
      indexed_field: 'text',
      colorable_fields: [],
    });
  });
});

test('test_arrow_text', () => {
  const tb = make_test_table({ length: 32, modality: 'text' });
});

test('test_arrow_embeddings', () => {
  const tb = make_test_table({ length: 32, modality: 'embedding' });
});
