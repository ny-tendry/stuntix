(function () {
  const el = document.getElementById("backgroundWorldMap");
  if (!el || typeof echarts === "undefined") return;

  const worldMap = echarts.getMap("world");
  if (!worldMap) {
    console.warn('La carte "world" n’est pas disponible pour le fond.');
    return;
  }

  const cfg = window.STUNTIX_CONFIG || {};
  const API_BASE_URL = cfg.API_BASE_URL || "http://127.0.0.1:8000";
  const COUNTRIES_ENDPOINT = cfg.COUNTRIES_ENDPOINT || "/countries/";
  const CLUSTERS = {
    0: { color: "#ef4f43" },
    1: { color: "#f2ad2d" },
    2: { color: "#67b66d" },
  };

  const geoJSON = worldMap.geoJSON || worldMap.geoJson || null;
  const worldNames = new Map();
  const isoNames = new Map();

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  if (geoJSON?.features) {
    geoJSON.features.forEach((feature) => {
      const props = feature.properties || {};
      const name = props.name || props.NAME || props.admin || props.ADMIN;
      if (!name) return;
      worldNames.set(normalize(name), name);
      const iso =
        props.ISO_A3 ||
        props.iso_a3 ||
        props.ADM0_A3 ||
        props.adm0_a3 ||
        props.ISO3 ||
        props.iso3;
      if (iso && iso !== "-99") isoNames.set(String(iso).toUpperCase(), name);
    });
  }

  const aliases = {
    "united republic of tanzania": "Tanzania",
    "bolivia plurinational state of": "Bolivia",
    "iran islamic republic of": "Iran",
    "republic of moldova": "Moldova",
    turkiye: "Turkey",
    "viet nam": "Vietnam",
    "united kingdom of great britain and northern ireland": "United Kingdom",
    "netherlands kingdom of the": "Netherlands",
    "cote divoire": "Côte d'Ivoire",
    "democratic republic of the congo": "Dem. Rep. Congo",
    "central african republic": "Central African Rep.",
    czechia: "Czech Rep.",
    "bosnia and herzegovina": "Bosnia and Herz.",
  };

  function resolveName(country) {
    const iso = String(country.iso_code || "").toUpperCase();
    if (isoNames.has(iso)) return isoNames.get(iso);
    const normalized = normalize(country.nom_pays);
    if (worldNames.has(normalized)) return worldNames.get(normalized);
    const alias = aliases[normalized];
    if (alias && worldNames.has(normalize(alias)))
      return worldNames.get(normalize(alias));
    return alias || country.nom_pays;
  }

  const chart = echarts.init(el, null, {
    renderer: "canvas",
    devicePixelRatio: 1,
    useDirtyRect: false,
  });

  function setMap(data = []) {
    chart.setOption(
      {
        animation: false,
        backgroundColor: "transparent",
        tooltip: { show: false },
        series: [
          {
            type: "map",
            map: "world",
            silent: true,
            roam: false,
            zoom: 0.9,
            center: [8, 18],
            top: "4%",
            left: "6%",
            right: "3%",
            bottom: "4%",
            data,
            selectedMode: false,
            itemStyle: {
              areaColor: "#1c4058",
              borderColor: "rgba(190,220,242,.20)",
              borderWidth: 0.55,
            },
            emphasis: { disabled: true },
            label: { show: false },
          },
        ],
      },
      { notMerge: true, lazyUpdate: false },
    );
  }

  setMap();

  fetch(`${API_BASE_URL}${COUNTRIES_ENDPOINT}`)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((result) => {
      const countries = Array.isArray(result)
        ? result
        : result.countries || result.data || [];
      if (!Array.isArray(countries)) return;
      const data = countries
        .map((country) => {
          const cluster = Number(country.cluster);
          if (!Object.prototype.hasOwnProperty.call(CLUSTERS, cluster))
            return null;
          return {
            name: resolveName(country),
            value: cluster,
            itemStyle: { areaColor: CLUSTERS[cluster].color },
          };
        })
        .filter(Boolean);
      setMap(data);
    })
    .catch((error) =>
      console.warn(
        "Fond de carte : données API indisponibles, carte de base conservée.",
        error,
      ),
    );

  window.addEventListener("resize", () => chart.resize(), { passive: true });
})();
