import { get_user } from './user'
import assert from 'assert';

describe('AtlasUser', () => {
  it('should return a header with a bearer token', async () => {
    const user = get_user()
    const header = await user.header();
    assert(header.Authorization);
  });
});
