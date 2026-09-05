import shap

from typing import Any

#configuration

# tolérence
EPSILON = 1e-6

FEATURE_LABELS = {
    "annee": "Année",

    "pib_par_habitant":
        "PIB par habitant",

    "acces_eau":
        "Accès à l'eau",

    "mortalite_moins_5_ans":
        "Mortalité des moins de 5 ans",

    "depense_sante_pct_pib":
        "Dépenses de santé",

    "prevalence_sous_alimentation":
        "Prévalence de la sous-alimentation",

    "population_urbaine":
        "Population urbaine",

    #on utlise ces variables mais on les affcihe pas
    "pca_1": "Historique du pays",
    "pca_2": "Historique du pays",
    "pca_3": "Historique du pays",
    "pca_4": "Historique du pays",
    "pca_5": "Historique du pays",

    "cluster": "Profil du pays"
}


#définition des varibles à ne pas a
HIDDEN_FEATURES = {
    "pca_1",
    "pca_2",
    "pca_3",
    "pca_4",
    "pca_5"
}

#regroupement des variables à afficher
FEATURE_GROUPS = {

    "Historique du pays": [
        "pca_1",
        "pca_2",
        "pca_3",
        "pca_4",
        "pca_5"
    ],

    "Conditions économiques": [
        "pib_par_habitant"
    ],

    "Conditions sanitaires": [
        "acces_eau",
        "mortalite_moins_5_ans",
        "depense_sante_pct_pib"
    ],

    "Conditions nutritionnelles": [
        "prevalence_sous_alimentation"
    ],

    "Urbanisation": [
        "population_urbaine"
    ],

    "Temps": [
        "annee"
    ],

    "Profil du pays": [
        "cluster"
    ]
}



#mapping variable to gorupe
FEATURE_TO_GROUP = {
    feature: group
    for group, features in FEATURE_GROUPS.items()
    for feature in features
}

#recommandation
RECOMMENDATIONS = {

    "Conditions sanitaires":
        "Renforcer l'accès aux soins, améliorer l'accès à l'eau "
        "et consolider les services de santé maternelle et infantile.",

    "Conditions nutritionnelles":
        "Renforcer les programmes de sécurité alimentaire, "
        "de prévention de la sous-alimentation et de nutrition infantile.",

    "Conditions économiques":
        "Soutenir les politiques favorisant l'amélioration durable "
        "des conditions de vie et de la résilience économique des ménages.",

    "Urbanisation":
        "Améliorer l'accès aux infrastructures, à l'eau, "
        "à l'assainissement et aux services essentiels.",

    "Historique du pays":
        "Le contexte historique et structurel du pays contribue "
        "à cette estimation. Son évolution nécessite généralement "
        "des améliorations durables sur plusieurs années."
}


#impact et sens de la contribution shap
def get_direction(impact: float) -> str:

    if impact > EPSILON:
        return "augmente"

    if impact < -EPSILON:
        return "diminue"

    return "neutre"


#description 
def generate_feature_description(
    label: str,
    impact: float
) -> str:

    direction = get_direction(impact)

    if direction == "augmente":
        return (
            f"{label} contribue à augmenter "
            "l'estimation produite par le modèle."
        )

    if direction == "diminue":
        return (
            f"{label} contribue à diminuer "
            "l'estimation produite par le modèle."
        )

    return (
        f"{label} a une influence très faible "
        "sur cette estimation."
    )

def generate_group_description(
    category: str,
    impact: float
) -> str:

    direction = get_direction(impact)

    if direction == "augmente":
        return (
            f"{category} contribue globalement à augmenter "
            "l'estimation du modèle."
        )

    if direction == "diminue":
        return (
            f"{category} contribue globalement à diminuer "
            "l'estimation du modèle."
        )

    return (
        f"{category} a une influence globale faible "
        "sur cette estimation."
    )


#resumé de la prédiction
def generate_summary(
    prediction: float,
    grouped: list[dict]
) -> str:

    positives = [
        group
        for group in grouped
        if group["impact"] > EPSILON
    ]

    negatives = [
        group
        for group in grouped
        if group["impact"] < -EPSILON
    ]

    #classement par importance
    positives.sort(
        key=lambda group: group["importance"],
        reverse=True
    )

    negatives.sort(
        key=lambda group: group["importance"],
        reverse=True
    )

    text = (
        f"Le modèle estime un taux de stunting "
        f"de {prediction:.2f} %. "
    )

    if positives:

        categories = [
            group["category"]
            for group in positives[:3]
        ]

        text += (
            "Les principaux groupes de facteurs qui "
            "contribuent à augmenter cette estimation sont : "
            + ", ".join(categories)
            + ". "
        )

    if negatives:

        categories = [
            group["category"]
            for group in negatives[:2]
        ]

        text += (
            "Les principaux groupes de facteurs qui "
            "contribuent à diminuer cette estimation sont : "
            + ", ".join(categories)
            + ". "
        )

    if not positives and not negatives:

        text += (
            "Aucun groupe de facteurs ne présente "
            "une contribution dominante à cette estimation."
        )

    return text.strip()


class ExplanationService:

    def __init__(self, model: Any):
        self.model = model

        self.explainer = shap.TreeExplainer(
            self.model
        )

    #explicabilité
    def explain(
        self,
        X,
        prediction: float
    ) -> dict:

        #calcul shap
        shap_result = self.explainer(X)

        #values pour une observation
        shap_values = shap_result.values[0]

        base_value = shap_result.base_values[0]

        #convsrion en flost
        if hasattr(base_value, "item"):

            try:
                base_value = base_value.item()

            except (ValueError, TypeError):
                base_value = base_value[0]

        base_value = float(base_value)

        #construction de la contribution des variables
        all_features = []

        for index, feature_name in enumerate(X.columns):

            value = float(
                X.iloc[0, index]
            )

            impact = float(
                shap_values[index]
            )

            direction = get_direction(
                impact
            )

            label = FEATURE_LABELS.get(
                feature_name,
                feature_name
            )

            description = generate_feature_description(
                label,
                impact
            )

            all_features.append({
                "feature": feature_name,
                "label": label,
                "value": value,
                "impact": impact,
                "importance": abs(impact),
                "direction": direction,
                "description": description
            })


        #tri par importance
        all_features.sort(
            key=lambda feature: feature["importance"],
            reverse=True
        )


        #regroupement
        group_data = {
            group: {
                "impact": 0.0,
                "importance": 0.0
            }
            for group in FEATURE_GROUPS
        }

        for feature in all_features:

            feature_name = feature["feature"]

            group = FEATURE_TO_GROUP.get(
                feature_name
            )

            if group is None:
                continue

            #indique dans quel sens le groupe agit
            group_data[group]["impact"] += (
                feature["impact"]
            )

            
            # somme des valeurs absolues pour éviter que deux fortes contributions opposées s'annulent artificiellement
            group_data[group]["importance"] += (
                abs(feature["impact"])
            )


        #construction de groupe

        groups = []

        for category, data in group_data.items():

            impact = float(
                data["impact"]
            )

            importance = float(
                data["importance"]
            )

            direction = get_direction(
                impact
            )

            recommendation = None

            #on ne propose une recommandation que lorsque
            #le groupe contribue à augmenter l'estimation
            #et qu'une recommandation pertinente existe
            if (
                impact > EPSILON
                and category in RECOMMENDATIONS
            ):
                recommendation = (
                    RECOMMENDATIONS[category]
                )

            groups.append({
                "category": category,
                "impact": impact,
                "importance": importance,
                "direction": direction,

                "description":
                    generate_group_description(
                        category,
                        impact
                    ),

                "recommendation":
                    recommendation
            })


        #tri
        groups.sort(
            key=lambda group: group["importance"],
            reverse=True
        )

        visible_features = [
            feature
            for feature in all_features
            if feature["feature"] not in HIDDEN_FEATURES
        ]

        summary = generate_summary(
            prediction=prediction,
            grouped=groups
        )


        #reponse
        return {
            "base_value": base_value,
            "features": visible_features,
            "groups": groups,
            "summary": summary
        }