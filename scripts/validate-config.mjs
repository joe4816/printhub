import { readFile } from 'node:fs/promises';
import { validateRegistry } from '../shared/routing.js';

async function readJson(relativePath) {
  const url = new URL('../' + relativePath, import.meta.url);
  const raw = await readFile(url, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(relativePath + ' is not valid JSON: ' + err.message);
  }
}

const registry = await readJson('config/routes.example.json');
validateRegistry(registry);

const manifest = await readJson('manifest.webmanifest');
if (!manifest.name || !manifest.start_url || !manifest.scope) {
  throw new Error('manifest.webmanifest is missing required app fields.');
}

const windowsConfig = await readJson('agents/windows/config.example.json');
if (Number(windowsConfig.schemaVersion) !== 1) {
  throw new Error('Windows example config has unsupported schemaVersion.');
}
if (!windowsConfig.endpointId || !windowsConfig.bindings) {
  throw new Error('Windows example config is missing endpointId or bindings.');
}

const sample = await readJson('agents/windows/sample-jobs.json');
const sampleJobs = Array.isArray(sample) ? sample : sample.jobs;
if (!Array.isArray(sampleJobs) || !sampleJobs.length) {
  throw new Error('Windows sample-jobs.json must contain at least one job.');
}

for (const job of sampleJobs) {
  if (job.endpointId !== windowsConfig.endpointId) {
    throw new Error('Sample job ' + job.printJobId + ' targets a different endpoint than config.example.json.');
  }

  if (!windowsConfig.bindings[job.bindingKey]) {
    throw new Error('Sample job ' + job.printJobId + ' references unknown Windows binding ' + job.bindingKey + '.');
  }
}

console.log('PrintHub configuration validation passed.');
