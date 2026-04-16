from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from utils.logger import get_logger

logger = get_logger("BasePage")


class BasePage:
    """Base class for all page objects. Provides common interaction methods."""

    def __init__(self, driver: WebDriver) -> None:
        self.driver = driver

    def open(self, url: str) -> None:
        """Navigate to the given URL."""
        logger.info(f"Navigating to: {url}")
        self.driver.get(url)

    def find_element_by_testid(self, testid: str) -> WebElement:
        """Locate an element by its data-testid attribute."""
        logger.debug(f"Finding element with data-testid='{testid}'")
        return self.driver.find_element(
            By.CSS_SELECTOR, f'[data-testid="{testid}"]'
        )

    def click_by_testid(self, testid: str) -> None:
        """Click on an element identified by data-testid."""
        logger.info(f"Clicking element with data-testid='{testid}'")
        element = self.wait_for_element(testid)
        element.click()

    def type_text(self, testid: str, text: str) -> None:
        """Clear and type text into an input identified by data-testid."""
        logger.info(f"Typing into data-testid='{testid}': '{text}'")
        element = self.wait_for_element(testid)
        element.clear()
        element.send_keys(text)

    def wait_for_element(self, testid: str, timeout: int = 10) -> WebElement:
        """Wait for an element with the given data-testid to be present."""
        logger.debug(
            f"Waiting for element with data-testid='{testid}' (timeout={timeout}s)"
        )
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, f'[data-testid="{testid}"]')
            )
        )

    def wait_for_element_clickable(
        self, testid: str, timeout: int = 10
    ) -> WebElement:
        """Wait for an element with the given data-testid to be clickable."""
        logger.debug(
            f"Waiting for clickable element with data-testid='{testid}' "
            f"(timeout={timeout}s)"
        )
        return WebDriverWait(self.driver, timeout).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, f'[data-testid="{testid}"]')
            )
        )

    def get_text_by_testid(self, testid: str) -> str:
        """Return the visible text of an element identified by data-testid."""
        element = self.wait_for_element(testid)
        text = element.text
        logger.info(f"Text from data-testid='{testid}': '{text}'")
        return text

    def is_element_visible(self, testid: str, timeout: int = 5) -> bool:
        """Check whether an element with the given data-testid is visible."""
        try:
            WebDriverWait(self.driver, timeout).until(
                EC.visibility_of_element_located(
                    (By.CSS_SELECTOR, f'[data-testid="{testid}"]')
                )
            )
            logger.info(f"Element data-testid='{testid}' is visible")
            return True
        except Exception:
            logger.info(f"Element data-testid='{testid}' is NOT visible")
            return False
