from pydantic import BaseModel
from typing import Optional


class ShapFeature(BaseModel):
    feature: str
    label: str

    value: float
    impact: float

    direction: str

    description: Optional[str] = None


class ShapGroup(BaseModel):
    category: str
    impact: float
    direction: str

    importance: float

    description: Optional[str] = None
    recommendation: Optional[str] = None


class ShapExplanation(BaseModel):
    base_value: float

    features: list[ShapFeature]
    groups: list[ShapGroup]

    summary: str


class PredictionResponse(BaseModel):
    prediction: float

    id_pays: int
    country: str
    year: int

    explanation: ShapExplanation