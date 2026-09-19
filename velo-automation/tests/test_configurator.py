import pytest
from selenium.webdriver.common.by import By

from pages.configurator_page import ConfiguratorPage


class TestConfiguratorPage:
    """Tests for the Velô Sprint configurator page."""

    def test_default_configuration(self, driver):
        """Verify the base price is R$ 40.000,00 on initial load."""
        config = ConfiguratorPage(driver)
        config.open_page()

        price = config.get_total_price()
        assert "40.000" in price, (
            f"Expected base price to contain '40.000', got: {price}"
        )

    def test_select_sport_wheels(self, driver):
        """Select Sport Wheels and verify the price updates to R$ 42.000,00."""
        config = ConfiguratorPage(driver)
        config.open_page()

        config.select_wheel("sport")
        price = config.get_total_price()
        assert "42.000" in price, (
            f"Expected price with Sport Wheels to contain '42.000', got: {price}"
        )

    def test_select_color(self, driver):
        """Select Midnight Black and verify the swatch becomes selected."""
        config = ConfiguratorPage(driver)
        config.open_page()

        config.select_color("midnight-black")
        swatch = config.find_element_by_testid("color-option-midnight-black")
        # When selected the ColorSwatch button's inner div gets a ring class
        inner_div = swatch.find_element(By.CSS_SELECTOR, "div")
        classes = inner_div.get_attribute("class") or ""
        assert "ring-primary" in classes, (
            f"Expected the Midnight Black swatch to have 'ring-primary' class, "
            f"got: {classes}"
        )

    def test_add_optionals(self, driver):
        """Add Precision Park (+R$ 5.500) and Flux Capacitor (+R$ 5.000) and
        Sport Wheels (+R$ 2.000).  Total should be R$ 52.500,00."""
        config = ConfiguratorPage(driver)
        config.open_page()

        config.select_wheel("sport")
        config.toggle_optional("precision-park")
        config.toggle_optional("flux-capacitor")

        price = config.get_total_price()
        assert "52.500" in price, (
            f"Expected total to contain '52.500', got: {price}"
        )

    def test_navigate_to_checkout(self, driver):
        """Configure the vehicle and click 'Monte o Seu' to navigate to
        /order."""
        config = ConfiguratorPage(driver)
        config.open_page()

        config.select_color("midnight-black")
        config.select_wheel("sport")
        config.click_checkout()

        assert "/order" in driver.current_url, (
            f"Expected URL to contain '/order', got: {driver.current_url}"
        )
