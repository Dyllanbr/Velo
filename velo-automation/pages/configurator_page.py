from selenium.webdriver.remote.webdriver import WebDriver

from pages.base_page import BasePage
from utils.logger import get_logger

logger = get_logger("ConfiguratorPage")


class ConfiguratorPage(BasePage):
    """Page Object for the Velô Sprint configurator page."""

    URL = "http://localhost:5173/configure"

    def __init__(self, driver: WebDriver) -> None:
        super().__init__(driver)

    def open_page(self) -> None:
        """Navigate to the configurator page."""
        logger.info("Opening Configurator Page")
        self.open(self.URL)

    def select_color(self, color_id: str) -> None:
        """Select a color by its identifier.

        Valid values: ``glacier-blue``, ``midnight-black``, ``lunar-white``
        """
        testid = f"color-option-{color_id}"
        logger.info(f"Selecting color: {color_id}")
        self.click_by_testid(testid)

    def select_wheel(self, wheel_type: str) -> None:
        """Select a wheel type.

        Valid values: ``aero``, ``sport``
        """
        testid = f"wheel-option-{wheel_type}"
        logger.info(f"Selecting wheel: {wheel_type}")
        self.click_by_testid(testid)

    def toggle_optional(self, optional_id: str) -> None:
        """Toggle an optional feature.

        Valid values: ``precision-park``, ``flux-capacitor``
        """
        testid = f"opt-{optional_id}"
        logger.info(f"Toggling optional: {optional_id}")
        self.click_by_testid(testid)

    def get_total_price(self) -> str:
        """Return the displayed total price text."""
        price = self.get_text_by_testid("total-price")
        logger.info(f"Total price: {price}")
        return price

    def click_checkout(self) -> None:
        """Click the 'Monte o Seu' button to proceed to checkout."""
        logger.info("Clicking 'Monte o Seu' (checkout) button")
        self.click_by_testid("checkout-button")
