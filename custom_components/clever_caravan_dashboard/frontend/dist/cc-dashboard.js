/**
 * Clever Caravan dashboard strategy.
 *
 * Served + auto-loaded by the clever_caravan_dashboard integration. Once the
 * resource is loaded, this file (a) registers the strategy custom element and
 * (b) pushes metadata so it appears under "Community dashboards" in the
 * New-dashboard dialog (HA 2026.5+).
 *
 * It reads tier + role map from the integration's config sensor, then builds
 * the dashboard from whatever hardware the unit actually reports.
 *
 * ---------------------------------------------------------------------------
 * ADAPT ME: role tokens below (battery_soc, solar_power, ...) must match the
 * `translation_key` you set on the corresponding entities in your own
 * integrations (clever_caravan_power, etc.). translation_key is used because,
 * unlike unique_id, it IS exposed in the frontend entity registry and is
 * rename-proof. Foreign entities are resolved via the options-flow role map.
 * ---------------------------------------------------------------------------
 */

const OWNED_FALLBACK = [
  "clever_caravan_power",
  "clever_caravan_tpms",
  "clever_caravan_location",
  "clever_caravan_weather",
];

/** Find the integration's config sensor by platform + translation_key. */
function findConfigState(hass) {
  const registry = hass.entities || {};
  const entry = Object.values(registry).find(
    (e) =>
      e.platform === "clever_caravan_dashboard" &&
      e.translation_key === "config"
  );
  return entry ? hass.states[entry.entity_id] : undefined;
}

/**
 * Resolve a logical role to an entity_id.
 *  1. explicit link from the options-flow role map wins (foreign entities)
 *  2. otherwise match an owned entity by platform + translation_key
 * Returns undefined if nothing matches.
 */
function resolveRole(hass, ownedPlatforms, roleMap, role) {
  if (roleMap && roleMap[role]) return roleMap[role];

  const registry = hass.entities || {};
  const owned = Object.values(registry).find(
    (e) =>
      ownedPlatforms.includes(e.platform) && e.translation_key === role
  );
  return owned ? owned.entity_id : undefined;
}

/** Tile card, or a visible placeholder if the role didn't resolve. */
function tile(entity, name) {
  if (entity) {
    const card = { type: "tile", entity };
    if (name) card.name = name;
    return card;
  }
  return {
    type: "markdown",
    content: `\u26a0\ufe0f Unresolved: **${name || "entity"}**`,
  };
}

function buildPowerView(hass, ctx) {
  const r = (role) => resolveRole(hass, ctx.owned, ctx.roleMap, role);
  return {
    title: "Power",
    path: "power",
    icon: "mdi:lightning-bolt",
    type: "sections",
    sections: [
      {
        type: "grid",
        cards: [
          tile(r("battery_soc"), "Battery"),
          tile(r("solar_power"), "Solar"),
          tile(r("mains_power"), "Mains"),
        ],
      },
    ],
  };
}

function buildFridgeView(hass, ctx) {
  const r = (role) => resolveRole(hass, ctx.owned, ctx.roleMap, role);
  return {
    title: "Fridge",
    path: "fridge",
    icon: "mdi:fridge",
    type: "sections",
    sections: [
      { type: "grid", cards: [tile(r("fridge_temperature"), "Fridge")] },
    ],
  };
}

function loadingDashboard(message) {
  return {
    title: "Clever Caravan",
    views: [
      {
        title: "Clever Caravan",
        cards: [{ type: "markdown", content: message }],
      },
    ],
  };
}

class CleverCaravanStrategy {
  static async generate(config, hass) {
    const cfg = findConfigState(hass);

    if (!cfg) {
      return loadingDashboard(
        "Clever Caravan is still initialising. Reload this page once the " +
          "**Clever Caravan Dashboard** integration has finished starting."
      );
    }

    const ctx = {
      tier: cfg.attributes.tier || "base",
      roleMap: cfg.attributes.role_map || {},
      owned: cfg.attributes.owned_platforms || OWNED_FALLBACK,
    };

    // Base views everyone gets.
    const views = [buildPowerView(hass, ctx)];

    // Tier-gated views. NB: hiding a view is UX, not enforcement — a premium
    // feature must also not exist as a live entity on a base unit.
    if (ctx.tier === "premium") {
      views.push(buildFridgeView(hass, ctx));
    }

    return { title: "Clever Caravan", views };
  }
}

customElements.define(
  "ll-strategy-dashboard-clever-caravan",
  CleverCaravanStrategy
);

// Surface in the New-dashboard "Community dashboards" section (HA 2026.5+).
window.customStrategies = window.customStrategies || [];
window.customStrategies.push({
  type: "clever-caravan",
  strategyType: "dashboard",
  name: "Clever Caravan",
  description:
    "Auto-generates the Clever Caravan dashboard from the unit's hardware and product tier.",
});
