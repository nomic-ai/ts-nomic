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

  function dot(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }
  const similarityMatrix = [];
  for (let i = 0; i < values.length; i++) {
    const ds = [];
    for (let j = 0; j < values.length; j++) {
      ds.push(dot(values[i], values[j]));
    }
    similarityMatrix.push(ds);
  }
  assert.is(similarityMatrix[0][1] > similarityMatrix[0][2], true);

  const olderVersion = new Embedder(process.env.ATLAS_API_KEY, {
    model: 'nomic-embed-text-v1',
    taskType: 'search_document',
  });
  const differentTerms = new Embedder(process.env.ATLAS_API_KEY, {
    model: 'nomic-embed-text-v1',
    taskType: 'search_query',
  });

  const dogs1 = await olderVersion.embed(strings[0]);
  const dogs2 = await differentTerms.embed(strings[0]);

  assert.is(dogs1.length, 768);
  assert.is(dogs2.length, 768);
  assert.is(dot(dogs1, dogs2) < 0.9, true);
  assert.is(dot(values[0], dogs1) < 0.9, true);
});

test.run();
