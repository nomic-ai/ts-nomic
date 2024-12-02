import type { Schema, Table } from 'apache-arrow';
import { tableToIPC, tableFromJSON, tableFromIPC } from 'apache-arrow';
import { BaseAtlasClass } from './user.js';
import { AtlasIndex } from './index.js';
import { AtlasViewer } from './viewer.js';
import * as Atlas from './global.js';
import { components } from './type-gen/openapi.js';
// get the API key from the node environment
type UUID = string;
