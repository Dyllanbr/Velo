import time

import pytest
from selenium.webdriver.common.by import By

from pages.lookup_page import LookupPage


class TestOrderLookup:
    """Tests for the Velô Sprint order lookup page."""

    def test_lookup_page_loads(self, driver):
        """Verify the lookup page loads and the heading 'Consultar Pedido'
        is visible."""
        lookup = LookupPage(driver)
        lookup.open_page()

        heading = driver.find_element(By.XPATH, "//*[contains(text(), 'Consultar Pedido')]")
        assert heading.is_displayed(), "Heading 'Consultar Pedido' should be visible"

    def test_search_nonexistent_order(self, driver):
        """Search for 'VLO-INVALIDO' and verify the 'Pedido nao encontrado'
        message appears."""
        lookup = LookupPage(driver)
        lookup.open_page()
        lookup.search_order("VLO-INVALIDO")

        assert lookup.is_order_not_found(), (
            "Expected 'Pedido nao encontrado' message for invalid order"
        )

    def test_search_empty_disabled(self, driver):
        """Verify the search button is disabled when the input field is
        empty."""
        lookup = LookupPage(driver)
        lookup.open_page()

        # Give the page a moment to fully render
        time.sleep(1)

        assert lookup.is_search_button_disabled(), (
            "Search button should be disabled when the input is empty"
        )
