# Waterlix Investment (Company 36) Data Import Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import water billing data from CSV into the analog water database for Company ID 36 (Waterlix Investment)

**Architecture:** Direct SQL import with proper foreign key relationships: Customer → Account → Installation → Analog Meter → Meter Reading. Two tariff rates based on unit number.

**Tech Stack:** PostgreSQL, Python (pandas for CSV parsing), SQL

---

## Data Summary

**Source File:** `/Users/nelson/Code/Personal/projects/analog_water/work_space/analog-meter-project/import_.csv`

**Company Info:**
- Company ID: 36
- Name: Waterlix Investment
- Staff: Eric Nyongo (company_staff_id: 55)

**Tariff Rules:**
| Rate | Per Unit | Applicable Units |
|------|----------|------------------|
| Standard | 100 Kshs | 1,2,3,4,5,6,7,8,9,10,11,12,15,17,18,20,21,22,23,24,25,27,28,29 |
| Discounted | 90 Kshs | 13,14,16,19,26,30 |

**Valid Records:** 27 clients (excluding empty rows and totals)

---

## Task 1: Create Tariffs for Company 36

**Files:**
- Execute: SQL directly on production database

**Step 1: Insert two tariff rates**

```sql
-- Standard rate: 100 Kshs per unit
INSERT INTO tariff (company_id, charge, type, from_units, to_units)
VALUES (36, 100, 'perMeterCubic', 0, 999999);

-- Discounted rate: 90 Kshs per unit (for specific accounts)
-- Note: We'll track this via account metadata, not separate tariff
```

**Step 2: Verify tariff creation**

```bash
psql -c "SELECT * FROM tariff WHERE company_id = 36;"
```

Expected: 1 row with charge=100

**Step 3: Update company water_price_per_unit**

```sql
UPDATE company
SET water_price_per_unit = 100,
    billing_start_day = 1,
    billing_end_day = 28,
    status = 'active'
WHERE company_id = 36;
```

---

## Task 2: Create Python Import Script

**Files:**
- Create: `/Users/nelson/Code/Personal/projects/analog_water/work_space/data_import_workspace/import_waterlix.py`

**Step 1: Write the import script**

```python
#!/usr/bin/env python3
"""
Import Waterlix Investment data from CSV to analog water database.
Company ID: 36
Tariff: 100/= per unit (90/= for units 13,14,16,19,26,30)
"""

import pandas as pd
import psycopg2
from datetime import datetime
import re

# Database connection
DB_CONFIG = {
    'host': '152.53.64.150',
    'port': 5433,
    'database': 'analogwater_prod_db',
    'user': 'user',
    'password': 'mK9nVp4xL2wR8tB5hN7jQ3cF6vM4pZ8kT2yW9nX5dR7bP3gL9sA4'
}

COMPANY_ID = 36
COMPANY_STAFF_ID = 55  # Eric Nyongo

# Units with discounted rate (90/= instead of 100/=)
DISCOUNTED_UNITS = {13, 14, 16, 19, 26, 30}

def clean_amount(value):
    """Clean monetary values: remove commas, handle empty"""
    if pd.isna(value) or value == '':
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    # Remove commas and convert
    cleaned = str(value).replace(',', '').strip()
    if cleaned == '':
        return 0
    try:
        return float(cleaned)
    except:
        return 0

def clean_phone(phone):
    """Clean phone number to standard format"""
    if pd.isna(phone):
        return None
    phone_str = str(int(float(phone))) if isinstance(phone, float) else str(phone)
    # Remove any non-digit characters
    phone_str = re.sub(r'\D', '', phone_str)
    # Handle Kenyan phone formats
    if len(phone_str) == 9:
        phone_str = '0' + phone_str
    if len(phone_str) == 10 and phone_str.startswith('0'):
        phone_str = '254' + phone_str[1:]
    if len(phone_str) == 12 and phone_str.startswith('254'):
        return '+' + phone_str
    return phone_str

def main():
    # Read CSV
    csv_path = '/Users/nelson/Code/Personal/projects/analog_water/work_space/analog-meter-project/import_.csv'
    df = pd.read_csv(csv_path)

    print(f"Loaded {len(df)} rows from CSV")
    print(f"Columns: {list(df.columns)}")

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        # Track created records
        created_customers = 0
        created_accounts = 0
        created_installations = 0
        created_meters = 0
        created_readings = 0

        for idx, row in df.iterrows():
            unit_no = row.get('No.')
            client_name = row.get('Client')
            reading = row.get('Reading')
            units_consumed = row.get('Units')
            bill = row.get('bill')
            balance = row.get('balance')
            contact = row.get('Contact')

            # Skip empty rows, totals row, and row with only phone
            if pd.isna(unit_no) or pd.isna(client_name) or str(client_name).strip() == '':
                print(f"Skipping row {idx}: empty unit_no or client_name")
                continue

            # Skip if unit_no is not a valid number
            try:
                unit_no = int(float(unit_no))
            except:
                print(f"Skipping row {idx}: invalid unit_no '{unit_no}'")
                continue

            client_name = str(client_name).strip()
            phone = clean_phone(contact)
            current_reading = clean_amount(reading)
            account_balance = clean_amount(balance)

            # Determine rate
            rate = 90 if unit_no in DISCOUNTED_UNITS else 100

            print(f"\n--- Processing Unit {unit_no}: {client_name} ---")
            print(f"  Phone: {phone}, Reading: {current_reading}, Balance: {account_balance}, Rate: {rate}/=")

            # 1. Create Customer
            cur.execute("""
                INSERT INTO customer (company_id, first_name, phone, status, role)
                VALUES (%s, %s, %s, 'active', 'customer')
                RETURNING customer_id
            """, (COMPANY_ID, client_name, phone))
            customer_id = cur.fetchone()[0]
            created_customers += 1
            print(f"  Created customer_id: {customer_id}")

            # 2. Create Account
            account_no = f"WLX-{unit_no:03d}"
            cur.execute("""
                INSERT INTO account (
                    company_id, customer_id, account_no,
                    account_balance, total_account_balance, status,
                    account_meta
                )
                VALUES (%s, %s, %s, %s, %s, 'active', %s)
                RETURNING account_id
            """, (
                COMPANY_ID, customer_id, account_no,
                account_balance, account_balance,
                f'{{"rate": {rate}, "unit_no": {unit_no}}}'
            ))
            account_id = cur.fetchone()[0]
            created_accounts += 1
            print(f"  Created account_id: {account_id}, account_no: {account_no}")

            # 3. Create Installation
            cur.execute("""
                INSERT INTO installation (
                    company_id, customer_id, account_id,
                    address, status, installation_date
                )
                VALUES (%s, %s, %s, %s, 'active', NOW())
                RETURNING installation_id
            """, (COMPANY_ID, customer_id, account_id, f"Unit {unit_no}"))
            installation_id = cur.fetchone()[0]
            created_installations += 1
            print(f"  Created installation_id: {installation_id}")

            # 4. Create Analog Meter
            meter_number = f"WLX-M-{unit_no:03d}"
            cur.execute("""
                INSERT INTO analog_meter (
                    company_id, customer_id, account_id, installation_id,
                    meter_number, status
                )
                VALUES (%s, %s, %s, %s, %s, 'active')
                RETURNING analog_meter_id
            """, (COMPANY_ID, customer_id, account_id, installation_id, meter_number))
            analog_meter_id = cur.fetchone()[0]
            created_meters += 1
            print(f"  Created analog_meter_id: {analog_meter_id}, meter_number: {meter_number}")

            # 5. Create Initial Meter Reading (if reading exists)
            if current_reading > 0:
                cur.execute("""
                    INSERT INTO meter_reading (
                        company_id, company_staff_id, analog_meter_id, customer_id,
                        reading, type, reading_data_type, reading_time
                    )
                    VALUES (%s, %s, %s, %s, %s, 'initial', 'manual', NOW())
                    RETURNING meter_reading_id
                """, (COMPANY_ID, COMPANY_STAFF_ID, analog_meter_id, customer_id, current_reading))
                reading_id = cur.fetchone()[0]
                created_readings += 1
                print(f"  Created meter_reading_id: {reading_id}, reading: {current_reading}")

        # Commit all changes
        conn.commit()

        print("\n" + "="*50)
        print("IMPORT COMPLETE")
        print("="*50)
        print(f"Customers created: {created_customers}")
        print(f"Accounts created: {created_accounts}")
        print(f"Installations created: {created_installations}")
        print(f"Analog meters created: {created_meters}")
        print(f"Meter readings created: {created_readings}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
```

**Step 2: Run the import script**

```bash
cd /Users/nelson/Code/Personal/projects/analog_water/work_space/data_import_workspace
source venv/bin/activate
python import_waterlix.py
```

Expected: Success message with counts of created records

---

## Task 3: Verify Import Results

**Step 1: Check customer count**

```sql
SELECT COUNT(*) as customers FROM customer WHERE company_id = 36;
-- Expected: ~27 customers
```

**Step 2: Check account details with rates**

```sql
SELECT
    a.account_no,
    c.first_name as client,
    a.account_balance,
    a.account_meta->>'rate' as rate,
    a.account_meta->>'unit_no' as unit_no
FROM account a
JOIN customer c ON a.customer_id = c.customer_id
WHERE a.company_id = 36
ORDER BY (a.account_meta->>'unit_no')::int;
```

**Step 3: Check meters with readings**

```sql
SELECT
    am.meter_number,
    c.first_name as client,
    mr.reading as current_reading
FROM analog_meter am
JOIN customer c ON am.customer_id = c.customer_id
LEFT JOIN meter_reading mr ON am.analog_meter_id = mr.analog_meter_id
WHERE am.company_id = 36
ORDER BY am.meter_number;
```

**Step 4: Verify discounted rate accounts**

```sql
SELECT
    a.account_no,
    c.first_name,
    a.account_meta->>'rate' as rate,
    a.account_meta->>'unit_no' as unit_no
FROM account a
JOIN customer c ON a.customer_id = c.customer_id
WHERE a.company_id = 36
  AND (a.account_meta->>'rate')::int = 90
ORDER BY (a.account_meta->>'unit_no')::int;
-- Expected: 6 rows (units 13,14,16,19,26,30)
```

---

## Task 4: Create Backup Before Import (OPTIONAL - Run First)

**Step 1: Create backup of current company 36 state**

```bash
PGPASSWORD='mK9nVp4xL2wR8tB5hN7jQ3cF6vM4pZ8kT2yW9nX5dR7bP3gL9sA4' pg_dump \
  -h 152.53.64.150 -p 5433 -U user -d analogwater_prod_db \
  --data-only \
  -t customer -t account -t installation -t analog_meter -t meter_reading -t tariff \
  --where="company_id = 36" \
  > /Users/nelson/Code/Personal/projects/analog_water/work_space/data_import_workspace/backups/waterlix_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## Rollback Procedure (If Needed)

```sql
-- Delete in reverse order of creation
DELETE FROM meter_reading WHERE company_id = 36;
DELETE FROM analog_meter WHERE company_id = 36;
DELETE FROM installation WHERE company_id = 36;
DELETE FROM account WHERE company_id = 36;
DELETE FROM customer WHERE company_id = 36;
DELETE FROM tariff WHERE company_id = 36;

-- Reset company
UPDATE company SET status = 'testing' WHERE company_id = 36;
```

---

## Data Mapping Reference

| CSV Column | Target Table | Target Column | Notes |
|------------|--------------|---------------|-------|
| No. | account | account_meta.unit_no | Unit identifier |
| Client | customer | first_name | Customer name |
| Reading | meter_reading | reading | Current meter reading |
| Units | - | - | Calculated consumption (not imported) |
| bill | - | - | Calculated bill (not imported) |
| balance | account | account_balance | Outstanding balance |
| Contact | customer | phone | Phone number |

## Tariff Application

The rate (90 or 100) is stored in `account.account_meta` as JSON:
```json
{"rate": 100, "unit_no": 5}
```

This allows the billing system to apply the correct rate per account.

---

## Success Criteria

- [ ] Tariff created for company 36 (100/= per unit)
- [ ] 27 customers created (excluding empty rows)
- [ ] 27 accounts created with correct balances and rates
- [ ] 27 installations created
- [ ] 27 analog meters created with unique meter numbers
- [ ] Initial meter readings created for accounts with readings
- [ ] Discounted rate (90/=) applied to units 13,14,16,19,26,30
- [ ] All foreign key relationships correct
