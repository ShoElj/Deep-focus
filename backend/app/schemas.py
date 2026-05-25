from typing import Literal

from pydantic import BaseModel, Field


class ClassifyRequest(BaseModel):
    url: str = ""
    title: str = ""
    metaDescription: str = ""
    headings: list[str] = Field(default_factory=list)
    textSample: str = ""
    youtubeTitle: str = ""
    channelName: str = ""
    source: str = "web"
    allowedCategories: list[str] = Field(default_factory=list)
    blockedCategories: list[str] = Field(default_factory=list)


class ClassifyResponse(BaseModel):
    decision: Literal["allow", "block"]
    topLabel: str
    score: float
    reason: str

