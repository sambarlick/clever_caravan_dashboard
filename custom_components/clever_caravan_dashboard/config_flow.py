# Copyright (c) 2026 Samuel Myers. All rights reserved.
# Proprietary - see LICENSE. Unauthorised use, copying, or distribution prohibited.

"""Config and options flow for Clever Caravan Dashboard."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_ROLE_MAP,
    CONF_TIER,
    DOMAIN,
    FOREIGN_ROLES,
    TIER_BASE,
    TIERS,
)


class CleverCaravanDashboardConfigFlow(ConfigFlow, domain=DOMAIN):
    """Single-instance setup flow."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(
                title="Clever Caravan Dashboard", data={}
            )

        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: ConfigEntry,
    ) -> OptionsFlow:
        """Return the options flow."""
        return CleverCaravanDashboardOptionsFlow()


class CleverCaravanDashboardOptionsFlow(OptionsFlow):
    """Tier selection + manual linking of foreign entities.

    Note: no __init__ / self.config_entry assignment. The framework provides
    self.config_entry; setting it manually is deprecated in current HA.
    """

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage the options."""
        options = dict(self.config_entry.options)
        role_map: dict[str, str] = dict(options.get(CONF_ROLE_MAP, {}))

        if user_input is not None:
            new_role_map = {
                role: user_input[role]
                for role in FOREIGN_ROLES
                if user_input.get(role)
            }
            return self.async_create_entry(
                data={
                    CONF_TIER: user_input[CONF_TIER],
                    CONF_ROLE_MAP: new_role_map,
                },
            )

        schema_dict: dict[Any, Any] = {
            vol.Required(
                CONF_TIER, default=options.get(CONF_TIER, TIER_BASE)
            ): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=TIERS,
                    translation_key="tier",
                    mode=selector.SelectSelectorMode.DROPDOWN,
                )
            ),
        }

        for role in FOREIGN_ROLES:
            existing = role_map.get(role)
            marker = (
                vol.Optional(role, description={"suggested_value": existing})
                if existing
                else vol.Optional(role)
            )
            schema_dict[marker] = selector.EntitySelector(
                selector.EntitySelectorConfig()
            )

        return self.async_show_form(
            step_id="init", data_schema=vol.Schema(schema_dict)
        )
