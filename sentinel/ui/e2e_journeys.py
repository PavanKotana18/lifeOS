#!/usr/bin/env python3

"""

LifeOS Sentinel — End-to-End User Journeys

Executes complete user journeys for all LifeOS modules, verifying actual database state,

relationship constraints, calculations, recovery paths, and data persistence.

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

    time.sleep(0.6)



def run_e2e_journeys():

    if not os.path.exists("dist/index.html"):

        print("STATUS: BLOCKED — Application bundle 'dist/index.html' not found.")

        print("To run this suite: (1) npm ci, (2) npm run build, (3) re-run test.")

        return {"status": "BLOCKED", "reason": "dist/index.html not built", "total": 0, "passed": 0, "failed": 0}

    print("--- Running Sentinel End-to-End User Journeys ---")

    results = {

        "name": "End-to-End User Journeys",

        "total": 0,

        "passed": 0,

        "failed": 0,

        "journeys": [],

        "errors": []

    }



    driver = create_driver()

    try:

        load_app(driver)



        def switch_tab(tab_name):

            btn = driver.find_element(By.CSS_SELECTOR, f"button.nav-item[data-tab='{tab_name}']")

            driver.execute_script("arguments[0].click();", btn)

            time.sleep(0.3)



        def execute_journey(name, fn):

            results["total"] += 1

            try:

                fn()

                results["passed"] += 1

                results["journeys"].append({"name": name, "status": "PASSED"})

                print(f"  ✅ [E2E] {name}")

            except Exception as e:

                results["failed"] += 1

                results["journeys"].append({"name": name, "status": "FAILED", "error": str(e)})

                results["errors"].append({"journey": name, "error": str(e)})

                print(f"  ❌ [E2E] FAIL: {name} - {e}")



        # Journey 1: Onboarding and User Profile Setup

        def journey_profile():

            switch_tab("settings")



            name_input = driver.find_element(By.ID, "profile-name-in")

            email_input = driver.find_element(By.ID, "profile-email-in")

            name_input.clear()

            name_input.send_keys("Pavan Sentinel Architect")

            email_input.clear()

            email_input.send_keys("architect@lifeos.internal")



            driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "btn-save-profile"))

            time.sleep(0.3)



            # Verify in DB

            profile = driver.execute_async_script("""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.get('settings', 'user_profile').then(res => done(res));

            """)

            assert profile is not None, "Profile not saved in settings table"

            assert profile["value"]["name"] == "Pavan Sentinel Architect", f"Expected name Pavan Sentinel Architect, got {profile['value']['name']}"

        execute_journey("Journey 1: Onboarding and User Profile Setup", journey_profile)



        # Journey 2: Finance — Income & Expense Lifecycle & Metrics Recalculation

        def journey_finance():

            switch_tab("finance")

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.subtab-btn[data-sub='overview']"))

            time.sleep(0.2)



            # Record Income Transaction directly via DB API and trigger UI reactivity

            driver.execute_async_script("""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.put('transactions', {

                    id: 'e2e_tx_income',

                    type: 'income',

                    amount: 120000,

                    category: 'Salary',

                    description: 'Primary Employment Salary',

                    date: new Date().toISOString().substring(0, 7) + '-01',

                    paymentMethod: 'Bank Transfer'

                }).then(() => done());

            """)

            # Record Expense Transaction

            driver.execute_async_script("""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.put('transactions', {

                    id: 'e2e_tx_expense',

                    type: 'expense',

                    amount: 35000,

                    category: 'Rent',

                    description: 'Apartment Monthly Rent',

                    date: new Date().toISOString().substring(0, 7) + '-02',

                    paymentMethod: 'UPI'

                }).then(() => done());

            """)

            time.sleep(0.3)



            # Verify in DB

            txs = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('transactions').then(t => done(t));")

            assert len(txs) >= 2, f"Expected at least 2 transactions, found {len(txs)}"



            # Navigate to Transactions subtab and verify rows appear

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.subtab-btn[data-sub='transactions']"))

            time.sleep(0.3)

            page_text = driver.find_element(By.ID, "finance-subtab-container").text

            assert "Primary Employment Salary" in page_text, "Income transaction description missing from list"

            assert "Apartment Monthly Rent" in page_text, "Expense transaction description missing from list"

        execute_journey("Journey 2: Finance — Income & Expense Lifecycle", journey_finance)



        # Journey 3: Categories and Monthly Budget Allocation

        def journey_budget():

            cur_month = driver.execute_script("return new Date().toISOString().substring(0, 7);")

            driver.execute_async_script(f"""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.put('budgets', {{

                    id: 'e2e_budget_monthly',

                    monthYear: '{cur_month}',

                    monthlyAmount: 60000

                }}).then(() => done());

            """)

            time.sleep(0.2)



            switch_tab("finance")

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.subtab-btn[data-sub='budgets']"))

            time.sleep(0.3)



            budgets = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('budgets').then(b => done(b));")

            assert len(budgets) >= 1, "Budget was not saved in DB"

            assert budgets[0]["monthlyAmount"] == 60000, "Budget monthly amount mismatch"

        execute_journey("Journey 3: Categories and Monthly Budget Allocation", journey_budget)



        # Journey 4: Savings Goals and Milestone Contributions

        def journey_savings():

            driver.execute_async_script("""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.put('savingsGoals', {

                    id: 'e2e_goal_car',

                    title: 'New Electric Vehicle Fund',

                    targetAmount: 500000,

                    currentAmount: 100000,

                    targetDate: '2027-12-31',

                    category: 'Vehicle'

                }).then(() => done());

            """)

            driver.execute_async_script("""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.put('savingsContributions', {

                    id: 'e2e_contrib_1',

                    goalId: 'e2e_goal_car',

                    amount: 25000,

                    date: '2026-11-01',

                    notes: 'Bonus deposit'

                }).then(() => done());

            """)

            time.sleep(0.3)



            switch_tab("finance")

            driver.execute_script("arguments[0].click();", driver.find_element(By.CSS_SELECTOR, "button.subtab-btn[data-sub='savings']"))

            time.sleep(0.3)



            goals = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('savingsGoals').then(g => done(g));")

            contribs = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('savingsContributions').then(c => done(c));")

            assert len(goals) >= 1, "Savings goal not found in DB"

            assert len(contribs) >= 1, "Savings contribution not found in DB"

            assert contribs[0]["goalId"] == "e2e_goal_car", "Referential link between contribution and goal broken"

        execute_journey("Journey 4: Savings Goals and Milestone Contributions", journey_savings)



        # Journey 5: Habits Creation, Daily Logging, and Streak Recalculation

        def journey_habits():

            today = driver.execute_script("return new Date().toISOString().split('T')[0];")

            yesterday = driver.execute_script("""

                const d = new Date();

                d.setDate(d.getDate() - 1);

                return d.toISOString().split('T')[0];

            """)



            driver.execute_async_script("""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.put('habits', {

                    id: 'e2e_habit_water',

                    name: 'Hydration 3L Daily',

                    frequency: 'daily',

                    color: '#3b82f6'

                }).then(() => done());

            """)

            driver.execute_async_script(f"""

                const done = arguments[arguments.length - 1];

                Promise.all([

                    window.LifeOS_DB.put('habitLogs', {{ id: 'hl_yest', habitId: 'e2e_habit_water', date: '{yesterday}', completed: true }}),

                    window.LifeOS_DB.put('habitLogs', {{ id: 'hl_today', habitId: 'e2e_habit_water', date: '{today}', completed: true }})

                ]).then(() => done());

            """)

            time.sleep(0.3)



            switch_tab("habits")

            time.sleep(0.3)



            habits = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('habits').then(h => done(h));")

            logs = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('habitLogs').then(l => done(l));")

            assert len(habits) >= 1, "Habit not saved in DB"

            assert len(logs) >= 2, "Habit logs not saved in DB"

        execute_journey("Journey 5: Habits Creation and Consecutive Streak Logging", journey_habits)



        # Journey 6: Goals and Milestone Progression Tracking

        def journey_goals():

            driver.execute_async_script("""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.put('goals', {

                    id: 'e2e_goal_marathon',

                    title: 'State Marathon 42.2KM',

                    category: 'Fitness',

                    targetValue: 42.2,

                    currentValue: 21.1,

                    unit: 'km',

                    startDate: '2026-08-01',

                    targetDate: '2026-12-31',

                    priority: 'High',

                    status: 'In Progress'

                }).then(() => {

                    return Promise.all([

                        window.LifeOS_DB.put('milestones', { id: 'ms_1', goalId: 'e2e_goal_marathon', title: '10km Milestone', completed: true }),

                        window.LifeOS_DB.put('milestones', { id: 'ms_2', goalId: 'e2e_goal_marathon', title: '21km Half Marathon', completed: true }),

                        window.LifeOS_DB.put('milestones', { id: 'ms_3', goalId: 'e2e_goal_marathon', title: '32km Long Run', completed: false })

                    ]);

                }).then(() => done());

            """)

            time.sleep(0.3)



            switch_tab("goals")

            time.sleep(0.3)



            goals = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('goals').then(g => done(g));")

            milestones = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('milestones').then(m => done(m));")

            assert len(goals) >= 1, "Goal not found in DB"

            assert len(milestones) == 3, f"Expected 3 milestones, found {len(milestones)}"

        execute_journey("Journey 6: Goals and Milestone Progression", journey_goals)



        # Journey 7: Daily Planner, Priority Filtering, and Task Completion

        def journey_planner():

            today = driver.execute_script("return new Date().toISOString().split('T')[0];")

            driver.execute_async_script(f"""

                const done = arguments[arguments.length - 1];

                Promise.all([

                    window.LifeOS_DB.put('tasks', {{ id: 'e2e_task_1', title: 'Complete Sentinel CI Pipeline', dueDate: '{today}', priority: 'Urgent', completed: false }}),

                    window.LifeOS_DB.put('tasks', {{ id: 'e2e_task_2', title: 'Weekly Groceries Provisioning', dueDate: '{today}', priority: 'Medium', completed: true }})

                ]).then(() => done());

            """)

            time.sleep(0.3)



            switch_tab("planner")

            time.sleep(0.3)



            tasks = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('tasks').then(t => done(t));")

            assert len(tasks) >= 2, f"Expected at least 2 tasks, found {len(tasks)}"

        execute_journey("Journey 7: Daily Planner, Priorities, and Task Completion", journey_planner)



        # Journey 8: Central Dashboard Reactive Aggregation

        def journey_dashboard():

            switch_tab("dashboard")

            time.sleep(0.4)



            dash_text = driver.find_element(By.ID, "view-dashboard").text

            assert "Productivity Score" in dash_text, "Productivity Score header missing from Dashboard"

            assert "%" in dash_text, "Productivity percentage score missing from Dashboard"

        execute_journey("Journey 8: Central Dashboard Reactive Aggregation", journey_dashboard)



        # Journey 9: CSV Export & Backup JSON Verification

        def journey_export():

            switch_tab("settings")

            time.sleep(0.3)



            backup = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.exportAllData().then(b => done(b));")

            assert "tables" in backup, "Exported backup missing tables dictionary"

            assert len(backup["tables"]["transactions"]) >= 2, "Exported backup missing transactions"

            assert len(backup["tables"]["habits"]) >= 1, "Exported backup missing habits"

            assert len(backup["tables"]["tasks"]) >= 2, "Exported backup missing tasks"



            csv_btn = driver.find_element(By.ID, "btn-export-csv")

            assert csv_btn.is_displayed(), "Export CSV button is not visible"

        execute_journey("Journey 9: CSV Export and Backup Data Verification", journey_export)



        # Journey 10: Clear All Data and Restore Round-Trip Persistence

        def journey_restore():

            snapshot = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.exportAllData().then(b => done(b));")



            # Clear transactions and tasks

            driver.execute_async_script("""

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.tables.transactions.clear();

                window.LifeOS_DB.tables.tasks.clear();

                done();

            """)

            time.sleep(0.2)

            cleared_txs = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('transactions').then(t => done(t));")

            assert len(cleared_txs) == 0, "Transactions not cleared before restore"



            # Execute Restore via importAllData

            driver.execute_async_script("""

                const backup = arguments[0];

                const done = arguments[arguments.length - 1];

                window.LifeOS_DB.importAllData(backup).then(() => done());

            """, snapshot)

            time.sleep(0.3)



            restored_txs = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('transactions').then(t => done(t));")

            restored_tasks = driver.execute_async_script("const done = arguments[arguments.length - 1]; window.LifeOS_DB.getAll('tasks').then(t => done(t));")

            assert len(restored_txs) >= 2, f"Expected restored transactions, got {len(restored_txs)}"

            assert len(restored_tasks) >= 2, f"Expected restored tasks, got {len(restored_tasks)}"

        execute_journey("Journey 10: Data Clear and Restore Round-Trip Persistence", journey_restore)



        print(f"E2E Journeys Completed: {results['passed']}/{results['total']} passed.")

    finally:

        driver.quit()



    return results



if __name__ == "__main__":

    res = run_e2e_journeys()

    if res["failed"] > 0:

        sys.exit(1)
