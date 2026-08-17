"""Constants for the Clever Caravan Dashboard integration."""

from __future__ import annotations

DOMAIN = "clever_caravan_dashboard"
VERSION = "0.1.0"

# Static HTTP mount point + filename for the bundled strategy module.
URL_BASE = "/clever_caravan_dashboard"
JS_FILENAME = "cc-dashboard.js"

# Config-sensor / options keys.
CONF_TIER = "tier"
CONF_ROLE_MAP = "role_map"

# Product tiers. In production the tier is fixed at provisioning; the selector
# in the options flow exists mainly for your own dev/testing.
TIER_BASE = "base"
TIER_PREMIUM = "premium"
TIERS = [TIER_BASE, TIER_PREMIUM]

# Platforms (integration domains) whose entities the strategy auto-resolves by
# translation_key. These are the entities you own and control the keys for.
OWNED_PLATFORMS = [
    "clever_caravan_power",
    "clever_caravan_tpms",
    "clever_caravan_location",
    "clever_caravan_weather",
]

# Logical roles the dashboard needs that are NOT owned (come from third-party
# integrations and can't be resolved automatically). Surfaced in the options
# flow for manual entity linking. Edit this list to match your real needs.
# NOTE: these are a STATIC list, so they DO get translated labels (unlike
# runtime-generated keys). Add matching entries under options.step.init.data
# in translations/en.json for each role you add here.
FOREIGN_ROLES = [
    "mains_power",
    "vehicle_battery",
]
