from sqlalchemy import Column, Integer, String, Float
from app.core.connection import Base

class CountryModel(Base):
    __tablename__ = "dim_pays"

    id_pays = Column(Integer, primary_key=True)
    iso_code = Column(String)
    nom_pays = Column(String)

    pca_1 = Column(Float)
    pca_2 = Column(Float)
    pca_3 = Column(Float)
    pca_4 = Column(Float)
    pca_5 = Column(Float)

    cluster = Column(Integer)