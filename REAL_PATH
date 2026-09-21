/**
 * Clever Caravan dashboard strategy (POC).
 *
 * Served + auto-loaded by the clever_caravan_dashboard integration. Registers
 * the strategy element and surfaces it under "Community dashboards" (2026.5+).
 *
 * POC behaviour:
 *  - Pulls the FULL entity registry over WebSocket (unique_id + platform are
 *    only exposed there, not in hass.entities).
 *  - One view per Clever Caravan integration that has live entities on this
 *    rig. Integrations with nothing present are skipped.
 *  - Inside each view, one section per device, one card per entity.
 *    Diagnostic/config, disabled and hidden entities are left out.
 *  - Power view gets a headline row (Battery / Solar / Shore Power) resolved
 *    by unique_id suffix, so it works on every rig regardless of portal ID.
 *  - Location view gets a map of its device_tracker entities.
 *
 * Final dashboard design replaces the per-integration views later; the
 * registry fetch and resolver stay.
 */

const OWNED_PLATFORMS = [
  "clever_caravan_power",
  "clever_caravan_tpms",
  "clever_caravan_safety_sam_tpms",
  "clever_caravan_location",
  "clever_caravan_weather",
  "clever_caravan_waymote",
];

const PLATFORM_META = {
  clever_caravan_power: { title: "Power", path: "power", icon: "mdi:lightning-bolt" },
  clever_caravan_tpms: { title: "TPMS", path: "tpms", icon: "mdi:car-tire-alert" },
  clever_caravan_safety_sam_tpms: { title: "Safety Sam", path: "safety-sam", icon: "mdi:tire" },
  clever_caravan_location: { title: "Location", path: "location", icon: "mdi:map-marker" },
  clever_caravan_weather: { title: "Weather", path: "weather", icon: "mdi:weather-partly-cloudy" },
  clever_caravan_waymote: { title: "Waymote", path: "waymote", icon: "mdi:remote" },
};

// role -> unique_id suffix on clever_caravan_power ({portal}_{key}_{instance})
const POWER_HEADLINE = [
  { role: "battery_soc", suffix: "_battery_soc_system", name: "Battery" },
  { role: "solar_power", suffix: "_pv_power_system", name: "Solar" },
  { role: "shore_power", suffix: "_shore_power_system", name: "Shore Power" },
];

/* ------------------------------------------------------------------ */
/* Registry helpers                                                    */
/* ------------------------------------------------------------------ */

async function fetchRegistry(hass) {
  return hass.callWS({ type: "config/entity_registry/list" });
}

function isUsable(hass, e) {
  return (
    !e.disabled_by &&
    !e.hidden_by &&
    !e.entity_category &&
    hass.states[e.entity_id] !== undefined
  );
}

function findConfigState(hass, registry) {
  const mine = registry.filter(
    (e) => e.platform === "clever_caravan_dashboard" && e.entity_id.startsWith("sensor.")
  );
  const entry =
    mine.find((e) => e.translation_key === "config") ||
    mine.find((e) => e.entity_id === "sensor.clever_caravan_dashboard_config") ||
    mine[0];
  return entry ? hass.states[entry.entity_id] : undefined;
}

function deviceName(hass, deviceId) {
  const d = deviceId && hass.devices ? hass.devices[deviceId] : undefined;
  return (d && (d.name_by_user || d.name)) || "Other";
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function cardFor(entityId, name) {
  const domain = entityId.split(".")[0];
  if (domain === "image" || domain === "camera") {
    return { type: "picture-entity", entity: entityId, show_state: false };
  }
  const card = { type: "tile", entity: entityId };
  if (name) card.name = name;
  return card;
}

function placeholder(name) {
  return { type: "markdown", content: `\u26a0\ufe0f Unresolved: **${name}**` };
}

function heading(text) {
  return { type: "heading", heading: text };
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function deviceSections(hass, entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = e.device_id || "_none";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  return [...groups.entries()]
    .map(([id, list]) => ({
      name: deviceName(hass, id === "_none" ? null : id),
      list: list.sort((a, b) => a.entity_id.localeCompare(b.entity_id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, list }) => ({
      type: "grid",
      cards: [heading(name), ...list.map((e) => cardFor(e.entity_id))],
    }));
}

function powerHeadline(entries, roleMap) {
  const used = new Set();
  const cards = POWER_HEADLINE.map(({ role, suffix, name }) => {
    if (roleMap[role]) return cardFor(roleMap[role], name);
    const hit = entries.find((e) => (e.unique_id || "").endsWith(suffix));
    if (!hit) return placeholder(name);
    used.add(hit.entity_id);
    return cardFor(hit.entity_id, name);
  });
  return { section: { type: "grid", cards: [heading("Overview"), ...cards] }, used };
}

function buildView(hass, platform, entries, ctx) {
  const meta = PLATFORM_META[platform] || {
    title: platform.replace("clever_caravan_", ""),
    path: platform.replace("clever_caravan_", "").replace(/_/g, "-"),
    icon: "mdi:caravan",
  };

  const sections = [];
  let rest = entries;

  if (platform === "clever_caravan_power") {
    const { section, used } = powerHeadline(entries, ctx.roleMap);
    sections.push(section);
    rest = entries.filter((e) => !used.has(e.entity_id));
  }

  if (platform === "clever_caravan_location") {
    const trackers = entries
      .filter((e) => e.entity_id.startsWith("device_tracker."))
      .map((e) => e.entity_id);
    if (trackers.length) {
      sections.push({
        type: "grid",
        cards: [heading("Map"), { type: "map", entities: trackers, default_zoom: 12 }],
      });
    }
  }

  sections.push(...deviceSections(hass, rest));

  return { title: meta.title, path: meta.path, icon: meta.icon, type: "sections", sections };
}

function messageDashboard(message) {
  return {
    title: "Clever Caravan",
    views: [{ title: "Clever Caravan", cards: [{ type: "markdown", content: message }] }],
  };
}

/* ------------------------------------------------------------------ */
/* Strategy                                                            */
/* ------------------------------------------------------------------ */

class CleverCaravanStrategy {
  static async generate(config, hass) {
    let registry;
    try {
      registry = await fetchRegistry(hass);
    } catch (err) {
      console.error("Clever Caravan: entity registry fetch failed", err);
      return messageDashboard("Couldn't read the entity registry. Reload the page to retry.");
    }

    const cfg = findConfigState(hass, registry);
    if (!cfg) {
      return messageDashboard(
        "Clever Caravan is still initialising. Reload this page once the " +
          "**Clever Caravan: Dashboard** integration has finished starting."
      );
    }

    const attrOwned = Array.isArray(cfg.attributes.owned_platforms)
      ? cfg.attributes.owned_platforms
      : [];
    const ctx = {
      tier: cfg.attributes.tier || "base",
      roleMap: cfg.attributes.role_map || {},
      owned: [...OWNED_PLATFORMS, ...attrOwned.filter((p) => !OWNED_PLATFORMS.includes(p))],
    };

    const views = [];
    for (const platform of ctx.owned) {
      const entries = registry.filter((e) => e.platform === platform && isUsable(hass, e));
      if (entries.length) views.push(buildView(hass, platform, entries, ctx));
    }

    // Tier-gated views go here (ctx.tier === "premium"). Hiding a view is UX,
    // not enforcement — premium entities must not exist on a base unit.

    if (!views.length) {
      return messageDashboard("No Clever Caravan integrations with live entities were found on this unit.");
    }

    return { title: "Clever Caravan", views };
  }
}

customElements.define("ll-strategy-dashboard-clever-caravan", CleverCaravanStrategy);

window.customStrategies = window.customStrategies || [];
window.customStrategies.push({
  type: "clever-caravan",
  strategyType: "dashboard",
  name: "Clever Caravan",
  description:
    "Auto-generates the Clever Caravan dashboard from the unit's hardware and product tier.",
});
