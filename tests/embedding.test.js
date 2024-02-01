import { test } from 'uvu';
import { embed, Embedder } from '../dist/embedding.js';
import { AtlasUser } from '../dist/user.js';
import * as assert from 'uvu/assert';

test('Embed a point from an env token', async () => {
  const strings = [
    'Dogs are pretty',
    'Dogs are beautiful',
    'All men are mortal',
  ];

  // get organization for user
  const machine = new Embedder();

  // Pulling the API key from env variable.
  const values = await embed(strings);

  assert.is(values.length, 3);

  // Taking the dot product and assert sentences 0 and 1 are closer than sentences 0 and 2

  const similarityMatrix = [];
  for (let i = 0; i < values.length; i++) {
    const ds = [];
    for (let j = 0; j < values.length; j++) {
      let d = 0;
      for (let n = 0; n < values[0].length; n++) {
        d += values[i][n] * values[j][n];
      }
      ds.push(d);
    }
    similarityMatrix.push(ds);
  }
  assert.is(similarityMatrix[0][1] > similarityMatrix[0][2], true);
});

test.run();
