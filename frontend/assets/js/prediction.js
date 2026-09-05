(async function () {
  const form = document.getElementById("predictionForm");
  if (!form) return;

  const cfg = window.STUNTIX_CONFIG || {};

  const countrySelect = document.getElementById("country");
  const yearSelect = document.getElementById("year");
  const welcome = document.getElementById("predictionWelcome");
  const welcomeTitle = document.getElementById("predictionWelcomeTitle");
  const welcomeText = document.getElementById("predictionWelcomeText");
  const loadingState = document.getElementById("predictionLoading");
  const output = document.getElementById("predictionOutput");
  const btn = document.getElementById("predictBtn");
  const btnLabel = btn?.querySelector(".predict-btn-label");

  let state = "idle";
  let requestVersion = 0;

  //conf api
  const API_BASE_URL = cfg.API_BASE_URL || "http://127.0.0.1:8000";
  const PREDICT_ENDPOINT = cfg.PREDICT_ENDPOINT || "/predict/";
  const COUNTRIES_ENDPOINT = cfg.COUNTRIES_ENDPOINT || "/countries/";

  //outil
  function selectedCountryName() {
    if (!countrySelect) return "";

    const option = countrySelect.options[countrySelect.selectedIndex];
    return option?.textContent?.trim() || "";
  }

  function numberFrom(id) {
    const element = document.getElementById(id);
    if (!element) return NaN;

    const value = String(element.value).trim();
    if (value === "") return NaN;

    return Number(value);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  //chargement pays
  async function loadCountries() {
    if (!countrySelect) return;

    countrySelect.disabled = true;
    countrySelect.innerHTML =
      '<option value="">Chargement des pays...</option>';

    try {
      const response = await fetch(`${API_BASE_URL}${COUNTRIES_ENDPOINT}`);

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      const result = await response.json();

      const countries = Array.isArray(result)
        ? result
        : result.countries || result.data || [];

      if (!Array.isArray(countries)) {
        throw new Error("Format de la liste des pays invalide.");
      }

      countrySelect.innerHTML =
        '<option value="">Sélectionner un pays</option>';

      countries.forEach((country) => {
        if (country.id_pays === undefined || !country.nom_pays) return;

        const option = document.createElement("option");
        option.value = String(country.id_pays);
        option.textContent = country.nom_pays;

        countrySelect.appendChild(option);
      });

      const params = new URLSearchParams(window.location.search);
      const countryFromUrl = params.get("country");

      if (countryFromUrl) {
        const normalized = countryFromUrl.trim().toLowerCase();

        const matchingOption = [...countrySelect.options].find((option) => {
          return (
            option.value === countryFromUrl ||
            option.textContent.trim().toLowerCase() === normalized
          );
        });

        if (matchingOption) {
          countrySelect.value = matchingOption.value;
        }
      }

      countrySelect.disabled = false;
    } catch (error) {
      console.error("Erreur chargement des pays :", error);

      countrySelect.innerHTML =
        '<option value="">Impossible de charger les pays</option>';

      countrySelect.disabled = false;

      window.StuntixToast?.("Impossible de charger les pays depuis l'API.");
    }
  }

  //playload
  function payload() {
    return {
      id_pays: Number(countrySelect?.value),
      annee: numberFrom("year"),
      pib_par_habitant: numberFrom("gdp"),
      acces_eau: numberFrom("water"),
      mortalite_moins_5_ans: numberFrom("mortality"),
      depense_sante_pct_pib: numberFrom("health"),
      prevalence_sous_alimentation: numberFrom("undernourishment"),
      population_urbaine: numberFrom("urban"),
    };
  }

  function payloadIsValid(data) {
    if (!Number.isInteger(data.id_pays) || data.id_pays <= 0) {
      return false;
    }

    const numericKeys = [
      "annee",
      "pib_par_habitant",
      "acces_eau",
      "mortalite_moins_5_ans",
      "depense_sante_pct_pib",
      "prevalence_sous_alimentation",
      "population_urbaine",
    ];

    return numericKeys.every((key) => Number.isFinite(data[key]));
  }

  //appel api
  async function predict(data) {
    if (cfg.USE_MOCK_DATA === true) {
      await new Promise((resolve) => setTimeout(resolve, 700));

      return {
        ...demoResponse,
        nom_pays: selectedCountryName(),
        explanation: {
          ...demoResponse.explanation,
          features: demoResponse.explanation.features.map((feature) => {
            if (feature.feature === "annee") {
              return {
                ...feature,
                value: data.annee,
              };
            }

            return feature;
          }),
        },
      };
    }

    console.log("Payload envoyé à FastAPI :", data);

    const response = await fetch(`${API_BASE_URL}${PREDICT_ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorData;

      try {
        errorData = await response.json();
      } catch {
        errorData = {
          detail: `Erreur HTTP ${response.status}`,
        };
      }

      console.error("Erreur FastAPI :", errorData);

      throw new Error(`API ${response.status}`);
    }

    return await response.json();
  }

  //niveau de risque
  function riskOf(value) {
    if (value < 10) {
      return {
        label: "Risque faible",
        color: "#68b96d",
        bg: "linear-gradient(180deg,#4fa35b,#2f733a)",
      };
    }

    if (value < 30) {
      return {
        label: "Risque modéré",
        color: "#f3ad2d",
        bg: "linear-gradient(180deg,#e7a51c,#bf7600)",
      };
    }

    return {
      label: "Risque élevé",
      color: "#ef4f43",
      bg: "linear-gradient(180deg,#de5548,#a52d27)",
    };
  }

  //etat ui
  function setState(next, options = {}) {
    state = next;

    const isIdle = next === "idle";
    const isLoading = next === "loading";
    const isReady = next === "ready";

    if (welcome) {
      welcome.hidden = !isIdle;
    }

    if (loadingState) {
      loadingState.hidden = !isLoading;
    }

    if (output) {
      output.hidden = !isReady;
    }

    form.setAttribute("aria-busy", isLoading ? "true" : "false");

    btn?.classList.toggle("loading", isLoading);

    if (btn) {
      btn.disabled = isLoading;
    }

    if (btnLabel) {
      btnLabel.textContent = isLoading
        ? "Analyse en cours…"
        : "Lancer la prédiction";
    }

    if (isIdle && options.modified) {
      if (welcomeTitle) {
        welcomeTitle.textContent = "Scénario modifié";
      }

      if (welcomeText) {
        welcomeText.textContent =
          "Les paramètres ont changé. Relancez la prédiction pour obtenir un résultat à jour.";
      }
    } else if (isIdle) {
      if (welcomeTitle) {
        welcomeTitle.textContent = "Prêt pour une estimation";
      }

      if (welcomeText) {
        welcomeText.textContent =
          "Configurez votre scénario puis lancez la prédiction pour afficher le résultat et l’explication du modèle.";
      }
    }

    if (isReady) {
      output?.classList.remove("result-enter");

      requestAnimationFrame(() => {
        output?.classList.add("result-enter");
      });
    }
  }

  //affichage résulat
  function render(data) {
    console.log("Réponse utilisée pour le rendu :", data);

    const prediction = Number(data.prediction);

    if (!Number.isFinite(prediction)) {
      throw new Error("La réponse API ne contient pas une prédiction valide.");
    }

    const risk = riskOf(prediction);

    const formattedPrediction =
      prediction.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " %";

    const predictionValue = document.getElementById("predictionValue");

    if (predictionValue) {
      predictionValue.textContent = formattedPrediction;
    }

    const pill = document.getElementById("riskPill");

    if (pill) {
      pill.style.background = risk.bg;
      pill.style.borderColor = risk.color;
      pill.style.setProperty("--risk-color", risk.color);
    }

    const riskLabel = document.getElementById("riskLabel");

    if (riskLabel) {
      riskLabel.textContent = risk.label;
    }

    const countryName = data.nom_pays || selectedCountryName();

    const year = yearSelect?.value || "";

    const resultCountry = document.getElementById("resultCountry");

    if (resultCountry) {
      resultCountry.textContent = countryName;
    }

    const resultYear = document.getElementById("resultYear");

    if (resultYear) {
      resultYear.textContent = year;
    }

    const scenarioLabel = document.getElementById("scenarioLabel");

    if (scenarioLabel) {
      scenarioLabel.textContent = `${countryName} · ${year}`;
    }

    const features = data.explanation?.features || [];

    const groups = data.explanation?.groups || [];

    console.log("Features reçues :", features);
    console.log("Groups reçus :", groups);

    renderImpacts(features);
    renderRecommendations(groups);
  }

  //shap
  function renderImpacts(features) {
    const root = document.getElementById("impactList");

    if (!root) {
      console.error("#impactList introuvable.");
      return;
    }

    if (!Array.isArray(features) || !features.length) {
      root.innerHTML = `
        <div class="xai-empty">
          Aucun facteur explicatif reçu.
        </div>
      `;
      return;
    }

    const ordered = [...features]
      .filter((feature) => Number.isFinite(Number(feature.impact)))
      .sort((a, b) => Math.abs(Number(b.impact)) - Math.abs(Number(a.impact)))
      .slice(0, 8);

    if (!ordered.length) {
      root.innerHTML = `
        <div class="xai-empty">
          Aucun impact SHAP valide reçu.
        </div>
      `;
      return;
    }

    const maxImpact = Math.max(
      ...ordered.map((feature) => Math.abs(Number(feature.impact))),
      1,
    );

    root.innerHTML = ordered
      .map((feature, index) => {
        const impact = Number(feature.impact) || 0;

        const className = impact >= 0 ? "positive" : "negative";

        const width = Math.max(2.5, (Math.abs(impact) / maxImpact) * 48);

        const signedImpact =
          (impact >= 0 ? "+" : "") +
          impact.toLocaleString("fr-FR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

        const direction =
          feature.direction === "augmente"
            ? "Augmente"
            : feature.direction === "diminue"
              ? "Diminue"
              : impact >= 0
                ? "Augmente"
                : "Diminue";

        const label = feature.label || feature.feature || "Variable";

        return `
          <div class="xai-clean-row" style="--row-delay:${index * 38}ms">
            <div class="xai-clean-label" title="${escapeHtml(label)}">
              <span>${escapeHtml(label)}</span>
              <small>${direction}</small>
            </div>

            <div class="xai-clean-track" aria-hidden="true">
              <span class="xai-clean-zero"></span>
              <span
                class="xai-clean-bar ${className}"
                style="--bar-width:${width}%">
              </span>
            </div>

            <div class="xai-clean-value ${className}">
              ${signedImpact}
            </div>
          </div>
        `;
      })
      .join("");
  }

  //recommandation
  function renderRecommendations(groups) {
    const root = document.getElementById("recommendationsList");

    if (!root) {
      console.error("#recommendationsList introuvable dans prediction.html");
      return;
    }

    console.log("Groups reçus pour recommandations :", groups);

    if (!Array.isArray(groups) || groups.length === 0) {
      root.innerHTML = `
        <div class="result-polished-rec">
          <span class="result-polished-rec-index">—</span>
          <div class="result-polished-rec-content">
            <p>Aucune recommandation disponible pour ce scénario.</p>
          </div>
        </div>
      `;
      return;
    }

    const recommendations = groups
      .filter((group) => {
        return (
          typeof group.recommendation === "string" &&
          group.recommendation.trim() !== ""
        );
      })
      .sort((a, b) => {
        return Number(b.importance || 0) - Number(a.importance || 0);
      })
      .slice(0, 3);

    console.log("Recommandations à afficher :", recommendations);

    if (!recommendations.length) {
      root.innerHTML = `
        <div class="result-polished-rec">
          <span class="result-polished-rec-index">—</span>
          <div class="result-polished-rec-content">
            <p>Aucune recommandation prioritaire pour ce scénario.</p>
          </div>
        </div>
      `;
      return;
    }

    root.innerHTML = recommendations
      .map((group, index) => {
        const number = String(index + 1).padStart(2, "0");

        const category = group.category || "Recommandation";

        return `
          <div class="result-polished-rec">
            <span class="result-polished-rec-index">
              ${number}
            </span>

            <div class="result-polished-rec-content">
              <strong class="result-polished-rec-title">
                ${escapeHtml(category)}
              </strong>

              <p>
                ${escapeHtml(group.recommendation)}
              </p>
            </div>
          </div>
        `;
      })
      .join("");
  }

  //invalidation résulatat
  function invalidateResult() {
    requestVersion += 1;

    if (state === "ready" || state === "loading") {
      setState("idle", {
        modified: true,
      });
    }
  }

  form.querySelectorAll("input, select").forEach((control) => {
    control.addEventListener("input", invalidateResult);

    control.addEventListener("change", invalidateResult);
  });

  //soumission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = payload();

    console.log("Scénario envoyé :", data);

    if (!payloadIsValid(data)) {
      console.warn("Payload invalide :", data);

      window.StuntixToast?.(
        "Vérifiez le pays et les valeurs du scénario avant de lancer la prédiction.",
      );

      return;
    }

    const currentVersion = ++requestVersion;

    setState("loading");

    try {
      const response = await predict(data);

      if (currentVersion !== requestVersion) {
        return;
      }

      console.log("Réponse FastAPI complète :", response);

      render(response);

      setState("ready");

      window.StuntixToast?.("Prédiction terminée.");
    } catch (error) {
      if (currentVersion !== requestVersion) {
        return;
      }

      console.error("Erreur prédiction :", error);

      setState("idle", {
        modified: true,
      });

      window.StuntixToast?.(
        "Impossible d'effectuer la prédiction. Consultez la console pour voir l'erreur.",
      );
    }
  });

  //initialisation
  setState("idle");
  await loadCountries();
})();
