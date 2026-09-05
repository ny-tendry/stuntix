from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.connection import get_db
from app.schema.predict import PredictionRequest, PredictionResponse
from app.services.predictor import Predictor


router = APIRouter()

@router.post("/predict/", status_code=201, response_model=PredictionResponse)
def predict(request: PredictionRequest, db: Session = Depends(get_db), service : Predictor = Depends()):
    return service.make_prediction(db, request)