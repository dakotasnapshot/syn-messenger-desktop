/* SPDX-License-Identifier: AGPL-3.0-only; native acceptance only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as asar from '@electron/asar';
const [archive, output, mode] = process.argv.slice(2);
await fs.mkdir(output, {recursive:true});
const hashes={};
for(const name of ['managed-updater.js','managed-update-manifest.js']) {
 const bytes=mode==='--source' ? await fs.readFile(path.join(archive,name)) : asar.extractFile(archive,'lib/'+name);
 await fs.writeFile(path.join(output,name),bytes);
 hashes[name]=createHash('sha256').update(bytes).digest('hex');
}
await fs.writeFile(path.join(output,mode==='--source'?'source-preflight-module-hashes.json':'packaged-module-hashes.json'),JSON.stringify(hashes,null,2));
console.log('Extracted exact packaged updater modules for native acceptance');
