import pandas as pd

from app.core.load_model import LoadModel
from app.database.country import CountryModel
from app.services.explanation import ExplanationService


class Predictor:

    def make_prediction(self, db, request):

        country = (
            db.query(CountryModel)
            .filter(CountryModel.id_pays == request.id_pays)
            .first()
        )

        if country is None:
            raise ValueError("Pays introuvable")

        features = {
            "annee": request.annee,
            "pib_par_habitant": request.pib_par_habitant,
            "acces_eau": request.acces_eau,
            "mortalite_moins_5_ans": request.mortalite_moins_5_ans,
            "depense_sante_pct_pib": request.depense_sante_pct_pib,
            "prevalence_sous_alimentation": request.prevalence_sous_alimentation,
            "population_urbaine": request.population_urbaine,

            "pca_1": country.pca_1,
            "pca_2": country.pca_2,
            "pca_3": country.pca_3,
            "pca_4": country.pca_4,
            "pca_5": country.pca_5,

            "cluster": country.cluster
        }

        X = pd.DataFrame([features])

        chargeur = LoadModel()
        model = chargeur.charge_model()

        prediction = model.predict(X)[0]

        explanation_service = ExplanationService(model)

        explanation = explanation_service.explain(
            X=X,
            prediction=float(prediction)
        )

        return {
            "nom_pays": country.nom_pays,
            "prediction": round(float(prediction), 2),
            "explanation": explanation
        }