"""End-to-end checkout flow tests.

NOTE: The order submission calls the Supabase backend.  If Supabase is not
configured (or the Edge Function ``credit-analysis`` is not deployed), the
``test_complete_purchase_flow_avista`` test may fail at the submit step.
The form-validation test (``test_checkout_form_validation``) does NOT depend
on Supabase and should always pass.
"""

import time

import pytest

from pages.configurator_page import ConfiguratorPage
from pages.landing_page import LandingPage
from pages.order_page import OrderPage
from pages.success_page import SuccessPage


class TestCheckoutFlow:
    """End-to-end tests for the full purchase flow."""

    def test_complete_purchase_flow_avista(self, driver):
        """Full E2E flow: Landing -> Configure -> Checkout -> Success.

        NOTE: This test submits the order which requires a working Supabase
        backend.  If Supabase is not running, the test will fail at the
        submit step.  See ``test_checkout_form_fill_without_submit`` for a
        version that validates form filling only.
        """
        # 1. Landing page – click "Configure Agora"
        landing = LandingPage(driver)
        landing.open_page()
        landing.click_configure_now()

        # 2. Configurator – select options
        config = ConfiguratorPage(driver)
        config.select_color("midnight-black")
        config.select_wheel("sport")
        config.toggle_optional("precision-park")

        # 3. Navigate to checkout
        config.click_checkout()

        # 4. Fill checkout form
        order = OrderPage(driver)
        order.fill_complete_form(
            name="João",
            surname="Silva",
            email="joao@test.com",
            phone="(11) 99999-9999",
            cpf="123.456.789-00",
            store="Paulista",
        )
        order.select_payment_avista()
        order.accept_terms()

        # 5. Submit order
        order.submit_order()

        # 6. Verify success page
        time.sleep(3)  # wait for backend response and navigation
        success = SuccessPage(driver)
        status = success.get_status()
        assert status, "Expected a status message on the success page"

        order_id = success.get_order_id()
        assert order_id, "Expected an order ID to be displayed"

    def test_checkout_form_fill_without_submit(self, driver):
        """Validate that the checkout form can be completely filled without
        submitting (no Supabase dependency)."""
        # Navigate to configurator first to set up state
        config = ConfiguratorPage(driver)
        config.open_page()
        config.select_color("midnight-black")
        config.select_wheel("sport")
        config.toggle_optional("precision-park")
        config.click_checkout()

        # Fill all fields
        order = OrderPage(driver)
        order.fill_complete_form(
            name="Maria",
            surname="Santos",
            email="maria@test.com",
            phone="(11) 88888-8888",
            cpf="987.654.321-00",
            store="Faria Lima",
        )
        order.select_payment_avista()
        order.accept_terms()

        # Verify submit button is present and enabled
        submit_btn = order.find_element_by_testid("checkout-submit")
        assert submit_btn.is_enabled(), "Submit button should be enabled after filling the form"

    def test_checkout_form_validation(self, driver):
        """Navigate directly to /order and submit without filling any fields.
        Validation error messages should appear."""
        order = OrderPage(driver)
        order.open_page()

        # Click submit without filling anything
        order.submit_order()

        time.sleep(1)  # allow React state update

        assert order.has_validation_errors(), (
            "Expected validation error messages to be displayed"
        )
