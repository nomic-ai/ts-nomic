import { test } from 'uvu';
import { AtlasProjection } from '../dist/projection.js';
import { AtlasUser } from '../dist/user.js';

test('Neighbors', async () => {
  // get user
  console.log('getting user');
  const user = new AtlasUser({ useEnvToken: true });
  const projection = new AtlasProjection(
    '728d4f4d-91ab-4852-a4a6-6cf41da1cd5e',
    user,
    { project_id: '449402ea-1730-475c-9b41-4bbbf98b4e49' }
  );
  const vec = [];
  for (let i = 0; i <= 768; i++) {
    vec.push(Math.random());
  }
  const result = await projection.nearest_neighbors_by_vector({
    queries: [vec],
    k: 25,
  });
  console.log({ result });
});
