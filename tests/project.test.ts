import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { AtlasProject, create_project } from '../src/project';

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
manager.add("project_create")

test('Project creation', async () => {
  const project = await create_project({
    project_name: "a typescript test project",
    description: "a test project",
    unique_id_field: "id",
  } )
  manager.resolutions["project_create"](project.id);
})

test('Fetch project by id', async () => {
  const id = await manager.promises["project_create"]
  const user = new AtlasProject(id);
  const info = await user.info;
  console.log({info})
});

test.run();
