from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import BasePage
from utils.logger import get_logger

logger = get_logger("LookupPage")


class LookupPage(BasePage):
    """Page Object for the Velô Sprint order lookup page."""

    URL = "http://localhost:5173/lookup"

    def __init__(self, driver: WebDriver) -> None:
        super().__init__(driver)

    def open_page(self) -> None:
        """Navigate to the lookup page."""
        logger.info("Opening Lookup Page")
        self.open(self.URL)

    def search_order(self, order_number: str) -> None:
        """Type an order number and click the search button."""
        logger.info(f"Searching for order: {order_number}")
        self.type_text("search-order-id", order_number)
        self.click_by_testid("search-order-button")

    def is_order_found(self) -> bool:
        """Check whether an order result card is displayed."""
        try:
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "[data-testid^='order-result-']")
                )
            )
            logger.info("Order found")
            return True
        except Exception:
            logger.info("Order NOT found (no result card)")
            return False

    def is_order_not_found(self) -> bool:
        """Check whether the 'Pedido nao encontrado' message is displayed."""
        try:
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//*[contains(text(), 'Pedido não encontrado')]")
                )
            )
            logger.info("'Pedido nao encontrado' message is visible")
            return True
        except Exception:
            logger.info("'Pedido nao encontrado' message is NOT visible")
            return False

    def get_order_status(self) -> str:
        """Return the status text shown in the order result card."""
        result_card = self.driver.find_element(
            By.CSS_SELECTOR, "[data-testid^='order-result-']"
        )
        # The status badge is a div with flex items-center gap-2 containing
        # the status text (APROVADO, REPROVADO, etc.)
        status_badge = result_card.find_element(
            By.CSS_SELECTOR, ".rounded-full.font-medium"
        )
        status = status_badge.text.strip()
        logger.info(f"Order status from lookup: {status}")
        return status

    def is_search_button_disabled(self) -> bool:
        """Check whether the search button is disabled."""
        button = self.find_element_by_testid("search-order-button")
        disabled = not button.is_enabled()
        logger.info(f"Search button disabled: {disabled}")
        return disabled
