import { test } from 'uvu';
import * as arrow from 'apache-arrow';
import * as assert from 'uvu/assert';
import { AtlasProject } from '../src/project';
import { make_test_table } from './arrow.test';
import { AtlasProjection } from '../src/projection';
import { AtlasUser } from '../src/user';
import { AtlasOrganization } from '../src/organization';

// OK, we're addicted to stateful tests here.
// This manager allows named promises that tests
// can either resolve or await. This allows us to
// block some tests until others have completed
// and to share variables like ids between tests.
class ResolutionManager {
  promises: Record<string, Promise<any>> = {};
  resolutions: Record<string, (any) => void> = {};
  rejections: Record<string, () => void> = {};
  add(id: string) {
    this.promises[id] = new Promise((resolve, reject) => {
      // A place to mark the command as successful
      this.resolutions[id] = resolve;
      // A place to mark the command as failed
      this.rejections[id] = reject;
      // A timeout to mark the command as failed if they don't fail themselves.
      setTimeout(() => {
        reject('timeout');
      }, 30_000);
    });
  }
}

const manager = new ResolutionManager();

// These are the markers we use to manage dependencies.
// For each, at least one test has to call
// 'manager.resolutions[id](value?)
// and another has to call 'await manager.promises[id]',
// which gives it access to the value (which might be, say),
// a UUID for a created project. They need to be added at the top
// level.

manager.add('text project created');
test('Project creation', async () => {
  const user = new AtlasUser({ environment: 'staging', useEnvToken: true });
  const organization = new AtlasOrganization(
    (await user.info()).organizations[0].organization_id,
    user
  );
  const project = await organization.create_project({
    project_name: 'a typescript test text project',
    unique_id_field: 'id',
    modality: 'text',
  });
  manager.resolutions['text project created'](project.id);
});

test('Fetch project by id', async () => {
  const id = await manager.promises['text project created'];
  const project = new AtlasProject(id);
  const info = await project.info;
  assert.is(info.id, id);
});

manager.add('First upload');
test('Upload to text project', async () => {
  const id = await manager.promises['text project created'];
  const project = new AtlasProject(id);
  const tb = make_test_table({ length: 32, modality: 'text' });
  console.log('ID', await project.id);
  await project.uploadArrow(tb);
  manager.resolutions['First upload'](id);
});

manager.add('index created');
test('Create index', async () => {
  const id = await manager.promises['First upload'];
  const project = new AtlasProject(id);
  const index_id = await project.createIndex({
    index_name: 'test index',
    indexed_field: 'text',
    colorable_fields: [],
  });
  manager.resolutions['index created'](index_id);
});

test('Instantiate projection', async () => {
  const project_id = await manager.promises['First upload'];
  const index_id = await manager.promises['index created'];
  const project = new AtlasProject(project_id);
  await project.wait_for_lock();
  const index = (await project.indices())[0];
  const orig_projection = (await index.projections())[0];
  // Re-instantiate with just the project; test if we properly infer the index.
  const projection = new AtlasProjection(orig_projection.id, { project });
  const inferred_index = await projection.index();
  assert.is(inferred_index.id, index.id);
  manager.resolutions['text project ready to delete'](project_id);
});

manager.add('text project ready to delete');
test('Delete project', async () => {
  const id = await manager.promises['text project ready to delete'];
  const project = new AtlasProject(id);
  await project.delete();
});

test('test_arrow_text', () => {
  const tb = make_test_table({ length: 32, modality: 'text' });
});

test('test_arrow_embeddings', () => {
  const tb = make_test_table({ length: 32, modality: 'embedding' });
});

test.run();
