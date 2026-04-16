import os
import shutil

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


def _find_chrome_binary():
    """Locate a working Chrome / Chromium binary on the system."""
    candidates = [
        # Chrome for Testing installed by CI / dev environments
        "/opt/.devin/chrome/chrome/linux-133.0.6943.126/chrome-linux64/chrome",
        "/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome",
        # Playwright's bundled Chromium
        "/opt/.devin/playwright_browsers/chromium-1097/chrome-linux/chrome",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path

    # Fallback to whatever is on PATH
    for name in ("google-chrome", "chromium-browser", "chromium", "chrome"):
        found = shutil.which(name)
        if found:
            return found

    return None


def _find_chromedriver():
    """Locate a pre-installed chromedriver binary."""
    candidate = "/tmp/chromedriver_install/chromedriver-linux64/chromedriver"
    if os.path.isfile(candidate):
        return candidate
    found = shutil.which("chromedriver")
    return found


@pytest.fixture
def driver():
    """Create a Chrome WebDriver instance for each test.

    Set the environment variable ``HEADLESS=false`` to run with a visible
    browser window (useful for local debugging).  The default is headless.
    """
    options = Options()

    # Use a real Chrome binary if available
    chrome_bin = _find_chrome_binary()
    if chrome_bin:
        options.binary_location = chrome_bin

    headless = os.environ.get("HEADLESS", "true").lower() != "false"
    if headless:
        options.add_argument("--headless=new")

    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-gpu")

    # Use pre-installed chromedriver if available, otherwise fall back to
    # webdriver-manager which downloads a matching version automatically.
    chromedriver_path = _find_chromedriver()
    if chromedriver_path:
        service = Service(chromedriver_path)
    else:
        service = Service(ChromeDriverManager().install())

    driver = webdriver.Chrome(service=service, options=options)
    driver.implicitly_wait(10)
    yield driver
    driver.quit()
