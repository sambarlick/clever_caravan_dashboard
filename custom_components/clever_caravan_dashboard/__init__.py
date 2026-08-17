"""The Clever Caravan Dashboard integration.

Serves and auto-loads a bundled dashboard *strategy* (frontend JS). The strategy
self-registers into the 2026.5+ "Community dashboards" picker, so provisioning a
unit is: install this integration -> add the "Clever Caravan" dashboard once.

The strategy reads tier + role map from a config sensor exposed by this
integration (see sensor.py), so an upgrade is a config flip, not a redeploy.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import DOMAIN, JS_FILENAME, URL_BASE, VERSION

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

# Guard so the frontend module is served/loaded once per HA run, even across
# config-entry reloads (add_extra_js_url is process-global, not per-entry).
_FRONTEND_KEY = f"{DOMAIN}_frontend_registered"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Clever Caravan Dashboard from a config entry."""
    await _async_register_frontend(hass)

    # Re-render the config sensor's attributes when options change (tier / links).
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # The served static path + extra_js_url intentionally persist for the life
    # of the HA process; there is no public API to unregister them, and leaving
    # them costs nothing. They are re-guarded on the next setup.
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload the entry so the config sensor reflects new options."""
    await hass.config_entries.async_reload(entry.entry_id)


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled JS and load it on every frontend page."""
    if hass.data.get(_FRONTEND_KEY):
        return

    js_path = Path(__file__).parent / "frontend" / "dist" / JS_FILENAME
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                f"{URL_BASE}/{JS_FILENAME}",
                str(js_path),
                # No caching: field units should pick up a new strategy on the
                # next load after a version bump.
                cache_headers=False,
            )
        ]
    )

    # ?v= busts any intermediary cache when the integration version changes.
    frontend.add_extra_js_url(hass, f"{URL_BASE}/{JS_FILENAME}?v={VERSION}")

    hass.data[_FRONTEND_KEY] = True
    _LOGGER.debug("Registered Clever Caravan dashboard frontend module")
