/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require("node:fs");
const path = require("node:path");

const appRoot = process.cwd();

const packageJsonUrl = path.resolve(`${appRoot}/package.json`);
const pjson = require(packageJsonUrl);

const content = `/*
 * Copyright Tapico
 */

// this is autogenerated file, see scripts/version-update.js
export const VERSION = '${pjson.version}'
export const NAME = '${pjson.name}'
`;

const fileUrl = path.join(appRoot, "src", "VERSION.ts");

if (fs.existsSync(fileUrl)) {
  fs.writeFileSync(fileUrl, content);
} else {
  console.warn(`WARN: Failed to find src/VERSION.ts`);
}