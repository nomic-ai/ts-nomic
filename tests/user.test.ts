import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { AtlasUser, AtlasOrganization } from '../src/user';

test('AtlasOrganization test', async () => {
  const user = new AtlasUser();
  const info = await user.info();
  const organization = new AtlasOrganization(info.organizations[0].organization_id, user);
  const projects = await organization.projects();
  console.log({projects})
  assert.is(projects.length > 0, true);
})

test('AtlasUser header', async () => {
  const user = new AtlasUser();
  const header = await user.header();
  assert.type(header.Authorization, 'string');
});

test('AtlasUser info', async () => {
  const user = new AtlasUser();
  const info = await user.info();
  console.log(info)
});

test.run();