import pytest

from pages.landing_page import LandingPage


class TestLandingPage:
    """Tests for the Velô Sprint landing page."""

    def test_landing_page_loads(self, driver):
        """Verify the landing page loads, the title contains 'Velô', and
        the hero section is visible."""
        landing = LandingPage(driver)
        landing.open_page()

        assert "Velô" in driver.title or "Velo" in driver.title, (
            f"Expected page title to contain 'Velô' or 'Velo', got: {driver.title}"
        )
        assert landing.is_hero_visible(), "Hero section should be visible"

    def test_navigate_to_configurator(self, driver):
        """Click 'Configure Agora' and verify the URL changes to /configure."""
        landing = LandingPage(driver)
        landing.open_page()
        landing.click_configure_now()

        assert "/configure" in driver.current_url, (
            f"Expected URL to contain '/configure', got: {driver.current_url}"
        )

    def test_navigate_to_lookup(self, driver):
        """Click 'Consultar Pedido' in the header and verify the URL changes
        to /lookup."""
        landing = LandingPage(driver)
        landing.open_page()
        landing.go_to_lookup()

        assert "/lookup" in driver.current_url, (
            f"Expected URL to contain '/lookup', got: {driver.current_url}"
        )
