"""
Simple User CRUD API.

This API knows nothing about MCP or LLMs.
It is just a REST service that manages users.

Run:

    uvicorn api:app --reload --port 8090
"""

from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="User Registration API",
    version="1.0.0",
)


# --------------------------------------------------------------------
# Models
# --------------------------------------------------------------------

class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=120)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    age: Optional[int] = Field(default=None, ge=0, le=120)


class User(BaseModel):
    id: int
    name: str
    age: int


# --------------------------------------------------------------------
# Fake database
# --------------------------------------------------------------------

users: list[dict] = []
next_id = 1


# --------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "users": len(users),
    }


@app.get("/users", response_model=list[User])
def list_users():
    return users


@app.get("/users/{user_id}", response_model=User)
def get_user(user_id: int):
    for user in users:
        if user["id"] == user_id:
            return user

    raise HTTPException(
        status_code=404,
        detail="User not found",
    )


@app.post("/users", response_model=User, status_code=201)
def create_user(data: UserCreate):
    global next_id

    user = {
        "id": next_id,
        "name": data.name,
        "age": data.age,
    }

    users.append(user)
    next_id += 1

    return user


@app.put("/users/{user_id}", response_model=User)
def update_user(user_id: int, data: UserUpdate):
    for user in users:

        if user["id"] != user_id:
            continue

        if data.name is not None:
            user["name"] = data.name

        if data.age is not None:
            user["age"] = data.age

        return user

    raise HTTPException(
        status_code=404,
        detail="User not found",
    )


@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    global users

    for index, user in enumerate(users):

        if user["id"] == user_id:
            users.pop(index)

            return {
                "message": "User deleted successfully"
            }

    raise HTTPException(
        status_code=404,
        detail="User not found",
    )