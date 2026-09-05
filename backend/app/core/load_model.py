import joblib
from pathlib import Path

class LoadModel():
    def __init__(self):
        self.model = None
    
    def charge_model(self):
        self.model = joblib.load(f"{Path(__file__).resolve().parent.parent}/models/random_forest.pkl")
        return self.model