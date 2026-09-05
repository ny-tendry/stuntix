from pydantic import BaseModel
from app.schema.shap import ShapExplanation

class PredictionRequest(BaseModel):
    id_pays : int
    annee : int
    pib_par_habitant: float
    acces_eau: float
    mortalite_moins_5_ans: float
    depense_sante_pct_pib: float
    prevalence_sous_alimentation: float
    population_urbaine: float



class PredictionResponse(BaseModel):
    nom_pays: str
    prediction: float
    explanation: ShapExplanation
    
    