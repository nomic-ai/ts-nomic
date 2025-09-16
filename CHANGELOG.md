# Changelog

## [0.13.0](https://github.com/nomic-ai/ts-nomic/compare/v0.12.0...v0.13.0) (2025-09-16)


### Features

* use multipart upload ([#113](https://github.com/nomic-ai/ts-nomic/issues/113)) ([a6ea345](https://github.com/nomic-ai/ts-nomic/commit/a6ea3455bbaee4c1e110e5b18503f629ddfabca7))


### Bug Fixes

* make withLoadedAttributes not bust cache by default ([#95](https://github.com/nomic-ai/ts-nomic/issues/95)) ([0722b18](https://github.com/nomic-ai/ts-nomic/commit/0722b18282fc5920c1732beeaf277a1b44f7eafd))

## [0.12.0](https://github.com/nomic-ai/ts-nomic/compare/v0.11.0...v0.12.0) (2024-11-04)


### Features

* allow project_id to be optional in projection class ([#78](https://github.com/nomic-ai/ts-nomic/issues/78)) ([e82b9da](https://github.com/nomic-ai/ts-nomic/commit/e82b9dacfdb93857cccc134ebcfcad3ba0db428c))


### Bug Fixes

* handle backoff and bundle requests for API timing ([#81](https://github.com/nomic-ai/ts-nomic/issues/81)) ([d5893f3](https://github.com/nomic-ai/ts-nomic/commit/d5893f3f9c14206c64b6de944e6859282fff2bd3))
* relative imports in ts files ([#76](https://github.com/nomic-ai/ts-nomic/issues/76)) ([7c11a54](https://github.com/nomic-ai/ts-nomic/commit/7c11a54c4c4fa23f35916fccaa9ef1835aaa49f1))

## [0.11.0](https://github.com/nomic-ai/ts-nomic/compare/v0.10.1...v0.11.0) (2024-09-09)


### Features

* add 'Viewer' class disentangled from 'User' ([#48](https://github.com/nomic-ai/ts-nomic/issues/48)) ([b55eff3](https://github.com/nomic-ai/ts-nomic/commit/b55eff387dbbc31ef464cdf1f3cab98b5647a8fc))


### Bug Fixes

* user constructor from viewer ([#69](https://github.com/nomic-ai/ts-nomic/issues/69)) ([a87d4fe](https://github.com/nomic-ai/ts-nomic/commit/a87d4fe4c73c114ded4e896276891cf5c3fb4961))

## [0.10.1](https://github.com/nomic-ai/ts-nomic/compare/v0.10.0...v0.10.1) (2024-07-24)

_Introduced Release-Please for Release Management_

### Bug Fixes

- openapi script and file ([#54](https://github.com/nomic-ai/ts-nomic/issues/54)) ([65631bf](https://github.com/nomic-ai/ts-nomic/commit/65631bfc6649fda0b0fd9641fa1437359e199b46))

## 0.10.0

- Add `fetchAttr`, `withLoadedAttr`, and `attr` methods to `BaseAtlasClass` to allow for a single reliable
  way to await attributes with cache-busting.
- Add support for nearest-neighbor search by vector.

## 0.9.6

- Rename "AtlasProject" to "AtlasDataset" with backwards compatible alias.

## 0.9.5

- Fixed issue with duplicate detection parameters

## 0.9.4

- Deprecated 'update_indices' method

## 0.9.3

- Change default projection hyperparameters.

## 0.9.2

- Support for different embedding tasks
- Support for nomic-embed-text-v1.5

## 0.9.1

- Minor patch

## 0.9.0

- Full support of embedding endpoints with API keys.

## 0.8.0

- Support new Nomic API keys for requests.
- Improved support of tagging.

## 0.7.0

- Methods for creating, updating, deleting tags and tag masks
- Tests for tagging methods
- Adding default organization to user info so tests get run in tester's organization

## 0.6.2

- Improve typing of index creation function

## 0.6.1

- Export APIError for external usage
- uploadArrow now accepts a serialized arrow IPC file in addition to an arrow table
- Fix URL for projection information

## 0.6.0

- Remove all use of `/public` endpoints.

## 0.5.1

- Improved handling of API Errors with APIError class

## 0.5.0

- Switch to more consistent constructor patter of `new AtlasProject(id, user, options)
- Switch to more consistent `info()` pattern as promise.
- Bundle `info()` as a promise to avoid multiple dispatch at once.
- Add `AtlasProject.clear()` to clear cache, and call at the end of the `waitForProjectLock` method.
- Have `AtlasProject` use `AtlasUser` for its `info()` method to allow private method.

## 0.4.4

- Allow passing tables as Uint8Arrays rather than Arrow.Table objects.

## 0.4.3

- `Project.info` calls `User.apiCall()` instead of `Project.apiCall()` to avoid infinite recursion in certain cases.

## 0.4.2

- autocorrect requests

## 0.4.1

- add boolean flag to identify unauthenticated users.

## 0.4.0

- Refactored User.apiCall to deserialize JSON and Arrow before returning (breaking change)

## 0.3.4

- Added protocol switch for localhost development
- Updated apache-arrow to 12.0.1

## 0.3.3

- Re-added env variable for setting domain

## 0.3.2

- Bump code for commit.

## 0.3.1

- Move tests from typescript to javascript
- Add '.js' suffix to all imports
- Move remote URL model from struct called 'tenants' to a single 'apiLocation'.

## 0.3.0

- Refactoring of environment setting
- Change to AtlasUser initialization

## 0.2.0

2023-06-23

- Refactor for new authorization scheme.
- Remove build artifacts from repo.
- Change 'create_project' to be method on `AtlasOrganization`.

## 0.1.1 - 0.1.6

Private releases

## 0.1.0

First release

> > > > > > > main
