# Water Billing Import Template

## File: `water-billing-import-template.csv`

Essential fields only for importing water billing customer data.

## Fields

| Field | Type | Description |
|-------|------|-------------|
| customerFirstName | string | Customer first name |
| customerLastName | string | Customer last name |
| customerPhone | string | Phone with country code (e.g., 254712345678) |
| accountNo | string | Account number/reference |
| meterNumber | string | Meter serial number |
| previousReading | decimal | Previous meter reading |
| currentReading | decimal | Current meter reading |
| billingDate | date | Billing date (YYYY-MM-DD) |
| accountBalance | decimal | Opening balance (positive = owes) |

## Notes

- **Phone**: Include country code, no spaces (e.g., 254712345678)
- **Dates**: YYYY-MM-DD format (e.g., 2026-01-28)
- **Balance**: Positive = customer owes, Negative = credit
