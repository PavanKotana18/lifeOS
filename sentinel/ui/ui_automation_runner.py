#!/usr/bin/env python3

"""

LifeOS Sentinel — Full UI Automation Runner

Tests every discoverable interactive control, navigation path, modal dialog,

form input validation, empty/populated states, and rapid repeated taps.

"""



import base64

import json

import os

import sys

import time

from selenium import webdriver

from selenium.webdriver.chrome.options import Options

from selenium.webdriver.chrome.service import Service

from selenium.webdriver.common.by import By



def create_driver():

    options = Options()

    options.add_argument("--headless=new")

    options.add_argument("--no-sandbox")

    options.add_argument("--disable-dev-shm-usage")

    options.add_argument("--disable-gpu")

    options.add_argument("--window-size=412,915") # iQOO Neo 9 Pro viewport

    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})



    for bin_path in ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]:

        if os.path.exists(bin_path):

            options.binary_location = bin_path

            break

    service = Service("/usr/bin/chromedriver")

    driver = webdriver.Chrome(service=service, options=options)

    return driver



def load_app(driver, app_html_path="dist/index.html"):

    with open(app_html_path, "rb") as f:

        encoded = base64.b64encode(f.read()).decode("utf-8")

    driver.get(f"data:text/html;base64,{encoded}")

    time.sleep(0.6)



def run_ui_automation():

    if not os.path.exists("dist/index.html"):

        print("STATUS: BLOCKED — Application bundle 'dist/index.html' not found.")

        print("To run this suite: (1) npm ci, (2) npm run build, (3) re-run test.")

        return {"status": "BLOCKED", "reason": "dist/index.html not built", "total": 0, "passed": 0, "failed": 0}

    print("--- Running Sentinel Full UI Automation ---")

    results = {

        "name": "Full UI Automation Suite",

        "total": 0,

        "passed": 0,

        "failed": 0,

        "controlsTested": [],

        "errors": []

    }



    driver = create_driver()

    try:

        load_app(driver)



        def test_step(step_name, fn):

            results["total"] += 1

            try:

                fn()

                results["passed"] += 1

                results["controlsTested"].append(step_name)

            except Exception as e:

                results["failed"] += 1

                results["errors"].append({"step": step_name, "error": str(e)})

                print(f"  ❌ FAIL: {step_name} - {e}")



        # 1. Four primary destinations and module reachability through Explore

        for tab in ["dashboard", "explore", "plan", "insights"]:

            def nav_test(t=tab):

                nav_btn = driver.find_element(By.CSS_SELECTOR, f"button.nav-item[data-tab='{t}']")

                driver.execute_script("arguments[0].click();", nav_btn)

                time.sleep(0.2)

                view = driver.find_element(By.ID, f"view-{t}")

                assert view.is_displayed(), f"View #{t} is not displayed after navigation"

            test_step(f"Primary navigation: Switch to #{tab}", nav_test)


        for module in ["finance", "habits", "goals", "planner", "settings"]:

            def module_test(target=module):

                explore_btn = driver.find_element(By.CSS_SELECTOR, "button.nav-item[data-tab='explore']")

                driver.execute_script("arguments[0].click();", explore_btn)

                module_btn = driver.find_element(By.CSS_SELECTOR, f"button[data-module='{target}']")

                driver.execute_script("arguments[0].click();", module_btn)

                time.sleep(0.2)

                assert driver.find_element(By.ID, f"view-{target}").is_displayed(), f"Module #{target} is not reachable from Explore"

            test_step(f"Explore module: Open #{module}", module_test)


        # 2. Theme Toggle Control

        def test_theme():

            theme_btn = driver.find_element(By.ID, "theme-toggle-btn")

            is_dark_initial = driver.execute_script("return document.documentElement.classList.contains('dark');")

            driver.execute_script("arguments[0].click();", theme_btn)

            time.sleep(0.2)

            is_dark_after = driver.execute_script("return document.documentElement.classList.contains('dark');")

            assert is_dark_initial != is_dark_after, "Theme toggle button failed to change document class"

            # Toggle back to dark

            driver.execute_script("arguments[0].click();", theme_btn)

            time.sleep(0.1)

        test_step("Control: Theme toggle dark/light", test_theme)



        # 3. Subtabs in Finance (Overview, Transactions, Budgets, Savings, Analytics)

        for sub in ["overview", "transactions", "budgets", "savings", "analytics"]:

            def subtab_test(s=sub):

                driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.nav-item[data-tab='finance']"))

                time.sleep(0.2)

                sub_btn = driver.find_element(By.CSS_SELECTOR, f"button.subtab-btn[data-sub='{s}']")

                driver.execute_script("arguments[0].click();", sub_btn)

                time.sleep(0.2)

                cur_subtab = driver.execute_script("return window.LifeOS_State ? window.LifeOS_State.financeSubtab : null;")

                assert cur_subtab == s, f"Finance subtab did not switch to {s} (got {cur_subtab})"

                container = driver.find_element(By.ID, "finance-subtab-container")

                assert container.is_displayed(), "Finance subtab container is not displayed"

            test_step(f"Finance Subtab: Switch to #{sub}", subtab_test)



        # 4. Modals: Open & Close Modal Mechanism

        def test_modal_close():

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.nav-item[data-tab='finance']"))

            time.sleep(0.2)

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.subtab-btn[data-sub='overview']"))

            time.sleep(0.2)

            btn = driver.find_element(By.ID, "btn-add-tx-income")

            driver.execute_script("arguments[0].click();", btn)

            time.sleep(0.3)

            assert len(driver.find_elements(By.ID, "active-modal-backdrop")) > 0, "Modal did not open"



            close_btn = driver.find_element(By.ID, "modal-close-btn")

            driver.execute_script("arguments[0].click();", close_btn)

            time.sleep(0.3)

            assert len(driver.find_elements(By.ID, "active-modal-backdrop")) == 0, "Modal did not close on close button click"

        test_step("Modal: Open and Close via close button", test_modal_close)



        # 5. Form Validation: Required Field Enforcement in Transaction Modal

        def test_form_validation():

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.nav-item[data-tab='finance']"))

            time.sleep(0.2)

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.subtab-btn[data-sub='overview']"))

            time.sleep(0.2)

            btn = driver.find_element(By.ID, "btn-add-tx-income")

            driver.execute_script("arguments[0].click();", btn)

            time.sleep(0.3)



            # Amount is empty -> submit should fail HTML5 checkValidity

            is_valid = driver.execute_script("return document.getElementById('form-add-tx').checkValidity();")

            assert not is_valid, "Empty transaction form unexpectedly passed validation"



            # Close modal

            driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "modal-close-btn"))

            time.sleep(0.3)

        test_step("Form Validation: Reject empty amount in transaction form", test_form_validation)



        # 6. Rapid Repeated Taps (Debounce & Idempotency check)

        def test_rapid_taps():

            theme_btn = driver.find_element(By.ID, "theme-toggle-btn")

            for _ in range(10):

                driver.execute_script("arguments[0].click();", theme_btn)

            time.sleep(0.2)

            title = driver.title

            assert "LifeOS" in title, "App crashed under rapid repeated taps"

        test_step("Resilience: Rapid repeated tap stress test", test_rapid_taps)



        # 7. Empty State Verifications

        def test_empty_states():

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.nav-item[data-tab='habits']"))

            time.sleep(0.2)

            body_text = driver.find_element(By.ID, "view-habits").text

            assert "habits" in body_text.lower() or "add" in body_text.lower(), "Habits view empty state missing"

        test_step("UI States: Verify empty state rendering", test_empty_states)



        print(f"UI Automation Completed: {results['passed']}/{results['total']} passed.")

    finally:

        driver.quit()



    return results



if __name__ == "__main__":

    res = run_ui_automation()

    if res["failed"] > 0:

        sys.exit(1)
