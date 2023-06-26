import { test } from 'uvu';
import * as arrow from 'apache-arrow';
import * as assert from 'uvu/assert';
import { AtlasProject } from '../src/project';
import { make_test_table } from './arrow.test';
import { AtlasProjection } from '../src/projection';
import { AtlasUser } from '../src/user';
import { AtlasOrganization } from '../src/organization';

test('Full project flow', async () => {
  // get user
  const user = new AtlasUser({ environment: 'staging', useEnvToken: true });
  // get organization for user
  const organization = new AtlasOrganization(
    (await user.info()).organizations[0].organization_id,
    user
  );
  // create project in organization
  const project = await organization.create_project({
    project_name: 'a typescript test text project',
    unique_id_field: 'id',
    modality: 'text',
  });
  // fetch project from user and project id
  const project2 = new AtlasProject(project.id, user);
  assert.is(project2.id, project.id);
  // upload arrow table to project
  const tb = make_test_table({ length: 32, modality: 'text' });
  await project.uploadArrow(tb);
  // create index on project
  await project.createIndex({
    index_name: 'test index',
    indexed_field: 'text',
    colorable_fields: [],
  });
  // fetch index from project and index id
  const index = (await project.indices())[0];
  // delete project
  await project.delete();
});

test('test_arrow_text', () => {
  const tb = make_test_table({ length: 32, modality: 'text' });
});

test('test_arrow_embeddings', () => {
  const tb = make_test_table({ length: 32, modality: 'embedding' });
});

test.run();
