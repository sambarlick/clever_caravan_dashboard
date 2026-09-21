/**
 * Clever Caravan dashboard strategy (Beta).
 *
 * Overview  = status + priority controls, one section per category present.
 * Subviews  = full detail + all controls for each category.
 *
 * Entity sources:
 *  - Clever Caravan integrations (always, auto-discovered)
 *  - Extra integrations ticked in the integration's settings
 *  - Any entity carrying a cc_<category> label (cc_hidden removes one)
 *
 * Placement: labels first, then entity type / platform / name. Native cards only.
 */

const OWNED_PLATFORMS = [
  "clever_caravan_power",
  "clever_caravan_tpms",
  "clever_caravan_safety_sam_tpms",
  "clever_caravan_location",
  "clever_caravan_weather",
  "clever_caravan_waymote",
];

const CATS = {
  power: { title: "Power", icon: "mdi:lightning-bolt" },
  water: { title: "Water", icon: "mdi:water" },
  climate: { title: "Climate", icon: "mdi:thermometer" },
  lights: { title: "Lights", icon: "mdi:lightbulb" },
  controls: { title: "Controls", icon: "mdi:toggle-switch" },
  location: { title: "Location", icon: "mdi:map-marker" },
  tyres: { title: "Tyres", icon: "mdi:car-tire-alert" },
  security: { title: "Security", icon: "mdi:cctv" },
  more: { title: "More", icon: "mdi:dots-horizontal" },
};
const ORDER = ["power", "water", "climate", "lights", "controls", "location", "tyres", "security", "more"];

const LABEL_PREFIX = "cc_";
const WATER_RE = /(tank|water|pump|grey)/;
const LIGHT_RE = /(light|lamp|spot|flood)/;
const POWER_DC = new Set(["power", "energy", "battery", "voltage", "current", "apparent_power", "reactive_power", "power_factor", "frequency"]);
const CLIMATE_DC = new Set(["temperature", "humidity", "pressure", "atmospheric_pressure", "wind_speed", "wind_direction", "precipitation", "precipitation_intensity", "illuminance", "irradiance"]);
const CONTROL_DOMAINS = new Set(["switch", "select", "number", "button", "input_boolean", "input_select", "input_number", "input_button", "cover", "lock", "valve", "script", "scene"]);
const TOGGLE_DOMAINS = new Set(["switch", "input_boolean", "light", "fan", "script"]);

// role -> vdef.key on clever_caravan_power ({portal}_{key}_{instance})
const POWER_HEADLINE = [
  { key: "battery_soc", name: "Battery" },
  { key: "pv_power", name: "Solar" },
  { key: "shore_power", name: "Shore Power" },
];

/* ---------------- helpers ---------------- */

const domainOf = (id) => id.split(".")[0];

function isUsable(hass, e) {
  return !e.disabled_by && !e.hidden_by && !e.entity_category && hass.states[e.entity_id] !== undefined;
}

function findConfigState(hass, registry) {
  const mine = registry.filter((e) => e.platform === "clever_caravan_dashboard" && e.entity_id.startsWith("sensor."));
  const entry =
    mine.find((e) => e.translation_key === "config") ||
    mine.find((e) => e.entity_id === "sensor.clever_caravan_dashboard_config") ||
    mine[0];
  return entry ? hass.states[entry.entity_id] : undefined;
}

function labelCategory(e) {
  for (const l of e.labels || []) {
    if (!l.startsWith(LABEL_PREFIX)) continue;
    const c = l.slice(LABEL_PREFIX.length);
    if (c === "hidden") return null;
    if (CATS[c]) return c;
  }
  return undefined;
}

function classify(hass, e) {
  const fromLabel = labelCategory(e);
  if (fromLabel !== undefined) return fromLabel;

  const st = hass.states[e.entity_id];
  const d = domainOf(e.entity_id);
  const dc = st.attributes.device_class;
  const text = `${e.entity_id} ${st.attributes.friendly_name || ""}`.toLowerCase();

  if (d === "light") return "lights";
  if (d === "camera") return "security";
  if (d === "device_tracker") return "location";
  if (d === "climate" || d === "fan" || d === "weather") return "climate";
  if (e.platform === "clever_caravan_location") return "location";
  if (e.platform === "clever_caravan_tpms" || e.platform === "clever_caravan_safety_sam_tpms") return "tyres";
  if (WATER_RE.test(text) && !CLIMATE_DC.has(dc)) return "water";
  if (e.platform === "clever_caravan_weather") return "climate";
  if (e.platform === "clever_caravan_power") return "power";
  if (CONTROL_DOMAINS.has(d) && LIGHT_RE.test(text)) return "lights";
  if (POWER_DC.has(dc)) return "power";
  if (CLIMATE_DC.has(dc)) return "climate";
  if (CONTROL_DOMAINS.has(d)) return "controls";
  return "more";
}

function deviceName(hass, id) {
  const d = id && hass.devices ? hass.devices[id] : undefined;
  return (d && (d.name_by_user || d.name)) || "Other";
}

function areaName(hass, e) {
  const areaId = e.area_id || (e.device_id && hass.devices?.[e.device_id]?.area_id);
  return (areaId && hass.areas?.[areaId]?.name) || "Unassigned";
}

function shortName(hass, entityId, prefix) {
  const full = hass.states[entityId]?.attributes.friendly_name || "";
  if (prefix && full.startsWith(prefix + " ")) {
    const rest = full.slice(prefix.length + 1).trim();
    if (rest) return rest;
  }
  return undefined;
}

/* ---------------- cards ---------------- */

function cardFor(hass, id, name) {
  const d = domainOf(id);
  if (d === "camera" || d === "image") {
    return { type: "picture-entity", entity: id, show_state: false, show_name: true };
  }
  const card = { type: "tile", entity: id };
  if (name) card.name = name;
  if (TOGGLE_DOMAINS.has(d)) card.tap_action = { action: "toggle" };
  if (d === "button" || d === "input_button") {
    card.tap_action = { action: "perform-action", perform_action: `${d}.press`, target: { entity_id: id } };
  }
  if (d === "select" || d === "input_select") card.features = [{ type: "select-options" }];
  if (d === "number" || d === "input_number") card.features = [{ type: "numeric-input", style: "buttons" }];
  if (d === "climate") {
    const modes = hass.states[id]?.attributes.hvac_modes;
    card.features = [{ type: "target-temperature" }];
    if (Array.isArray(modes) && modes.length) card.features.push({ type: "climate-hvac-modes", hvac_modes: modes });
  }
  return card;
}

const heading = (text, extra = {}) => ({ type: "heading", heading: text, ...extra });
const placeholder = (name) => ({ type: "markdown", content: `\u26a0\ufe0f Unresolved: **${name}**` });

/* ---------------- power headline ---------------- */

function powerHeadline(hass, entries) {
  const used = new Set();
  const cards = POWER_HEADLINE.map(({ key, name }) => {
    const re = new RegExp(`^[0-9a-f]+_${key}_([^_]+)$`);
    const pool = entries.filter((e) => e.platform === "clever_caravan_power");
    const hit =
      pool.filter((e) => re.test(e.unique_id || "")).sort((a, b) => a.unique_id.localeCompare(b.unique_id, undefined, { numeric: true }))[0] ||
      pool.find((e) => e.entity_id.startsWith("sensor.") && e.entity_id.includes(key));
    if (!hit) return placeholder(name);
    used.add(hit.entity_id);
    return cardFor(hass, hit.entity_id, name);
  });
  return { cards, used };
}

/* ---------------- overview priorities ---------------- */

const byDomain = (list, ...domains) => list.filter((e) => domains.includes(domainOf(e.entity_id)));
const matching = (list, re) => list.filter((e) => re.test(e.entity_id));
const unitIs = (hass, list, unit) => list.filter((e) => hass.states[e.entity_id].attributes.unit_of_measurement === unit);
const dcIs = (hass, list, dc) => list.filter((e) => hass.states[e.entity_id].attributes.device_class === dc);
const ids = (list, n) => [...new Set(list.map((e) => e.entity_id))].slice(0, n);

function priorityCards(hass, cat, list) {
  switch (cat) {
    case "power": {
      const { cards } = powerHeadline(hass, list);
      const extra = [
        ...ids(matching(byDomain(list, "select"), /inverter/), 1),
        ...ids(matching(byDomain(list, "number"), /input_current_limit|input_limit/), 1),
      ];
      return [...cards, ...extra.map((id) => cardFor(hass, id))];
    }
    case "water":
      return [
        ...ids(unitIs(hass, byDomain(list, "sensor"), "%"), 4),
        ...ids(byDomain(list, "switch", "input_boolean"), 4),
      ].map((id) => cardFor(hass, id));
    case "climate":
      return [
        ...ids(byDomain(list, "climate", "fan"), 2),
        ...ids(dcIs(hass, byDomain(list, "sensor"), "temperature"), 4),
      ].map((id) => cardFor(hass, id));
    case "lights":
      return ids(byDomain(list, "light", "switch", "input_boolean"), 8).map((id) => cardFor(hass, id));
    case "controls":
      return ids(byDomain(list, "switch", "input_boolean", "select"), 6).map((id) => cardFor(hass, id));
    case "location": {
      const key = matching(byDomain(list, "sensor"), /status|current_location|city/);
      return ids(key.length ? key : byDomain(list, "sensor"), 3).map((id) => cardFor(hass, id));
    }
    case "tyres":
      return ids(dcIs(hass, byDomain(list, "sensor"), "pressure"), 6).map((id) => cardFor(hass, id));
    case "security":
      return ids(byDomain(list, "camera"), 2).map((id) => cardFor(hass, id));
    default:
      return [];
  }
}

/* ---------------- views ---------------- */

function groupSections(hass, list, keyFn, labelFn) {
  const groups = new Map();
  for (const e of list) {
    const k = keyFn(e);
    if (!groups.has(k)) groups.set(k, { label: labelFn(e), items: [] });
    groups.get(k).items.push(e);
  }
  return [...groups.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ label, items }) => ({
      type: "grid",
      cards: [
        heading(label, { heading_style: "subtitle" }),
        ...items
          .sort((a, b) => a.entity_id.localeCompare(b.entity_id))
          .map((e) => cardFor(hass, e.entity_id, shortName(hass, e.entity_id, label))),
      ],
    }));
}

function buildOverview(hass, cats, base) {
  const sections = ORDER.filter((c) => c !== "more" && cats.has(c)).map((c) => ({
    type: "grid",
    cards: [
      heading(CATS[c].title, {
        icon: CATS[c].icon,
        tap_action: { action: "navigate", navigation_path: `${base}/${c}` },
      }),
      ...priorityCards(hass, c, cats.get(c)),
    ],
  }));
  if (cats.has("more")) {
    sections.push({
      type: "grid",
      cards: [heading(CATS.more.title, { icon: CATS.more.icon, tap_action: { action: "navigate", navigation_path: `${base}/more` } })],
    });
  }
  return { title: "Overview", path: "overview", icon: "mdi:caravan", type: "sections", max_columns: 3, sections };
}

function buildSubview(hass, cat, list) {
  const sections = [];
  let rest = list;

  if (cat === "power") {
    const { cards, used } = powerHeadline(hass, list);
    sections.push({ type: "grid", cards: [heading("Overview", { heading_style: "subtitle" }), ...cards] });
    rest = list.filter((e) => !used.has(e.entity_id));
  }

  if (cat === "location") {
    const trackers = ids(byDomain(list, "device_tracker"), 10);
    if (trackers.length) {
      sections.push({
        type: "grid",
        column_span: 2,
        cards: [{ type: "map", entities: trackers, default_zoom: 12, grid_options: { columns: "full", rows: 6 } }],
      });
    }
  }

  if (cat === "lights") {
    sections.push(...groupSections(hass, rest, (e) => areaName(hass, e), (e) => areaName(hass, e)));
  } else {
    sections.push(
      ...groupSections(hass, rest, (e) => e.device_id || "_none", (e) => deviceName(hass, e.device_id))
    );
  }

  return { title: CATS[cat].title, path: cat, icon: CATS[cat].icon, subview: true, type: "sections", max_columns: 3, sections };
}

function messageDashboard(message) {
  return { title: "Clever Caravan", views: [{ title: "Clever Caravan", icon: "mdi:caravan", cards: [{ type: "markdown", content: message }] }] };
}

/* ---------------- strategy ---------------- */

class CleverCaravanStrategy {
  static async generate(config, hass) {
    let registry;
    try {
      registry = await hass.callWS({ type: "config/entity_registry/list" });
    } catch (err) {
      console.error("Clever Caravan: entity registry fetch failed", err);
      return messageDashboard("Couldn't read the entity registry. Reload the page to retry.");
    }

    const cfg = findConfigState(hass, registry);
    if (!cfg) {
      return messageDashboard(
        "Clever Caravan is still initialising. Reload this page once **Clever Caravan: Dashboard** has finished starting."
      );
    }

    const attrs = cfg.attributes;
    const platforms = new Set([
      ...OWNED_PLATFORMS,
      ...(Array.isArray(attrs.owned_platforms) ? attrs.owned_platforms : []),
      ...(Array.isArray(attrs.extra_platforms) ? attrs.extra_platforms : []),
    ]);

    const cats = new Map();
    for (const e of registry) {
      if (!isUsable(hass, e)) continue;
      const labelled = (e.labels || []).some((l) => l.startsWith(LABEL_PREFIX));
      if (!platforms.has(e.platform) && !labelled) continue;
      const cat = classify(hass, e);
      if (!cat) continue;
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat).push(e);
    }

    if (!cats.size) {
      return messageDashboard("No devices found yet. Check the integration's settings on this unit.");
    }

    // Tier hook: premium-only views go here (attrs.tier === "premium").
    const base = "/" + (window.location.pathname.split("/")[1] || "lovelace");
    const views = [buildOverview(hass, cats, base)];
    for (const c of ORDER) if (cats.has(c)) views.push(buildSubview(hass, c, cats.get(c)));

    return { title: "Clever Caravan", views };
  }
}

customElements.define("ll-strategy-dashboard-clever-caravan", CleverCaravanStrategy);

window.customStrategies = window.customStrategies || [];
window.customStrategies.push({
  type: "clever-caravan",
  strategyType: "dashboard",
  name: "Clever Caravan",
  description: "Auto-generates the Clever Caravan dashboard from the unit's hardware and product tier.",
});
