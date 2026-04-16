from selenium.webdriver.remote.webdriver import WebDriver

from pages.base_page import BasePage
from utils.logger import get_logger

logger = get_logger("SuccessPage")


class SuccessPage(BasePage):
    """Page Object for the Velô Sprint order success / confirmation page."""

    def __init__(self, driver: WebDriver) -> None:
        super().__init__(driver)

    def get_status(self) -> str:
        """Return the order status text (e.g. 'Pedido Aprovado!')."""
        status = self.get_text_by_testid("success-status")
        logger.info(f"Order status: {status}")
        return status

    def get_order_id(self) -> str:
        """Return the displayed order ID (e.g. 'VLO-XXXXXX')."""
        order_id = self.get_text_by_testid("order-id")
        logger.info(f"Order ID: {order_id}")
        return order_id

    def is_approved(self) -> bool:
        """Check whether the order status contains 'Aprovado'."""
        approved = "Aprovado" in self.get_status()
        logger.info(f"Is approved: {approved}")
        return approved

    def click_lookup(self) -> None:
        """Click the 'Consultar Pedido' button."""
        logger.info("Clicking 'Consultar Pedido' button")
        self.click_by_testid("goto-consultar")

    def click_configure_another(self) -> None:
        """Click the 'Configurar Outro' button."""
        logger.info("Clicking 'Configurar Outro' button")
        self.click_by_testid("configure-another")
