"""
mcp_server.py

MCP Server -> REST API adapter.

Run:

    python mcp_server.py

The REST API is expected to be running at:

    http://0.0.0.0:8090
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

from fastapi.middleware.cors import CORSMiddleware
import uvicorn

API_URL = os.getenv("API_URL", "http://0.0.0.0:8090")

mcp = FastMCP(
    "user-registration",
    host="0.0.0.0",
    port=8765,
)

client = httpx.AsyncClient(
    base_url=API_URL,
    timeout=10,
)


# ---------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------

class User(BaseModel):
    id: int
    name: str
    age: int


# ---------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------

@mcp.tool()
async def list_users() -> list[User]:
    """
    List all registered users.
    """

    response = await client.get("/users")
    response.raise_for_status()

    return [User(**u) for u in response.json()]


@mcp.tool()
async def get_user(
    user_id: int = Field(description="User id")
) -> User:
    """
    Retrieve a user by id.
    """

    response = await client.get(f"/users/{user_id}")

    if response.status_code == 404:
        raise ValueError("User not found.")

    response.raise_for_status()

    return User(**response.json())


@mcp.tool()
async def create_user(
    name: str = Field(description="User name"),
    age: int = Field(description="User age", ge=0),
) -> User:
    """
    Create a new user.
    """

    response = await client.post(
        "/users",
        json={
            "name": name,
            "age": age,
        },
    )

    response.raise_for_status()

    return User(**response.json())


@mcp.tool()
async def update_user(
    user_id: int,
    name: str | None = None,
    age: int | None = None,
) -> User:
    """
    Update an existing user.
    """

    payload: dict[str, Any] = {}

    if name is not None:
        payload["name"] = name

    if age is not None:
        payload["age"] = age

    response = await client.put(
        f"/users/{user_id}",
        json=payload,
    )

    if response.status_code == 404:
        raise ValueError("User not found.")

    response.raise_for_status()

    return User(**response.json())


@mcp.tool()
async def delete_user(
    user_id: int,
) -> str:
    """
    Delete a user.
    """

    response = await client.delete(f"/users/{user_id}")

    if response.status_code == 404:
        raise ValueError("User not found.")

    response.raise_for_status()

    return response.json()["message"]

# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------

app = mcp.streamable_http_app()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Mcp-Session-Id"],
)

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8765,
    )