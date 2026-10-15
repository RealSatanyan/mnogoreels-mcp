import asyncio
import os

from langchain_mcp_adapters.client import MultiServerMCPClient


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "mnogoreels": {
                "transport": "streamable_http",
                "url": "https://mcp.mnogo-reels.ru/mcp",
                "headers": {"Authorization": "Bearer " + os.environ["MNOGOREELS_API_KEY"]},
            }
        }
    )
    tools = await client.get_tools()
    print(sorted(tool.name for tool in tools))
    account = next(tool for tool in tools if tool.name == "get_account")
    print(await account.ainvoke({}))


if __name__ == "__main__":
    asyncio.run(main())
