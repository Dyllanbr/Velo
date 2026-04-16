import time

from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from pages.base_page import BasePage
from utils.logger import get_logger

logger = get_logger("OrderPage")


class OrderPage(BasePage):
    """Page Object for the Velô Sprint checkout / order page."""

    URL = "http://localhost:5173/order"

    def __init__(self, driver: WebDriver) -> None:
        super().__init__(driver)

    def open_page(self) -> None:
        """Navigate to the order page."""
        logger.info("Opening Order Page")
        self.open(self.URL)

    def fill_name(self, name: str) -> None:
        """Fill the customer first name field."""
        logger.info(f"Filling name: {name}")
        self.type_text("checkout-name", name)

    def fill_surname(self, surname: str) -> None:
        """Fill the customer surname field."""
        logger.info(f"Filling surname: {surname}")
        self.type_text("checkout-surname", surname)

    def fill_email(self, email: str) -> None:
        """Fill the customer email field."""
        logger.info(f"Filling email: {email}")
        self.type_text("checkout-email", email)

    def fill_phone(self, phone: str) -> None:
        """Fill the customer phone field."""
        logger.info(f"Filling phone: {phone}")
        self.type_text("checkout-phone", phone)

    def fill_cpf(self, cpf: str) -> None:
        """Fill the customer CPF field."""
        logger.info(f"Filling CPF: {cpf}")
        self.type_text("checkout-cpf", cpf)

    def select_store(self, store_name: str) -> None:
        """Select a store from the shadcn/ui Select component.

        This component is NOT a native ``<select>`` — it renders as a Radix
        popover.  The interaction is:
        1. Click on the SelectTrigger (``[data-testid="checkout-store"]``)
        2. Wait for the SelectContent popover to appear
        3. Click the SelectItem whose visible text matches *store_name*
        """
        logger.info(f"Selecting store: {store_name}")

        # Step 1 – open the dropdown
        self.click_by_testid("checkout-store")
        time.sleep(0.5)  # allow popover animation

        # Step 2 – wait for options to be visible and click the matching one
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "[role='option']")
            )
        )

        # Step 3 – find the option whose text (or child text) contains
        # the store name.  Radix puts the label in a child <span>, so we
        # use ``contains(., ...)`` which checks descendant text as well.
        option = WebDriverWait(self.driver, 10).until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    f"//div[@role='option' and contains(., '{store_name}')]",
                )
            )
        )
        option.click()
        logger.info(f"Store selected: {store_name}")

    def select_payment_avista(self) -> None:
        """Select the 'À Vista' payment method."""
        logger.info("Selecting payment: À Vista")
        self.click_by_testid("payment-avista")

    def select_payment_financiamento(self) -> None:
        """Select the 'Financiamento' payment method."""
        logger.info("Selecting payment: Financiamento")
        self.click_by_testid("payment-financiamento")

    def fill_entry_value(self, value: str) -> None:
        """Fill the down-payment (entry) value field.

        This field is only visible when 'Financiamento' is selected.
        """
        logger.info(f"Filling entry value: {value}")
        self.type_text("input-entry-value", value)

    def accept_terms(self) -> None:
        """Check the terms-and-conditions checkbox (Radix Checkbox)."""
        logger.info("Accepting terms and conditions")
        self.click_by_testid("checkout-terms")

    def submit_order(self) -> None:
        """Click the 'Confirmar Pedido' submit button."""
        logger.info("Submitting order")
        self.click_by_testid("checkout-submit")

    def fill_complete_form(
        self,
        name: str,
        surname: str,
        email: str,
        phone: str,
        cpf: str,
        store: str,
    ) -> None:
        """Helper that fills every field in the checkout form at once."""
        self.fill_name(name)
        self.fill_surname(surname)
        self.fill_email(email)
        self.fill_phone(phone)
        self.fill_cpf(cpf)
        self.select_store(store)

    def has_validation_errors(self) -> bool:
        """Check whether any validation error messages are displayed."""
        logger.info("Checking for validation error messages")
        errors = self.driver.find_elements(
            By.CSS_SELECTOR, ".text-destructive"
        )
        has_errors = len(errors) > 0
        logger.info(f"Validation errors present: {has_errors}")
        return has_errors
