# Property Bulk Import Design

## Overview

Replace separate property, unit, and tenant uploads with a single **Master CSV** that can import the entire hierarchy in one operation. Users upload one file containing any combination of properties, units, tenants, leases, charges, and water meters.

## CSV Structure

### Header Row (15 columns)

```csv
propertyName,unitNumber,unitType,bedrooms,bathrooms,customerFirstName,customerLastName,customerPhone,customerEmail,baseRent,rentFrequency,startDate,meterNumber,initialReading,waterPricePerUnit
```

### Field Reference

| Field | Required For | Type | Description |
|-------|--------------|------|-------------|
| `propertyName` | ✱ All rows | string | Property identifier (code auto-generated) |
| `unitNumber` | ✱ Unit+ rows | string | Unit within property |
| `unitType` | | string | apartment/studio/bedsitter/etc |
| `bedrooms` | | number | Self-explanatory |
| `bathrooms` | | number | Self-explanatory |
| `customerFirstName` | ✱ Tenants | string | Tenant name |
| `customerLastName` | ✱ Tenants | string | Tenant name |
| `customerPhone` | | string | Contact |
| `customerEmail` | | string | Contact |
| `baseRent` | ✅ Tenants | number | Rent amount |
| `rentFrequency` | | string | monthly/weekly/yearly (default: monthly) |
| `startDate` | ✱ Tenants | date | Lease start (YYYY-MM-DD) |
| `meterNumber` | | string | Optional water meter |
| `initialReading` | | number | With meterNumber |
| `waterPricePerUnit` | | number | With meterNumber |

### Row Examples

```csv
# Full tenant with water meter
Kite Estate,hse1,apartment,1,1,John,Doe,+254712345678,john@email.com,11200,monthly,2026-01-10,MTR-001,100,50

# Full tenant without water meter
Kite Estate,hse2,apartment,1,1,Jane,Smith,+254712345679,jane@email.com,11480,monthly,2026-01-10,,,

# Vacant unit with meter
Kite Estate,hse3,studio,0,1,,,,,MTR-003,500,50

# Vacant unit no meter
Kite Estate,hse4,bedsitter,1,0,,,,,

# Property only (new property)
Umma Estate,,,,,,,,
```

## Row Detection Logic

```typescript
detectRowType(row: CsvRow): ImportType {
  const hasUnit = !!row.unitNumber;
  const hasTenant = !!(row.customerFirstName || row.customerLastName);
  const hasMeter = !!row.meterNumber;

  if (!hasUnit) return 'PROPERTY_ONLY';
  if (hasTenant) return 'FULL_TENANT';
  return 'VACANT_UNIT';
}
```

| Type | Creates |
|------|---------|
| `PROPERTY_ONLY` | Property only |
| `VACANT_UNIT` | Property + Unit (+ optional Meter) |
| `FULL_TENANT` | Property + Unit + Tenant + Lease + Charge (+ optional Meter) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Frontend (Angular)                                  │
│  - CSV file upload component                                                 │
│  - Frontend validation (CSV format, required columns)                       │
│  - Progress tracking via subscription                                       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ GraphQL
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Real Estate Backend (NestJS, Port 3333)                   │
│  - GraphQL Mutation: bulkImportPropertyData                                 │
│  - Bull Queue for background processing                                     │
│  - MasterImportOrchestrator service                                         │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MasterImportOrchestrator                                │
│  1. Parse CSV                                                               │
│  2. Detect row type for each row                                            │
│  3. Find/create Property (by name)                                          │
│  4. Find/create Unit                                                        │
│  5. If tenant: create Tenant + Lease                                        │
│  6. If meter: create/link WaterMeter                                        │
│  7. Fail fast on error                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## GraphQL Schema

### Input Types

```typescript
@InputType()
export class PropertyBulkImportInput {
  @Field(() => GraphQLUpload, { description: 'CSV file with properties, units, tenants, and water meters' })
  csvFile: FileUpload;

  @Field({ description: 'Company ID to associate imported data with' })
  companyId: string;
}
```

### Return Types

```typescript
@ObjectType()
export class RowValidationError {
  @Field({ description: 'Row number in CSV (1-indexed)' })
  rowIndex: number;

  @Field({ nullable: true, description: 'Field name that caused the error' })
  fieldName?: string;

  @Field({ description: 'Human-readable error message' })
  message: string;

  @Field({ nullable: true, description: 'Original row data for debugging' })
  rowData?: string;
}

@ObjectType()
export class BulkImportSummary {
  @Field({ description: 'True if import was queued successfully' })
  success: boolean;

  @Field({ nullable: true, description: 'Job ID for tracking import progress' })
  importJobId?: string;

  @Field({ description: 'Number of rows that will be processed' })
  totalRows: number;

  @Field(() => [RowValidationError], { nullable: true, description: 'Validation errors from frontend' })
  validationErrors?: RowValidationError[];

  @Field({ description: 'Estimated time to complete import' })
  estimatedSeconds: number;
}

@ObjectType()
export class ImportJobProgress {
  @Field({ description: 'Job ID' })
  jobId: string;

  @Field({ description: 'Current status' })
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Field({ description: 'Rows processed so far' })
  rowsProcessed: number;

  @Field({ description: 'Total rows to process' })
  totalRows: number;

  @Field({ description: 'Properties created' })
  propertiesCreated: number;

  @Field({ description: 'Units created' })
  unitsCreated: number;

  @Field({ description: 'Tenants created' })
  tenantsCreated: number;

  @Field({ description: 'Water meters linked' })
  metersLinked: number;

  @Field(() => [RowValidationError], { nullable: true })
  errors?: RowValidationError[];
}
```

### Mutation & Subscription

```typescript
@Resolver()
export class PropertyImportResolver {
  @Mutation(() => BulkImportSummary, {
    description: 'Upload a single CSV file to bulk import properties, units, tenants, leases, and water meters'
  })
  async bulkImportPropertyData(
    @Args('input') input: PropertyBulkImportInput,
  ): Promise<BulkImportSummary>;

  @Subscription(() => ImportJobProgress, {
    description: 'Track progress of bulk import job'
  })
  propertyImportJobProgress(
    @Args('importJobId') importJobId: string,
  ): AsyncIterator<ImportJobProgress>;
}
```

## Entity Creation Order

1. **Property** — `findOneOrCreate({ name: propertyName, companyId })`
2. **Unit** — `findOneOrCreate({ property, unitNumber })`
3. **WaterMeter** (optional) — `findOneOrCreate({ meterNumber })` → link to Unit
4. **Tenant** — `findOneOrCreate({ email, phone })` or create new
5. **Lease** — Create new (link Tenant → Unit)
6. **Charge** — Create initial rent charge

## Error Handling

### Validation Layers

| Layer | What | Fails Fast |
|-------|------|------------|
| **Frontend** | CSV format, required columns, data types | ✅ Yes |
| **Backend** | Business rules, duplicates, constraints | ✅ Yes |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate property name | Use existing property |
| Duplicate unit number (same property) | Error - unit must be unique |
| Same tenant, different units | Create new lease |
| Empty CSV | Error - no data |
| Row missing required fields | Error - specify field + row |
| Invalid date format | Error - expect YYYY-MM-DD |
| Invalid rent amount | Error - must be number > 0 |
| Water meter already exists | Link to unit, don't duplicate |

## Cross-Stack Considerations (ULTRATHINK)

### Water Billing Integration
- Water meters may need to sync with analog-meter-project (port 3332)
- If water billing sync fails, real estate import should still succeed
- Consider compensating transactions for failed meter sync

### Database Transactions
- Use QueryRunner for multi-entity operations
- Row-level transaction scope (fail fast per row)
- Property/Unit/Tenant creation in single transaction per row

### Performance
- Bull Queue for async processing (prevents timeout)
- Batch size: 50 rows per batch
- Progress updates via GraphQL subscription

## Implementation Tasks

1. GraphQL Schema — Create input/output types
2. CSV Parser — Parse and validate CSV structure
3. MasterImportOrchestrator — Coordinate entity creation
4. Property/Unit/Tenant Helpers — Find or create logic
5. WaterMeter Integration — Link meters to units
6. Bull Queue Job — Background processing
7. Subscription — Real-time progress updates
8. Frontend Component — File upload + progress tracking
