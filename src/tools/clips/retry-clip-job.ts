import { z } from 'zod';
import { MESSAGES, fail } from '../../api/errors.js';
import { JobId, JobStatusOutput, toJobStatus } from '../../shaping/fragments.js';
import { defineTool } from '../../server/registry.js';
import { getJob, reloadJob } from './api.js';
import { assertClipJob } from './job-kind.js';

export const retryClipJob = defineTool({
  name: 'retry_clip_job',
  toolset: 'clips',
  title: 'Retry failed clip job (free)',
  description: [
    'Re-runs a failed clip job with the same settings, free of charge, keeping the same job_id. Use it when get_clip_job shows status failed, for example after a temporary download or rendering error.',
    'It refuses jobs that are queued or processing (wait for them) and completed jobs (re-running would replace their clips; use recut_clip_job for a new variant instead). If the same source keeps failing, it probably cannot be processed: check it with check_video_source or try another link.',
    'Returns the job with status queued. Next, call get_clip_job with wait_sec=50.',
  ].join('\n\n'),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: z.object({ job_id: JobId }),
  outputSchema: z.object({
    job_id: z.string(),
    status: JobStatusOutput,
    previous_status: z.literal('failed'),
    next_step: z.string(),
  }),
  requiresApiKey: true,
  rateLimit: { bucket: 'retry', limit: 20, windowSec: 3600 },
  handler: async (args, ctx) => {
    const control = { signal: ctx.signal, deadline: ctx.deadline };
    const job = await getJob(ctx.http, args.job_id, control);
    const status = toJobStatus(job.status);
    if (status === 'completed') {
      fail(
        'job_not_retryable',
        'This job completed. Use recut_clip_job to make a new variant (paid), or get_clip_job to see its clips.',
      );
    }
    if (status !== 'failed') fail('job_already_running', MESSAGES.job_already_running);
    await assertClipJob({ http: ctx.http, id: args.job_id, control });
    const reloaded = await reloadJob(ctx.http, args.job_id);
    return {
      job_id: reloaded.id,
      status: toJobStatus(reloaded.status),
      previous_status: 'failed' as const,
      next_step: 'Call get_clip_job with job_id and wait_sec=50.',
    };
  },
});
