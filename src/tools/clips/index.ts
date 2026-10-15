import type { ToolsetDefinition } from '../../server/registry.js';
import { checkVideoSource } from './check-video-source.js';
import { createClipJob } from './create-clip-job.js';
import { getClipJob } from './get-clip-job.js';
import { listClipJobs } from './list-clip-jobs.js';
import { quoteClipJob } from './quote-clip-job.js';
import { recutClipJob } from './recut-clip-job.js';
import { retryClipJob } from './retry-clip-job.js';

export const clipsToolset: ToolsetDefinition = {
  name: 'clips',
  tools: [checkVideoSource, quoteClipJob, createClipJob, getClipJob, listClipJobs, recutClipJob, retryClipJob],
};
