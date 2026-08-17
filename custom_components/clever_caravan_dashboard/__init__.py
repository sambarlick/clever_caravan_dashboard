"""The Clever Caravan Dashboard integration.

Serves the bundled dashboard *strategy* and registers it as a Lovelace **module
resource**. Community dashboard strategies must be loaded as a resource before
Home Assistant will show and instantiate them in the new-dashboard dialog;
add_extra_js_url is not reliable for that, so we register a real resource (the
same mechanism custom cards use).

Auto-registration only works in Lovelace *storage* mode. In YAML mode the user
must add the resource themselves; we log the exact URL to use.
"""

from __future__ import annotations

import logging
from functools import partial
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

from .const import DOMAIN, JS_FILENAME, URL_BASE, VERSION

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

# Served path (no query) and the versioned URL we register as a resource.
_RESOURCE_URL = f"{URL_BASE}/{JS_FILENAME}"
_RESOURCE_FULL = f"{_RESOURCE_URL}?v={VERSION}"

# Process-global guards (survive config-entry reloads).
_STATIC_KEY = f"{DOMAIN}_static_registered"
_RESOURCE_KEY = f"{DOMAIN}_resource_registered"
_RETRY_KEY = f"{DOMAIN}_resource_retries"
_MAX_RETRIES = 12  # ~1 min of 5s retries while Lovelace warms up


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Clever Caravan Dashboard from a config entry."""
    await _async_register_static(hass)
    await _async_register_resource(hass)

    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry.

    The served path and the Lovelace resource intentionally persist for the life
    of the HA process; removing the resource on every reload would fight the
    dashboard. They are idempotent on the next setup.
    """
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload so the config sensor reflects new options (tier / links)."""
    await hass.config_entries.async_reload(entry.entry_id)


async def _async_register_static(hass: HomeAssistant) -> None:
    """Serve the bundled JS module once per HA run."""
    if hass.data.get(_STATIC_KEY):
        return

    js_path = Path(__file__).parent / "frontend" / "dist" / JS_FILENAME
    await hass.http.async_register_static_paths(
        [StaticPathConfig(_RESOURCE_URL, str(js_path), cache_headers=False)]
    )
    hass.data[_STATIC_KEY] = True
    _LOGGER.debug("Serving Clever Caravan dashboard module at %s", _RESOURCE_URL)


async def _async_register_resource(hass: HomeAssistant, _now=None) -> None:
    """Register the module as a Lovelace resource (storage mode, idempotent)."""
    if hass.data.get(_RESOURCE_KEY):
        return

    lovelace = hass.data.get("lovelace")
    resources = _resources_of(lovelace)
    mode = _mode_of(lovelace)

    # Lovelace not ready yet -> retry shortly (bounded).
    if lovelace is None or resources is None:
        _schedule_retry(hass)
        return

    if mode != "storage":
        _LOGGER.warning(
            "Lovelace is in '%s' mode, so the dashboard resource can't be "
            "auto-registered. Add it manually under Settings -> Dashboards -> "
            "Resources: URL '%s', type 'JavaScript Module'.",
            mode,
            _RESOURCE_FULL,
        )
        hass.data[_RESOURCE_KEY] = True  # nothing more we can do; stop retrying
        return

    # Make sure the resource collection is loaded before we read/write it.
    if hasattr(resources, "loaded") and not resources.loaded:
        await resources.async_load()
        resources.loaded = True

    # Already present? Update only if the version query changed.
    for item in resources.async_items():
        if item.get("url", "").split("?")[0] == _RESOURCE_URL:
            if item["url"] != _RESOURCE_FULL:
                await resources.async_update_item(
                    item["id"], {"res_type": "module", "url": _RESOURCE_FULL}
                )
                _LOGGER.debug("Updated Clever Caravan dashboard resource")
            hass.data[_RESOURCE_KEY] = True
            return

    await resources.async_create_item(
        {"res_type": "module", "url": _RESOURCE_FULL}
    )
    hass.data[_RESOURCE_KEY] = True
    _LOGGER.info("Registered Clever Caravan dashboard resource: %s", _RESOURCE_FULL)


def _resources_of(lovelace):
    """Return the resources collection across old dict / new dataclass shapes."""
    if lovelace is None:
        return None
    resources = getattr(lovelace, "resources", None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    return resources


def _mode_of(lovelace):
    """Return the lovelace mode across old dict / new dataclass shapes."""
    if lovelace is None:
        return None
    mode = getattr(lovelace, "mode", None)
    if mode is None and isinstance(lovelace, dict):
        mode = lovelace.get("mode")
    return mode


def _schedule_retry(hass: HomeAssistant) -> None:
    """Retry resource registration once Lovelace has warmed up."""
    tries = hass.data.get(_RETRY_KEY, 0)
    if tries >= _MAX_RETRIES:
        _LOGGER.error(
            "Gave up auto-registering the dashboard resource. Add it manually "
            "under Settings -> Dashboards -> Resources: URL '%s', type "
            "'JavaScript Module'.",
            _RESOURCE_FULL,
        )
        return
    hass.data[_RETRY_KEY] = tries + 1
    async_call_later(hass, 5, partial(_async_register_resource, hass))
