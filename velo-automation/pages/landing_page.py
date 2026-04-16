from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver

from pages.base_page import BasePage
from utils.logger import get_logger

logger = get_logger("LandingPage")


class LandingPage(BasePage):
    """Page Object for the Velô Sprint landing page."""

    URL = "http://localhost:5173/"

    def __init__(self, driver: WebDriver) -> None:
        super().__init__(driver)

    def open_page(self) -> None:
        """Navigate to the landing page."""
        logger.info("Opening Landing Page")
        self.open(self.URL)

    def is_hero_visible(self) -> bool:
        """Check whether the hero section is visible."""
        logger.info("Checking if hero section is visible")
        return self.is_element_visible("hero-section")

    def click_configure_now(self) -> None:
        """Click the 'Configure Agora' CTA button in the hero section."""
        logger.info("Clicking 'Configure Agora' button")
        self.click_by_testid("hero-cta-primary")

    def click_header_configure(self) -> None:
        """Click the 'Configure o Seu' button in the header."""
        logger.info("Clicking 'Configure o Seu' header button")
        self.click_by_testid("header-cta")

    def go_to_lookup(self) -> None:
        """Click the 'Consultar Pedido' link in the header navigation."""
        logger.info("Clicking 'Consultar Pedido' link in header")
        nav = self.wait_for_element("header-nav")
        link = nav.find_element(By.TAG_NAME, "a")
        link.click()
