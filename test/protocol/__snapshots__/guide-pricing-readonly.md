# Pricing and credits

1 credit per started minute of the processed range (end_sec − start_sec), minimum 1, charged when the job is created. One job processes at most 30 minutes; split longer videos into several jobs with start_sec/end_sec. Options (captions, hooks, B-roll, music, agentic mode) do not change the price through the API.

Examples:
- 45 s → 1 credit
- 10 min → 10 credits
- 29 min 30 s → 30 credits

Free: checks, quotes, transcriptions, articles, YouTube thumbnails, retries of failed jobs, reading results.

Credits are charged when the job is created and jobs cannot be cancelled. If processing fails, credits are not returned automatically; retry_clip_job re-runs a failed job for free, or the user can contact support@mnogo-reels.ru with the job_id.
