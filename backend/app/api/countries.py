from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.connection import get_db
from app.database.country import CountryModel
from app.schema.country import CountryResponse

router = APIRouter(
    prefix="/countries",
    tags=["Countries"]
)

@router.get("/", response_model=list[CountryResponse])
def get_countries(db: Session = Depends(get_db)):
    countries = (
        db.query(CountryModel)
        .order_by(CountryModel.nom_pays)
        .all()
    )

    return countries