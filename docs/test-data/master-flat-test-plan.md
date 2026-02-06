# Master Flat CSV Import - Test Plan

## Test CSV Location
`docs/test-data/master-flat-test.csv`

## Test Scenarios

### Row 1: FULL_TENANT (with water meter)
- Property: Kite Estate (will be created)
- Unit: hse1 (will be created)
- Tenant: John Doe (will be created)
- Water meter: MTR-001 with initial reading 100

### Row 2: FULL_TENANT (with water meter)
- Property: Kite Estate (existing from row 1)
- Unit: hse2 (will be created)
- Tenant: Jane Smith (will be created)
- Water meter: MTR-002 with initial reading 150

### Row 3: VACANT_UNIT (no tenant)
- Property: Kite Estate (existing)
- Unit: hse3 (will be created)
- No tenant data

### Row 4: FULL_TENANT (without water meter)
- Property: Kite Estate (existing)
- Unit: hse4 (will be created)
- Tenant: Bob Johnson (will be created)
- No meter number

### Row 5: PROPERTY_ONLY
- Property: Umma Estate (will be created)
- No unit, no tenant

## Expected Results

1. **Properties Created**: 2 (Kite Estate, Umma Estate)
2. **Units Created**: 4 (hse1, hse2, hse3, hse4)
3. **Tenants Created**: 3 (John Doe, Jane Smith, Bob Johnson)
4. **Leases Created**: 3 (one per tenant)
5. **Charges Created**: 3 (one per lease)

## GraphQL Mutation for Testing

```graphql
mutation BulkUploadMasterFlat($file: Upload!, $companyId: ID!) {
  bulkUpload(
    file: $file
    fileType: MASTER_FLAT
    companyId: $companyId
  ) {
    success
    importJobId
    totalRows
    validationErrors {
      rowIndex
      fieldName
      message
      rowData
    }
    estimatedSeconds
  }
}
```

## How to Test in GraphQL Playground

1. Start the backend: `yarn start:dev`
2. Open GraphQL Playground at http://localhost:3333/graphql
3. Use the `bulkUpload` mutation with `fileType: MASTER_FLAT`
4. Upload the CSV file
5. Subscribe to progress:

```graphql
subscription {
  uploadProgress(uploadUUID: "YOUR_UPLOAD_ID") {
    status
    total
    processed
    succeeded
    failed
    createdProperties
    createdUnits
    createdTenants
    createdLeases
    createdCharges
    errors {
      row
      message
      data
    }
  }
}
```
