# 0.5.1

- Improved handling of API Errors with APIError class

# 0.5.0

- Switch to more consistent constructor patter of `new AtlasProject(id, user, options)
- Switch to more consistent `info()` pattern as promise.
- Bundle `info()` as a promise to avoid multiple dispatch at once.
- Add `AtlasProject.clear()` to clear cache, and call at the end of the `waitForProjectLock` method.
- Have `AtlasProject` use `AtlasUser` for its `info()` method to allow private method.

# 0.4.4

- Allow passing tables as Uint8Arrays rather than Arrow.Table objects.

# 0.4.3

- `Project.info` calls `User.apiCall()` instead of `Project.apiCall()` to avoid infinite recursion in certain cases.

# 0.4.2

- autocorrect requests

# 0.4.1

- add boolean flag to identify unauthenticated users.

# 0.4.0

- Refactored User.apiCall to deserialize JSON and Arrow before returning (breaking change)

# 0.3.4

- Added protocol switch for localhost development
- Updated apache-arrow to 12.0.1

# 0.3.3

- Re-added env variable for setting domain

# 0.3.2

- Bump code for commit.

# 0.3.1

- Move tests from typescript to javascript
- Add '.js' suffix to all imports
- Move remote URL model from struct called 'tenants' to a single 'apiLocation'.

# 0.3.0

- Refactoring of environment setting
- Change to AtlasUser initialization

# 0.2.0

2023-06-23

- Refactor for new authorization scheme.
- Remove build artifacts from repo.
- Change 'create_project' to be method on `AtlasOrganization`.

# 0.1.1 - 0.1.6

Private releases

# 0.1.0

First release
