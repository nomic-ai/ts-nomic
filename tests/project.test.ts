import { test } from 'uvu';
import * as arrow from 'apache-arrow';
import * as assert from 'uvu/assert';
import { AtlasProject, create_project } from '../src/project';
import { make_test_table } from './arrow.test';
// OK, we're addicted to stateful tests here.
// This manager allows named promises that tests
// can either resolve or await. This allows us to
// block some tests until others have completed
// and to share variables like ids between tests.

class ResolutionManager {
  promises: Record<string, Promise<any>> = {}
  resolutions: Record<string, (any) => void> = {}
  rejections: Record<string, () => void> = {}
  add(id: string) {
    this.promises[id] = new Promise((resolve, reject) => {
      // A place to mark the command as successful
      this.resolutions[id] = resolve;
      // A place to mark the command as failed
      this.rejections[id] = reject;
      // A timeout to mark the command as failed if they don't fail themselves.
      setTimeout(() => {
        reject("timeout")
      }, 10_000)
    })
  }
}

const manager = new ResolutionManager();

// These are the markers we use to manage dependencies.
// For each, at least one test has to call
// 'manager.resolutions[id](value?)
// and another has to call 'await manager.promises[id]',
// which gives it access to the value (which might be, say),
// a UUID for a created project.


/*
test('test_arrow', async () => {
  {
    const f = 
      new arrow.FixedSizeList(5, new arrow.Field("inner", new arrow.Float32()))
  
    const data = [
      new Float32Array([1.1, 2.2, 3.3, 4.4, 5.5]),
      new Float32Array([6.6, 7.7, 8.8, 9.9, 10.1])
    ];
  
    const arrays = data.map((float32Array) => {
      return arrow.makeVector(data);
    });
  
    const builder = arrow.makeBuilder({
      type: new arrow.FixedSizeList(3, new arrow.Field("inner", new arrow.Float16())),
      children: [{ type: new arrow.Float16() }],
      nullValues: [null, "n/a"]
    });
    return builder;
  }
})
*/

manager.add("text project created")
test('Project creation', async () => {
  const project = await create_project({
    project_name: "a typescript test text project",
    description: "a test project",
    unique_id_field: "id",
    modality: "text"
  } )
  manager.resolutions["text project created"](project.id);
})

test('Fetch project by id', async () => {
  const id = await manager.promises["text project created"]
  const project = new AtlasProject(id);
  const info = await project.info;
  assert.is(info.id, id);
  console.log({info})
});

manager.add("First upload")
test('Upload to text project', async () => {
  const id = await manager.promises["text project created"]
  const project = new AtlasProject(id);
  const tb = make_test_table({length: 32, modality: "text"});
  console.log("ID", await project.id)
  await project.uploadArrow(tb);
  manager.resolutions["First upload"](id);
})

manager.add("index created")
test('Create index', async () => {
  const id = await manager.promises["First upload"]
  const project = new AtlasProject(id);
  const index_id = await project.createIndex({
    index_name: "test index",
    indexed_field: "text",
  });
  manager.resolutions["index created"](index_id);
  manager.resolutions['text project ready to delete'](id);
})

manager.add("text project ready to delete")
test('Delete project', async () => {
  const id = await manager.promises["text project ready to delete"]
  const project = new AtlasProject(id);
  await project.delete();
});

test('test_arrow_text', () => {
  const tb = make_test_table({length: 32, modality: "text"});
})

test('test_arrow_embeddings', () => {
  const tb = make_test_table({length: 32, modality: "embedding"});
})

test.run();

