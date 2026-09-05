from pydantic import BaseModel

class CountryResponse(BaseModel):
    id_pays : int
    iso_code : str
    nom_pays : str
    pca_1 : float
    pca_2 : float
    pca_3 : float
    pca_4 : float
    pca_5 : float
    cluster : int