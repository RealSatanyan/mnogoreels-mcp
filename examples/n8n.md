# MnogoReels in n8n

Connect an n8n AI Agent to the hosted MnogoReels MCP server.

1. Create an API key at https://mnogo-reels.ru/dashboard/developers?tab=keys (it starts with `mrfrt_usr_`). Use a dedicated key for n8n.
2. In your workflow, open the **AI Agent** node and add a tool: **MCP Client Tool**.
3. Configure the node:
   - **Server Transport:** HTTP Streamable
   - **Endpoint:** `https://mcp.mnogo-reels.ru/mcp` (or `https://mcp.mnogo-reels.ru/mcp/readonly` for an agent that must never spend credits)
   - **Authentication:** Header Auth. Create a credential with **Name** `Authorization` and **Value** `Bearer mrfrt_usr_YOUR_KEY`.
   - **Tools to Include:** All, or select the tools the agent needs.
4. Test with a chat message such as "Call get_account": the result must contain `"authenticated": true`.

Tips:

- Clip jobs run in the background. Let the agent call `get_clip_job` with `wait_sec=50` repeatedly, or schedule a follow-up workflow that checks the job later.
- Only `create_clip_job` and `recut_clip_job` spend credits. They require `max_credits`; instruct the agent to call `quote_clip_job` first.
- On n8n cloud, keyless calls share the anonymous video-check budget of the n8n egress IP; always configure the key.
