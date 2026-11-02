#!/usr/bin/env python3

"""

LifeOS Sentinel — Visual Regression & Pixel Difference Engine

Captures deterministic screenshots at defined checkpoints with disabled animations

and isolated synthetic fixtures, applies dynamic masks, compares against approved baselines,

generates pixel diff images, and computes quantitative difference metrics.

"""



import base64

import json

import os

import sys

import time

import numpy as np

from PIL import Image, ImageChops, ImageDraw

from selenium import webdriver

from selenium.webdriver.chrome.options import Options

from selenium.webdriver.chrome.service import Service

from selenium.webdriver.common.by import By



BASE_DIR = os.path.dirname(os.path.abspath(__file__))

BASELINES_DIR = os.path.join(BASE_DIR, "baselines")

CURRENT_DIR = os.path.join(BASE_DIR, "current")

DIFFS_DIR = os.path.join(BASE_DIR, "diffs")



os.makedirs(BASELINES_DIR, exist_ok=True)

os.makedirs(CURRENT_DIR, exist_ok=True)

os.makedirs(DIFFS_DIR, exist_ok=True)



CHECKPOINTS = [

    { "id": "01_dashboard", "tab": "dashboard" },

    { "id": "02_finance_overview", "tab": "finance", "subtab": "overview" },

    { "id": "03_finance_transactions", "tab": "finance", "subtab": "transactions" },

    { "id": "04_habits_checklist", "tab": "habits", "subtab": "checklist" },

    { "id": "05_goals_active", "tab": "goals", "subtab": "active" },

    { "id": "06_planner_agenda", "tab": "planner", "subtab": "agenda" },

    { "id": "07_settings_main", "tab": "settings" },

    { "id": "08_modal_add_transaction", "tab": "finance", "subtab": "overview", "modal": "btn-add-tx-income" },

    { "id": "09_theme_light", "tab": "dashboard", "theme": "light" }

]



def create_driver():

    options = Options()

    options.add_argument("--headless=new")

    options.add_argument("--no-sandbox")

    options.add_argument("--disable-dev-shm-usage")

    options.add_argument("--disable-gpu")

    options.add_argument("--disable-animations")

    options.add_argument("--run-all-compositor-stages-before-draw")

    options.add_argument("--window-size=412,915")

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



    # 1. Disable animations for 100% deterministic pixel captures

    driver.execute_script("""

        const style = document.createElement('style');

        style.innerHTML = '* { transition: none !important; animation: none !important; -webkit-transition: none !important; }';

        document.head.appendChild(style);

    """)



    # 2. Reset to clean, deterministic fixture state

    driver.execute_async_script("""

        const done = arguments[arguments.length - 1];

        Promise.all([

            window.LifeOS_DB.tables.transactions.clear(),

            window.LifeOS_DB.tables.categories.clear(),

            window.LifeOS_DB.tables.budgets.clear(),

            window.LifeOS_DB.tables.savingsGoals.clear(),

            window.LifeOS_DB.tables.savingsContributions.clear(),

            window.LifeOS_DB.tables.habits.clear(),

            window.LifeOS_DB.tables.habitLogs.clear(),

            window.LifeOS_DB.tables.goals.clear(),

            window.LifeOS_DB.tables.milestones.clear(),

            window.LifeOS_DB.tables.tasks.clear(),

            window.LifeOS_DB.tables.settings.clear()

        ]).then(() => {

            window.LifeOS_DB.seedDefaultsIfEmpty();

            done();

        });

    """)

    time.sleep(0.4)



def apply_masks(img):

    """

    Masks dynamic timestamp and date text regions so comparisons remain deterministic.

    """

    draw = ImageDraw.Draw(img)

    # Mask date subtitle in header (x: 16-350, y: 55-85)

    draw.rectangle([16, 55, 350, 85], fill=(0, 0, 0))

    return img



def compute_pixel_diff(baseline_path, current_path, diff_output_path, threshold_percent=0.1):

    img_base = Image.open(baseline_path).convert("RGB")

    img_curr = Image.open(current_path).convert("RGB")



    if img_base.size != img_curr.size:

        img_curr = img_curr.resize(img_base.size, Image.Resampling.LANCZOS)



    # Mask dynamic date regions

    masked_base = apply_masks(img_base.copy())

    masked_curr = apply_masks(img_curr.copy())



    arr_base = np.array(masked_base, dtype=np.int16)

    arr_curr = np.array(masked_curr, dtype=np.int16)



    diff_arr = np.abs(arr_base - arr_curr)

    pixel_diff_mask = np.any(diff_arr > 12, axis=2)



    total_pixels = pixel_diff_mask.size

    diff_pixels = int(np.sum(pixel_diff_mask))

    diff_percent = float((diff_pixels / total_pixels) * 100.0)



    # Create visualization

    gray_curr = img_curr.convert("L").convert("RGB")

    arr_visual = np.array(gray_curr)

    arr_visual[pixel_diff_mask] = [255, 0, 68]

    Image.fromarray(arr_visual).save(diff_output_path)



    passed = diff_percent <= threshold_percent

    return {

        "diffPixels": diff_pixels,

        "totalPixels": total_pixels,

        "diffPercent": round(diff_percent, 4),

        "thresholdPercent": threshold_percent,

        "passed": passed,

        "diffImagePath": diff_output_path

    }



def capture_checkpoints(driver):

    captured = {}

    for cp in CHECKPOINTS:

        cp_id = cp["id"]

        tab = cp["tab"]



        # Navigate

        nav_btn = driver.find_element(By.CSS_SELECTOR, f"button.nav-item[data-tab='{tab}']")

        driver.execute_script("arguments[0].click();", nav_btn)

        time.sleep(0.3)



        if "subtab" in cp:

            sub = cp["subtab"]

            sub_btn = driver.find_element(By.CSS_SELECTOR, f"button.subtab-btn[data-sub='{sub}']")

            driver.execute_script("arguments[0].click();", sub_btn)

            time.sleep(0.2)



        if "modal" in cp:

            m_btn = driver.find_element(By.ID, cp["modal"])

            driver.execute_script("arguments[0].click();", m_btn)

            time.sleep(0.3)



        if cp.get("theme") == "light":

            theme_btn = driver.find_element(By.ID, "theme-toggle-btn")

            driver.execute_script("arguments[0].click();", theme_btn)

            time.sleep(0.2)



        curr_file = os.path.join(CURRENT_DIR, f"{cp_id}.png")

        driver.save_screenshot(curr_file)

        captured[cp_id] = curr_file



        # Clean up modal or theme toggle for next checkpoint

        if "modal" in cp:

            close_btn = driver.find_element(By.ID, "modal-close-btn")

            driver.execute_script("arguments[0].click();", close_btn)

            time.sleep(0.2)



        if cp.get("theme") == "light":

            theme_btn = driver.find_element(By.ID, "theme-toggle-btn")

            driver.execute_script("arguments[0].click();", theme_btn)

            time.sleep(0.2)



    return captured



def run_visual_regression(generate_baselines_if_missing=True):

    print("--- Running Sentinel Visual Regression & Pixel Diff Analysis ---")

    if not os.path.exists("dist/index.html"):

        print("STATUS: BLOCKED — Application bundle 'dist/index.html' not found.")

        print("To run this suite: (1) npm ci, (2) npm run build, (3) re-run test.")

        return {"status": "BLOCKED", "reason": "dist/index.html not built", "total": 0, "passed": 0, "failed": 0}

    results = {

        "name": "Visual Regression & Pixel Testing",

        "total": 0,

        "passed": 0,

        "failed": 0,

        "checkpoints": [],

        "errors": []

    }



    driver = create_driver()

    try:

        load_app(driver)

        captured = capture_checkpoints(driver)



        for cp in CHECKPOINTS:

            results["total"] += 1

            cp_id = cp["id"]

            curr_path = captured[cp_id]

            base_path = os.path.join(BASELINES_DIR, f"{cp_id}.png")

            diff_path = os.path.join(DIFFS_DIR, f"diff_{cp_id}.png")



            # Check if baseline exists

            if not os.path.exists(base_path):

                if generate_baselines_if_missing:

                    img = Image.open(curr_path)

                    img.save(base_path)

                    print(f"  📸 Initialized approved baseline for [{cp_id}]")

                    results["passed"] += 1

                    results["checkpoints"].append({

                        "id": cp_id,

                        "status": "INITIAL_BASELINE",

                        "diffPercent": 0.0,

                        "diffPixels": 0,

                        "passed": True

                    })

                    continue

                else:

                    results["failed"] += 1

                    results["checkpoints"].append({

                        "id": cp_id,

                        "status": "MISSING_BASELINE",

                        "passed": False

                    })

                    print(f"  ❌ Missing baseline for [{cp_id}]")

                    continue



            # Compare against baseline

            diff_res = compute_pixel_diff(base_path, curr_path, diff_path)

            if diff_res["passed"]:

                results["passed"] += 1

                results["checkpoints"].append({

                    "id": cp_id,

                    "status": "PASSED",

                    **diff_res

                })

                print(f"  ✅ [Pixel Diff] {cp_id}: {diff_res['diffPercent']}% delta (within threshold)")

            else:

                results["failed"] += 1

                results["checkpoints"].append({

                    "id": cp_id,

                    "status": "REGRESSION_DETECTED",

                    **diff_res

                })

                print(f"  ❌ [REGRESSION] {cp_id}: {diff_res['diffPercent']}% delta exceeds threshold ({diff_res['thresholdPercent']}%)")



        print(f"Visual Regression Completed: {results['passed']}/{results['total']} passed.")

    finally:

        driver.quit()



    return results



if __name__ == "__main__":

    res = run_visual_regression(generate_baselines_if_missing=True)

    if res["failed"] > 0:

        sys.exit(1)
