import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { AtlasUser } from '../src/user';
import { AtlasOrganization } from '../src/organization';

// TODO - should have a dedicated test account here

test('AtlasOrganization test', async () => {
  const user = new AtlasUser({ environment: 'staging', useEnvToken: true });
  const info = await user.info();
  const organization = new AtlasOrganization(
    info.organizations[0].organization_id,
    user
  );
  assert.is(organization.id, info.organizations[0].organization_id);
});

test('AtlasUser from env variables', async () => {
  const user = new AtlasUser({ environment: 'staging', useEnvToken: true });
  const info = await user.info();
  assert.type(info, 'object');
});

test('AtlasUser from api key', async () => {
  const key = process.env.STAGING_ATLAS_API_KEY;
  if (key === undefined) {
    throw new Error('STAGING_ATLAS_API_KEY not set');
  }
  const user = new AtlasUser({ environment: 'staging', apiKey: key });
  const info = await user.info();
  assert.type(info, 'object');
});

// TODO - tests for bearer token login
// TODO - tests for anon account

test.run();
