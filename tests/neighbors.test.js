import { test } from 'uvu';
import { AtlasProjection } from '../dist/projection.js';
import { AtlasUser } from '../dist/user.js';
import * as assert from 'uvu/assert';

test.skip('Neighbors', async () => {
  // get user
  const user = new AtlasUser({ useEnvToken: true });
  const projection = new AtlasProjection(
    '0efb002a-09b3-47df-b43e-71780879b501',
    user,
    { project_id: 'b7d7ff07-7272-4481-8618-c05bcf6feca5' }
  );
  const vec = [];
  for (let i = 0; i < 768; i++) {
    vec.push(Math.random());
  }
  const result = await projection.nearest_neighbors_by_vector({
    queries: [vec],
    k: 25,
  });
  assert.is(result[0].length, 25);
});
