(function () {
  const el = document.getElementById("worldMap");
  const mapLoading = document.getElementById("mapLoading");

  if (!el) return;

  if (typeof echarts === "undefined") {
    console.error("ECharts n'est pas chargé.");
    if (mapLoading) {
      mapLoading.classList.add("map-load-error");
      mapLoading.innerHTML = "<span>Carte indisponible</span>";
    }
    return;
  }

  const cfg = window.STUNTIX_CONFIG || {};
  const API_BASE_URL = cfg.API_BASE_URL || "http://127.0.0.1:8000";
  const COUNTRIES_ENDPOINT = cfg.COUNTRIES_ENDPOINT || "/countries/";

  //cluster
  const CLUSTERS = {
    0: {
      label: "Élevé",
      color: "#ef4f43",
    },
    1: {
      label: "Modéré",
      color: "#f2ad2d",
    },
    2: {
      label: "Faible",
      color: "#67b66d",
    },
  };

  //carte
  const worldMap = echarts.getMap("world");

  if (!worldMap) {
    console.error('La carte "world" n\'est pas enregistrée dans ECharts.');

    if (mapLoading) {
      mapLoading.classList.add("map-load-error");
      mapLoading.innerHTML =
        "<span>Impossible de charger la carte mondiale</span>";
    }

    return;
  }

  const chart = echarts.init(el, null, {
    renderer: "canvas",
    devicePixelRatio: Math.min(
      Math.max(Math.round(window.devicePixelRatio || 1), 1),
      2,
    ),
    useDirtyRect: false,
  });

  let countries = [];
  let allData = [];

  const activeClusters = new Set([0, 1, 2]);

  //geojson
  const geoJSON = worldMap.geoJSON || worldMap.geoJson || null;

  const worldNames = new Set();
  const normalizedWorldNames = new Map();
  const geoNameByIso = new Map();

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  if (geoJSON?.features) {
    geoJSON.features.forEach((feature) => {
      const props = feature.properties || {};

      const name = props.name || props.NAME || props.admin || props.ADMIN;

      if (name) {
        worldNames.add(name);
        normalizedWorldNames.set(normalizeText(name), name);
      }

      const iso =
        props.ISO_A3 ||
        props.iso_a3 ||
        props.ADM0_A3 ||
        props.adm0_a3 ||
        props.ISO3 ||
        props.iso3;

      if (iso && iso !== "-99" && name) {
        geoNameByIso.set(String(iso).toUpperCase(), name);
      }
    });
  }

  //nom particulier
  const ISO_MAP_CANDIDATES = {
    USA: ["United States of America", "United States"],
    RUS: ["Russia", "Russian Federation"],
    COD: ["Dem. Rep. Congo", "Democratic Republic of the Congo"],
    COG: ["Congo", "Republic of the Congo"],
    CAF: ["Central African Rep.", "Central African Republic"],
    CIV: ["Côte d'Ivoire", "Côte d’Ivoire", "Ivory Coast", "Cote d'Ivoire"],
    CZE: ["Czechia", "Czech Rep.", "Czech Republic"],
    BIH: ["Bosnia and Herz.", "Bosnia and Herzegovina"],
    DOM: ["Dominican Rep.", "Dominican Republic"],
    TZA: ["Tanzania", "United Republic of Tanzania"],
    BOL: ["Bolivia", "Bolivia (Plurinational State of)"],
    IRN: ["Iran", "Iran (Islamic Republic of)"],
    MDA: ["Moldova", "Republic of Moldova"],
    VNM: ["Vietnam", "Viet Nam"],
    TUR: ["Turkey", "Türkiye"],
    GBR: [
      "United Kingdom",
      "United Kingdom of Great Britain and Northern Ireland",
    ],
    NLD: ["Netherlands", "Netherlands (Kingdom of the)"],
    CPV: ["Cape Verde", "Cabo Verde"],
    GMB: ["Gambia", "The Gambia"],
    SWZ: ["Eswatini", "Swaziland"],
    MKD: ["North Macedonia", "Macedonia"],
    MMR: ["Myanmar"],
    TLS: ["Timor-Leste", "East Timor"],
    KOR: ["South Korea", "Republic of Korea", "Korea"],
    PRK: ["North Korea"],
    LAO: ["Laos"],
    SYR: ["Syria"],
  };

  function resolveMapName(country) {
    const iso = String(country.iso_code || "")
      .trim()
      .toUpperCase();

    //correspondd par iso
    if (geoNameByIso.has(iso)) {
      return geoNameByIso.get(iso);
    }

    //correspond avec les nom particuliers
    const candidates = ISO_MAP_CANDIDATES[iso];

    if (candidates) {
      for (const candidate of candidates) {
        const normalized = normalizeText(candidate);

        if (normalizedWorldNames.has(normalized)) {
          return normalizedWorldNames.get(normalized);
        }
      }
    }

    //nom venanr du backend
    const normalizedCountry = normalizeText(country.nom_pays);

    if (normalizedWorldNames.has(normalizedCountry)) {
      return normalizedWorldNames.get(normalizedCountry);
    }

    console.warn(
      "Pays non trouvé dans le GeoJSON :",
      country.iso_code,
      country.nom_pays,
    );

    return country.nom_pays;
  }

  //loading
  function showLoading() {
    if (!mapLoading) return;

    mapLoading.removeAttribute("hidden");
    mapLoading.classList.remove("is-complete", "map-load-error");

    mapLoading.innerHTML = `
      <span class="micro-spinner" aria-hidden="true"></span>
      <span>Chargement des données</span>
    `;
  }

  function hideLoading() {
    if (!mapLoading) return;

    mapLoading.classList.add("is-complete");

    setTimeout(() => {
      mapLoading.setAttribute("hidden", "");
    }, 260);
  }

  function showLoadingError(message = "Impossible de charger les données") {
    if (!mapLoading) return;

    mapLoading.classList.add("map-load-error");
    mapLoading.innerHTML = `<span>${message}</span>`;
  }

  //api
  async function loadCountries() {
    showLoading();

    try {
      const response = await fetch(`${API_BASE_URL}${COUNTRIES_ENDPOINT}`);

      if (!response.ok) {
        throw new Error(`Erreur API ${response.status}`);
      }

      const result = await response.json();

      countries = Array.isArray(result)
        ? result
        : result.countries || result.data || [];

      if (!Array.isArray(countries)) {
        throw new Error("Le format retourné par /countries/ est invalide.");
      }

      console.log("Pays reçus depuis FastAPI :", countries);

      buildMapData();
      initializeMap();
      syncClusterControls();
      hideLoading();
    } catch (error) {
      console.error("Erreur chargement carte :", error);

      showLoadingError();

      window.StuntixToast?.("Impossible de récupérer les pays depuis FastAPI.");
    }
  }

  //conversion echart
  function buildMapData() {
    allData = countries
      .map((country) => {
        const cluster = Number(country.cluster);

        if (!Object.prototype.hasOwnProperty.call(CLUSTERS, cluster)) {
          console.warn("Cluster inconnu :", country);
          return null;
        }

        return {
          name: resolveMapName(country),
          value: cluster,
          id_pays: Number(country.id_pays),
          iso_code: country.iso_code,
          nom_pays: country.nom_pays,
          cluster,
          pca_1: country.pca_1,
          pca_2: country.pca_2,
          pca_3: country.pca_3,
          pca_4: country.pca_4,
          pca_5: country.pca_5,
          itemStyle: {
            areaColor: CLUSTERS[cluster].color,
          },
        };
      })
      .filter(Boolean);

    const missing = allData.filter((item) => {
      return worldNames.size > 0 && !worldNames.has(item.name);
    });

    if (missing.length) {
      console.warn(
        "Pays non associés automatiquement à la carte :",
        missing.map((country) => ({
          iso_code: country.iso_code,
          nom_pays: country.nom_pays,
          nom_echarts: country.name,
        })),
      );
    }
  }

  function getVisibleMapData() {
    return allData.filter((country) => activeClusters.has(country.cluster));
  }

  // Mise en page responsive de la carte.
  // Le canvas ECharts couvre toujours tout l'écran. Sur téléphone, la carte
  // géographique garde un rapport constant et est simplement centrée/zoomée.
  // On évite volontairement top/right/bottom/left sur mobile : ces quatre
  // contraintes peuvent étirer une map GeoJSON dans un viewport portrait.
  const WORLD_ASPECT_SCALE = 0.75;

  function isPhoneMap() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function viewportSize() {
    const viewport = window.visualViewport;
    return {
      width: Math.max(1, Math.round(viewport?.width || el.clientWidth || window.innerWidth || 1)),
      height: Math.max(1, Math.round(viewport?.height || el.clientHeight || window.innerHeight || 1)),
    };
  }

  // Taille de la carte dans le canvas plein écran. Sur un téléphone portrait,
  // elle est volontairement un peu plus large que l'écran : cela donne un
  // cadrage central naturel, sans écraser verticalement les continents.
  function phoneLayoutSize() {
    const { width, height } = viewportSize();
    return Math.round(
      Math.min(760, Math.max(width * 1.28, height * 0.70)),
    );
  }

  function defaultMapView() {
    if (isPhoneMap()) {
      return {
        zoom: 1,
        center: [8, 18],
        aspectScale: WORLD_ASPECT_SCALE,
        layoutCenter: ["50%", "50%"],
        layoutSize: phoneLayoutSize(),
        top: null,
        right: null,
        bottom: null,
        left: null,
      };
    }

    return {
      zoom: 0.9,
      center: [8, 18],
      aspectScale: WORLD_ASPECT_SCALE,
      layoutCenter: null,
      layoutSize: null,
      top: "4%",
      left: "9%",
      right: "4%",
      bottom: "5%",
    };
  }

  function responsiveMapLayout() {
    if (isPhoneMap()) {
      return {
        aspectScale: WORLD_ASPECT_SCALE,
        layoutCenter: ["50%", "50%"],
        layoutSize: phoneLayoutSize(),
        top: null,
        right: null,
        bottom: null,
        left: null,
      };
    }

    return {
      aspectScale: WORLD_ASPECT_SCALE,
      layoutCenter: null,
      layoutSize: null,
      top: "4%",
      left: "9%",
      right: "4%",
      bottom: "5%",
    };
  }

  function resizeMapCanvas() {
    // Laisser ECharts recalculer sa surface à partir du conteneur réellement
    // visible évite qu'un ancien 100vh soit étiré vers le 100dvh sur mobile.
    chart.resize();

    if (isPhoneMap()) {
      chart.setOption({
        series: [
          {
            aspectScale: WORLD_ASPECT_SCALE,
            layoutCenter: ["50%", "50%"],
            layoutSize: phoneLayoutSize(),
            top: null,
            right: null,
            bottom: null,
            left: null,
          },
        ],
      });
    }
  }

  //rendu echart
  function initializeMap() {
    chart.setOption(
      {
        animation: false,
        backgroundColor: "transparent",

        tooltip: {
          trigger: "item",
          transitionDuration: 0,
          hideDelay: 0,
          backgroundColor: "rgba(4,25,49,.94)",
          borderColor: "rgba(167,203,241,.35)",
          borderWidth: 1,
          padding: [10, 12],

          textStyle: {
            color: "#ffffff",
            fontSize: 13,
          },

          formatter(params) {
            const country = params.data;

            if (!country) {
              return `
              <strong>${escapeHtml(params.name)}</strong><br>
              <span style="opacity:.65">Donnée non disponible</span>
            `;
            }

            const cluster = CLUSTERS[country.cluster];

            return `
            <div style="min-width:150px;line-height:1.55">
              <strong>${escapeHtml(country.nom_pays)}</strong>
              <span style="opacity:.55;margin-left:5px;font-size:11px">
                ${escapeHtml(country.iso_code)}
              </span>
              <br>
              <span style="display:inline-flex;align-items:center;gap:7px;margin-top:5px">
                <span style="width:8px;height:8px;border-radius:50%;background:${cluster.color}"></span>
                Risque ${cluster.label}
              </span>
            </div>
          `;
          },
        },

        series: [
          {
            type: "map",
            map: "world",
            roam: true,
            ...defaultMapView(),
            data: getVisibleMapData(),
            selectedMode: false,

            stateAnimation: {
              duration: 0,
            },

            itemStyle: {
              areaColor: "#224b63",
              borderColor: "rgba(205,231,243,.42)",
              borderWidth: 0.75,
            },

            emphasis: {
              label: {
                show: false,
              },

              itemStyle: {
                areaColor: "#78c6f2",
                borderColor: "#eaf8ff",
                borderWidth: 0.9,
              },
            },

            label: {
              show: false,
            },
          },
        ],
      },
      true,
    );
  }

  //fiche pays
  const card = document.getElementById("countryCard");
  const cardName = document.getElementById("countryCardName");
  const cardCluster = document.getElementById("countryCardCluster");
  const cardMeta = document.getElementById("countryCardMeta");
  const cardLink = document.getElementById("countryProfileLink");

  function showCountry(country) {
    if (!country || !card) return;

    const cluster = CLUSTERS[country.cluster];

    if (cardName) {
      cardName.textContent = country.nom_pays;
    }

    if (cardCluster) {
      cardCluster.textContent = `Cluster ${country.cluster} · ${cluster.label}`;
      cardCluster.style.color = cluster.color;
    }

    if (cardMeta) {
      cardMeta.textContent = `Classification : risque ${cluster.label.toLowerCase()}.`;
    }

    if (cardLink) {
      cardLink.href = `fiche-pays.html?country=${encodeURIComponent(country.id_pays)}`;
    }

    card.classList.add("show");
  }

  function closeCountry() {
    card?.classList.remove("show");
  }

  document
    .getElementById("closeCountryCard")
    ?.addEventListener("click", closeCountry);

  chart.on("click", (params) => {
    if (!params.data) return;
    showCountry(params.data);
  });

  //recherche
  const input = document.getElementById("countrySearch");
  const suggestions = document.getElementById("searchSuggestions");

  let suggestionItems = [];
  let activeSuggestion = -1;

  function hideSuggestions() {
    activeSuggestion = -1;

    suggestions?.classList.remove("show");

    if (suggestions) {
      suggestions.innerHTML = "";
    }
  }

  function searchCountries(query) {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) return [];

    return allData.filter((country) => {
      const name = normalizeText(country.nom_pays);
      const iso = normalizeText(country.iso_code);

      return name.includes(normalizedQuery) || iso.includes(normalizedQuery);
    });
  }

  function renderSuggestions(query) {
    if (!suggestions) return;

    if (!query.trim()) {
      hideSuggestions();
      return;
    }

    suggestionItems = searchCountries(query)
      .filter((country) => activeClusters.has(country.cluster))
      .slice(0, 6);

    if (!suggestionItems.length) {
      suggestions.innerHTML =
        '<div class="search-empty">Aucun pays trouvé</div>';

      suggestions.classList.add("show");
      return;
    }

    suggestions.innerHTML = suggestionItems
      .map((country, index) => {
        const cluster = CLUSTERS[country.cluster];

        return `
          <button
            type="button"
            class="search-suggestion"
            role="option"
            data-suggestion-index="${index}">
            <span>${escapeHtml(country.nom_pays)}</span>
            <small style="--cluster-color:${cluster.color}">
              <i></i>
              ${cluster.label}
            </small>
          </button>
        `;
      })
      .join("");

    suggestions.classList.add("show");
  }

  function focusCountry(country) {
    if (!country) return;

    if (!activeClusters.has(country.cluster)) {
      window.StuntixToast?.("Le cluster de ce pays est actuellement masqué.");
      return;
    }

    chart.dispatchAction({
      type: "downplay",
      seriesIndex: 0,
    });

    chart.dispatchAction({
      type: "highlight",
      seriesIndex: 0,
      name: country.name,
    });

    chart.dispatchAction({
      type: "showTip",
      seriesIndex: 0,
      name: country.name,
    });

    showCountry(country);

    if (input) {
      input.value = country.nom_pays;
    }

    hideSuggestions();
  }

  input?.addEventListener("input", () => {
    renderSuggestions(input.value);
  });

  input?.addEventListener("focus", () => {
    if (input.value.trim()) {
      renderSuggestions(input.value);
    }
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && suggestionItems.length) {
      event.preventDefault();

      activeSuggestion = (activeSuggestion + 1) % suggestionItems.length;

      updateSuggestionFocus();
      return;
    }

    if (event.key === "ArrowUp" && suggestionItems.length) {
      event.preventDefault();

      activeSuggestion =
        (activeSuggestion - 1 + suggestionItems.length) %
        suggestionItems.length;

      updateSuggestionFocus();
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();

    if (activeSuggestion >= 0 && suggestionItems[activeSuggestion]) {
      focusCountry(suggestionItems[activeSuggestion]);
      return;
    }

    const found = searchCountries(input.value)[0];

    if (!found) {
      window.StuntixToast?.("Pays non trouvé.");
      return;
    }

    focusCountry(found);
  });

  function updateSuggestionFocus() {
    if (!suggestions) return;

    [...suggestions.querySelectorAll(".search-suggestion")].forEach(
      (element, index) => {
        element.classList.toggle("is-active", index === activeSuggestion);
      },
    );
  }

  suggestions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion-index]");

    if (!button) return;

    const index = Number(button.dataset.suggestionIndex);

    focusCountry(suggestionItems[index]);
  });

  //zoom
  function currentZoom() {
    return chart.getOption().series?.[0]?.zoom || 0.9;
  }

  document.getElementById("zoomIn")?.addEventListener("click", () => {
    chart.setOption({
      series: [
        {
          zoom: Math.min(5, currentZoom() * 1.28),
        },
      ],
    });
  });

  document.getElementById("zoomOut")?.addEventListener("click", () => {
    chart.setOption({
      series: [
        {
          zoom: Math.max(0.65, currentZoom() / 1.28),
        },
      ],
    });
  });

  //recentrage
  document.getElementById("resetMap")?.addEventListener("click", () => {
    chart.setOption({
      series: [
        {
          ...defaultMapView(),
        },
      ],
    });

    chart.dispatchAction({
      type: "downplay",
      seriesIndex: 0,
    });

    closeCountry();

    if (input) {
      input.value = "";
    }

    hideSuggestions();
  });

  //filtre cluster
  function syncClusterControls() {
    document.querySelectorAll("[data-cluster-filter]").forEach((button) => {
      const cluster = Number(button.dataset.clusterFilter);

      const active = activeClusters.has(cluster);

      button.classList.toggle("active", active);

      button.setAttribute("aria-pressed", String(active));
    });
  }

  function applyClusterFilters() {
    chart.setOption({
      series: [
        {
          data: getVisibleMapData(),
        },
      ],
    });

    chart.dispatchAction({
      type: "downplay",
      seriesIndex: 0,
    });

    closeCountry();
    hideSuggestions();
    syncClusterControls();
  }

  function toggleCluster(cluster) {
    cluster = Number(cluster);

    if (!CLUSTERS[cluster]) return;

    if (activeClusters.has(cluster)) {
      if (activeClusters.size === 1) {
        window.StuntixToast?.("Au moins un cluster doit rester visible.");
        return;
      }

      activeClusters.delete(cluster);
    } else {
      activeClusters.add(cluster);
    }

    applyClusterFilters();
  }

  document.querySelectorAll("[data-cluster-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleCluster(button.dataset.clusterFilter);
    });
  });

  //clic extérieur
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) {
      hideSuggestions();
    }
  });

  //responsive
  let phoneLayoutState = isPhoneMap();
  let resizeFrame = 0;

  function scheduleMapResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const nextPhoneLayoutState = isPhoneMap();
      const breakpointChanged = nextPhoneLayoutState !== phoneLayoutState;
      phoneLayoutState = nextPhoneLayoutState;

      chart.resize();

      // En mode téléphone on recalcule uniquement la taille de mise en page.
      // Le zoom et le centre choisis par l'utilisateur restent intacts.
      if (nextPhoneLayoutState) {
        chart.setOption({ series: [{ ...responsiveMapLayout() }] });
      } else if (breakpointChanged) {
        chart.setOption({ series: [{ ...responsiveMapLayout() }] });
      }
    });
  }

  window.addEventListener("resize", scheduleMapResize, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleMapResize, { passive: true });

  window.addEventListener(
    "orientationchange",
    () => window.setTimeout(scheduleMapResize, 180),
    { passive: true },
  );

  if (typeof ResizeObserver !== "undefined") {
    const mapResizeObserver = new ResizeObserver(scheduleMapResize);
    mapResizeObserver.observe(el);
  }

  //html
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  //initialisation
  loadCountries();
})();
