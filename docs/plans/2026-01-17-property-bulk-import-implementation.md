# Property Bulk Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a single CSV upload that imports properties, units, tenants, leases, charges, and water meters in one operation.

**Architecture:**
- Extend existing upload module with new `MASTER_FLAT` file type
- Create `MasterFlatProcessor` extending `BaseProcessor`
- Add new GraphQL mutation and subscription types
- Use Bull Queue for background processing
- Row-level transaction scope with fail-fast

**Tech Stack:** NestJS 11, TypeORM, Apollo GraphQL (code-first), Bull Queue, PostgreSQL

---

## Task 1: Add MASTER_FLAT to File Type Enum

**Files:**
- Modify: `realator_backend/app/src/modules/upload/enums/file-type.enum.ts`

**Step 1: Add new enum value**

```typescript
export enum FILE_TYPE_ENUM {
  NEW_CUSTOMERS = 'new-customers',
  PROPERTIES = 'properties',
  UNITS = 'units',
  TENANTS = 'tenants',
  METER_READINGS = 'meter-readings',
  BILLS = 'bills',
  PAYMENT_PROOF = 'payment-proof',
  COMPANY_LOGO = 'company-logo',
  OTHER = 'other',
  MASTER_FLAT = 'master-flat', // NEW
}
```

**Step 2: Update GraphQL enum**

- Modify: `realator_backend/app/src/modules/upload/dto/bulk-upload-input.dto.ts`

```typescript
export enum BulkImportFileType {
  PROPERTIES,
  UNITS,
  TENANTS,
  NEW_CUSTOMERS,
  WATER_UNITS,
  WATER_READINGS,
  MASTER_FLAT, // NEW
}
```

**Step 3: Add mapping in resolver**

- Modify: `realator_backend/app/src/modules/upload/resolvers/bulk-upload.resolver.ts`

```typescript
type FileTypeString =
  | 'properties'
  | 'units'
  | 'tenants'
  | 'new-customers'
  | 'water-units'
  | 'water-readings'
  | 'master-flat'; // NEW

private mapToFileType(
  fileType: BulkImportFileType,
): FileTypeString {
  const mapping: Record<BulkImportFileType, FileTypeString> = {
    [BulkImportFileType.PROPERTIES]: 'properties',
    [BulkImportFileType.UNITS]: 'units',
    [BulkImportFileType.TENANTS]: 'tenants',
    [BulkImportFileType.NEW_CUSTOMERS]: 'new-customers',
    [BulkImportFileType.WATER_UNITS]: 'water-units',
    [BulkImportFileType.WATER_READINGS]: 'water-readings',
    [BulkImportFileType.MASTER_FLAT]: 'master-flat', // NEW
  };
  return mapping[fileType] ?? 'properties';
}
```

**Step 4: Commit**

```bash
cd realator_backend
git add src/modules/upload/enums/file-type.enum.ts src/modules/upload/dto/bulk-upload-input.dto.ts src/modules/upload/resolvers/bulk-upload.resolver.ts
git commit -m "feat(upload): add MASTER_FLAT file type for bulk property import"
```

---

## Task 2: Create Master Flat DTOs

**Files:**
- Create: `realator_backend/app/src/modules/upload/dto/master-flat-upload.dto.ts`

**Step 1: Write the DTOs**

```typescript
import { InputType, Field, ID, ObjectType, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsNumber } from 'class-validator';

/**
 * Row validation error for CSV parsing
 */
@ObjectType()
export class RowValidationError {
  @Field(() => Int, { description: 'Row number in CSV (1-indexed)' })
  rowIndex: number;

  @Field({ nullable: true, description: 'Field name that caused the error' })
  fieldName?: string;

  @Field({ description: 'Human-readable error message' })
  message: string;

  @Field({ nullable: true, description: 'Original row data for debugging' })
  rowData?: string;
}

/**
 * Summary response for bulk import initiation
 */
@ObjectType()
export class BulkImportSummary {
  @Field({ description: 'True if import was queued successfully' })
  success: boolean;

  @Field({ nullable: true, description: 'Job ID for tracking import progress' })
  importJobId?: string;

  @Field(() => Int, { description: 'Number of rows that will be processed' })
  totalRows: number;

  @Field(() => [RowValidationError], { nullable: true, description: 'Validation errors from frontend' })
  validationErrors?: RowValidationError[];

  @Field(() => Int, { description: 'Estimated time to complete import' })
  estimatedSeconds: number;
}

/**
 * Progress update for import job
 */
@ObjectType()
export class ImportJobProgress {
  @Field(() => ID, { description: 'Job ID' })
  jobId: string;

  @Field({ description: 'Current status' })
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Field(() => Int, { description: 'Rows processed so far' })
  rowsProcessed: number;

  @Field(() => Int, { description: 'Total rows to process' })
  totalRows: number;

  @Field(() => Int, { description: 'Properties created' })
  propertiesCreated: number;

  @Field(() => Int, { description: 'Units created' })
  unitsCreated: number;

  @Field(() => Int, { description: 'Tenants created' })
  tenantsCreated: number;

  @Field(() => Int, { description: 'Leases created' })
  leasesCreated: number;

  @Field(() => Int, { description: 'Charges created' })
  chargesCreated: number;

  @Field(() => Int, { description: 'Water meters linked' })
  metersLinked: number;

  @Field(() => [RowValidationError], { nullable: true })
  errors?: RowValidationError[];
}

/**
 * Input type not needed - using existing GetBulkUploadUrlInput
 * with MASTER_FLAT file type
 */
```

**Step 2: Export from DTO index**

- Modify: `realator_backend/app/src/modules/upload/dto/index.ts` (create if not exists)

```typescript
export * from './bulk-upload-input.dto';
export * from './csv-template.dto';
export * from './csv-validation.dto';
export * from './csv-new-data.dto';
export * from './upload-file-input.dto';
export * from './master-flat-upload.dto'; // NEW
```

**Step 3: Commit**

```bash
cd realator_backend
git add src/modules/upload/dto/master-flat-upload.dto.ts src/modules/upload/dto/index.ts
git commit -m "feat(upload): add master flat upload DTOs"
```

---

## Task 3: Create Master Flat CSV Parser Service

**Files:**
- Create: `realator_backend/app/src/modules/upload/services/master-flat-csv-parser.service.ts`
- Create: `realator_backend/app/src/modules/upload/services/master-flat-csv-parser.service.spec.ts`

**Step 1: Write the failing test**

```typescript
// master-flat-csv-parser.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MasterFlatCsvParserService } from './master-flat-csv-parser.service';
import { CsvRow } from '../upload.interfaces';

describe('MasterFlatCsvParserService', () => {
  let service: MasterFlatCsvParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MasterFlatCsvParserService],
    }).compile();

    service = module.get<MasterFlatCsvParserService>(MasterFlatCsvParserService);
  });

  describe('parseCsvRow', () => {
    it('should parse full tenant row with water meter', () => {
      const rawRow = {
        propertyName: 'Kite Estate',
        unitNumber: 'hse1',
        unitType: 'apartment',
        bedrooms: '1',
        bathrooms: '1',
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerPhone: '+254712345678',
        customerEmail: 'john@email.com',
        baseRent: '11200',
        rentFrequency: 'monthly',
        startDate: '2026-01-10',
        meterNumber: 'MTR-001',
        initialReading: '100',
        waterPricePerUnit: '50',
      };

      const result = service.parseCsvRow(rawRow, 1);

      expect(result.propertyName).toBe('Kite Estate');
      expect(result.unitNumber).toBe('hse1');
      expect(result.customerFirstName).toBe('John');
      expect(result.customerLastName).toBe('Doe');
      expect(result.baseRent).toBe(11200);
      expect(result.meterNumber).toBe('MTR-001');
      expect(result.rowType).toBe('FULL_TENANT');
    });

    it('should parse vacant unit row with meter', () => {
      const rawRow = {
        propertyName: 'Kite Estate',
        unitNumber: 'hse3',
        unitType: 'studio',
        bedrooms: '0',
        bathrooms: '1',
        meterNumber: 'MTR-003',
        initialReading: '500',
        waterPricePerUnit: '50',
      };

      const result = service.parseCsvRow(rawRow, 2);

      expect(result.propertyName).toBe('Kite Estate');
      expect(result.unitNumber).toBe('hse3');
      expect(result.rowType).toBe('VACANT_UNIT');
      expect(result.meterNumber).toBe('MTR-003');
    });

    it('should parse property only row', () => {
      const rawRow = {
        propertyName: 'Umma Estate',
      };

      const result = service.parseCsvRow(rawRow, 3);

      expect(result.propertyName).toBe('Umma Estate');
      expect(result.rowType).toBe('PROPERTY_ONLY');
    });

    it('should throw error if propertyName is missing', () => {
      const rawRow = {
        unitNumber: 'hse1',
      };

      expect(() => service.parseCsvRow(rawRow, 4)).toThrow('propertyName is required');
    });
  });

  describe('validateCsvRow', () => {
    it('should return valid for complete row', () => {
      const row: CsvRow = {
        propertyName: 'Kite Estate',
        unitNumber: 'hse1',
        customerFirstName: 'John',
        customerLastName: 'Doe',
        baseRent: 11200,
        startDate: '2026-01-10',
      };

      const result = service.validateCsvRow(row, 1);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for missing required tenant fields', () => {
      const row: CsvRow = {
        propertyName: 'Kite Estate',
        unitNumber: 'hse1',
        customerFirstName: 'John',
        // Missing lastName, baseRent, startDate
      };

      const result = service.validateCsvRow(row, 1);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate date format', () => {
      const row: CsvRow = {
        propertyName: 'Kite Estate',
        unitNumber: 'hse1',
        customerFirstName: 'John',
        customerLastName: 'Doe',
        baseRent: 11200,
        startDate: '01/10/2026', // Invalid format
      };

      const result = service.validateCsvRow(row, 1);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'startDate')).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd realator_backend
yarn test master-flat-csv-parser.service.spec.ts
```

Expected: FAIL with "service not defined"

**Step 3: Write minimal implementation**

```typescript
// master-flat-csv-parser.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CsvRow } from '../upload.interfaces';

export type RowType = 'PROPERTY_ONLY' | 'VACANT_UNIT' | 'FULL_TENANT';

export interface ParsedRow extends CsvRow {
  propertyName: string;
  rowType: RowType;
  rowIndex: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ row: number; field: string; message: string }>;
}

@Injectable()
export class MasterFlatCsvParserService {
  private readonly logger = new Logger(MasterFlatCsvParserService.name);
  private readonly REQUIRED_COLUMNS = [
    'propertyName',
    'unitNumber',
    'customerFirstName',
    'customerLastName',
    'baseRent',
    'startDate',
  ];

  /**
   * Parse raw CSV row into typed structure with row type detection
   */
  parseCsvRow(rawRow: CsvRow, rowIndex: number): ParsedRow {
    const propertyName = String(rawRow.propertyName || '').trim();

    if (!propertyName) {
      throw new Error(`Row ${rowIndex}: propertyName is required`);
    }

    const hasUnit = !!rawRow.unitNumber;
    const hasTenant = !!(rawRow.customerFirstName || rawRow.customerLastName);

    let rowType: RowType;
    if (!hasUnit) {
      rowType = 'PROPERTY_ONLY';
    } else if (hasTenant) {
      rowType = 'FULL_TENANT';
    } else {
      rowType = 'VACANT_UNIT';
    }

    // Convert numeric fields
    const parsed: ParsedRow = {
      ...rawRow,
      propertyName,
      rowType,
      rowIndex,
      baseRent: this.parseNumber(rawRow.baseRent),
      bedrooms: this.parseNumber(rawRow.bedrooms),
      bathrooms: this.parseNumber(rawRow.bathrooms),
      initialReading: this.parseNumber(rawRow.initialReading),
      waterPricePerUnit: this.parseNumber(rawRow.waterPricePerUnit),
    };

    return parsed;
  }

  /**
   * Validate a parsed row based on its type
   */
  validateCsvRow(row: ParsedRow | CsvRow, rowIndex: number): ValidationResult {
    const errors: Array<{ row: number; field: string; message: string }> = [];

    const propertyName = String(row.propertyName || '').trim();
    if (!propertyName) {
      errors.push({ row: rowIndex, field: 'propertyName', message: 'Property name is required' });
    }

    // Determine if this should be a tenant row
    const hasTenant = !!(row.customerFirstName || row.customerLastName);

    if (hasTenant) {
      // Tenant row validations
      if (!row.customerFirstName) {
        errors.push({ row: rowIndex, field: 'customerFirstName', message: 'First name is required for tenant' });
      }
      if (!row.customerLastName) {
        errors.push({ row: rowIndex, field: 'customerLastName', message: 'Last name is required for tenant' });
      }

      const baseRent = this.parseNumber(row.baseRent);
      if (!baseRent || baseRent <= 0) {
        errors.push({ row: rowIndex, field: 'baseRent', message: 'Base rent must be greater than 0' });
      }

      if (row.startDate) {
        if (!this.isValidDate(String(row.startDate))) {
          errors.push({ row: rowIndex, field: 'startDate', message: 'Invalid date format. Use YYYY-MM-DD' });
        }
      } else {
        errors.push({ row: rowIndex, field: 'startDate', message: 'Start date is required for tenant' });
      }
    }

    // Water meter validations (if present)
    if (row.meterNumber) {
      if (row.initialReading === undefined || row.initialReading === null) {
        errors.push({ row: rowIndex, field: 'initialReading', message: 'Initial reading is required when meter number is provided' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private parseNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const num = parseFloat(String(value));
    return isNaN(num) ? undefined : num;
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd realator_backend
yarn test master-flat-csv-parser.service.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd realator_backend
git add src/modules/upload/services/master-flat-csv-parser.service.ts src/modules/upload/services/master-flat-csv-parser.service.spec.ts
git commit -m "feat(upload): add master flat CSV parser service with tests"
```

---

## Task 4: Create Master Flat Processor

**Files:**
- Create: `realator_backend/app/src/modules/upload/processors/master-flat.processor.ts`
- Create: `realator_backend/app/src/modules/upload/processors/master-flat.processor.spec.ts`

**Step 1: Write the processor**

```typescript
import { QueryRunner } from 'typeorm';
import { PropertyEntity } from '../../properties/entities/property.entity';
import { UnitEntity } from '../../units/entities/unit.entity';
import { TenantEntity, TenantStatus } from '../../tenants/entities/tenant.entity';
import { LeaseEntity, LeaseStatus } from '../../leases/entities/lease.entity';
import { ChargeEntity } from '../../charges/entities/charge.entity';
import { UnitStatus, UnitLevel } from '../../shared/enums/unit.enums';
import { BaseProcessor } from './base.processor';
import { CsvRow, ImportResult, ImportProgress } from '../upload.interfaces';
import { normalizeName, normalizeEmail } from '../../../common/utils/string-normalizer';
import { ParsedRow, RowType } from '../services/master-flat-csv-parser.service';

/**
 * Processor for Master Flat CSV imports
 *
 * Handles:
 * - Property creation from propertyName
 * - Unit creation
 * - Tenant + Lease + Charge creation (FULL_TENANT rows)
 * - Water meter linking (optional)
 *
 * Row types:
 * - PROPERTY_ONLY: Creates/updates property only
 * - VACANT_UNIT: Creates property + unit (+ optional meter)
 * - FULL_TENANT: Creates property + unit + tenant + lease + charge (+ optional meter)
 */
export class MasterFlatProcessor extends BaseProcessor {
  constructor(
    uploadUUID: string,
    companyId: string,
    dataSource: any,
    pubSub: any,
    uploadRepository: any,
  ) {
    super(uploadUUID, companyId, dataSource, pubSub, uploadRepository, MasterFlatProcessor.name);
  }

  async process(csvData: CsvRow[], qr: QueryRunner): Promise<ImportResult> {
    const progress: ImportProgress = {
      total: csvData.length,
      processed: 0,
      created: { properties: 0, units: 0, tenants: 0, leases: 0, charges: 0 },
      errors: [],
    };

    const createdProperties = new Set<string>();
    const createdUnits = new Set<string>();
    const createdTenants = new Set<string>();

    this.logger.log({ totalRows: csvData.length, companyId: this.companyId }, 'Starting MasterFlatProcessor');

    for (let i = 0; i < csvData.length; i += BaseProcessor.BATCH_SIZE) {
      const batch = csvData.slice(i, i + BaseProcessor.BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const rowIndex = i + j;
        const row = batch[j] as ParsedRow;

        try {
          await qr.query('SAVEPOINT row_sp');

          const result = await this.processRow(
            row,
            qr,
            createdProperties,
            createdUnits,
            createdTenants,
          );

          if (result.propertyCreated) progress.created.properties++;
          if (result.unitCreated) progress.created.units++;
          if (result.tenantCreated) progress.created.tenants++;
          if (result.leaseCreated) progress.created.leases++;
          if (result.chargeCreated) progress.created.charges++;

          await qr.query('RELEASE SAVEPOINT row_sp');
          progress.processed++;

        } catch (error: any) {
          await qr.query('ROLLBACK TO SAVEPOINT row_sp');
          const errorMsg = error?.message || 'Unknown error';
          progress.errors.push({
            row: rowIndex + 1,
            message: errorMsg,
            data: { propertyName: row.propertyName, unitNumber: row.unitNumber },
          });
          this.logger.warn({
            row: rowIndex + 1,
            error: errorMsg,
            data: { propertyName: row.propertyName, unitNumber: row.unitNumber }
          }, 'Row processing failed');

          // Fail fast - stop processing on first error
          throw new Error(`Import failed at row ${rowIndex + 1}: ${errorMsg}`);
        }
      }

      await this.updateProgress(progress);
    }

    return {
      success: progress.errors.length === 0,
      summary: {
        total: progress.total,
        processed: progress.processed,
        succeeded: progress.processed - progress.errors.length,
        failed: progress.errors.length,
      },
      created: {
        properties: Array.from(createdProperties),
        units: Array.from(createdUnits),
        tenants: Array.from(createdTenants),
        leases: progress.created.leases,
        charges: progress.created.charges,
      },
      errors: progress.errors,
    };
  }

  private async processRow(
    row: ParsedRow,
    qr: QueryRunner,
    createdProperties: Set<string>,
    createdUnits: Set<string>,
    createdTenants: Set<string>,
  ): Promise<{
    propertyCreated: boolean;
    unitCreated: boolean;
    tenantCreated: boolean;
    leaseCreated: boolean;
    chargeCreated: boolean;
  }> {
    // Generate property code from property name
    const propertyCode = this.generatePropertyCode(String(row.propertyName || '').trim());

    // Step 1: Find or create Property
    const { property, created: propertyCreated } = await this.findOrCreateProperty(
      qr,
      String(row.propertyName || '').trim(),
      propertyCode,
      createdProperties
    );

    // If row type is PROPERTY_ONLY, we're done
    if (row.rowType === 'PROPERTY_ONLY') {
      return { propertyCreated, unitCreated: false, tenantCreated: false, leaseCreated: false, chargeCreated: false };
    }

    // Step 2: Find or create Unit
    const unitNumber = String(row.unitNumber || '').trim();
    if (!unitNumber) {
      throw new Error('unitNumber is required for unit creation');
    }

    const { unit, created: unitCreated } = await this.findOrCreateUnit(
      qr,
      property,
      unitNumber,
      row,
      createdUnits
    );

    // If row type is VACANT_UNIT, we're done (after handling water meter)
    if (row.rowType === 'VACANT_UNIT') {
      // TODO: Handle water meter linking if present
      return { propertyCreated, unitCreated, tenantCreated: false, leaseCreated: false, chargeCreated: false };
    }

    // Step 3: Process tenant (FULL_TENANT rows)
    const firstName = String(row.customerFirstName || '').trim();
    const lastName = String(row.customerLastName || '').trim();
    const phone = String(row.customerPhone || '').trim();
    const rawEmail = row.customerEmail ? String(row.customerEmail).trim() : '';

    const { tenant, created: tenantCreated } = await this.findOrCreateTenant(
      qr,
      firstName,
      lastName,
      rawEmail,
      phone,
      createdTenants
    );

    // Step 4: Create Lease and Charge
    const startDate = row.startDate ? new Date(String(row.startDate)) : new Date();
    const { leaseCreated, chargeCreated } = await this.createLeaseAndCharge(
      qr,
      property,
      unit,
      tenant,
      startDate,
      row
    );

    return { propertyCreated, unitCreated, tenantCreated, leaseCreated, chargeCreated };
  }

  /**
   * Generate property code from property name
   * e.g., "Kite Estate" -> "KITE"
   */
  private generatePropertyCode(propertyName: string): string {
    return propertyName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 20)
      .padEnd(20, '0');
  }

  /**
   * Find or create Property by name
   */
  private async findOrCreateProperty(
    qr: QueryRunner,
    propertyName: string,
    propertyCode: string,
    createdProperties: Set<string>
  ): Promise<{ property: PropertyEntity; created: boolean }> {
    // First try to find by name
    let property = await qr.manager.findOne(PropertyEntity, {
      where: { name: propertyName, companyId: this.companyId },
    });

    if (property) {
      this.logger.debug({ propertyName }, 'Found existing property by name');
      return { property, created: false };
    }

    // Try to find by code
    property = await qr.manager.findOne(PropertyEntity, {
      where: { code: propertyCode, companyId: this.companyId },
    });

    if (property) {
      this.logger.debug({ propertyCode }, 'Found existing property by code');
      return { property, created: false };
    }

    // Create new property
    this.logger.debug({ propertyName, propertyCode }, 'Creating new property');
    property = qr.manager.create(PropertyEntity, {
      name: propertyName,
      code: propertyCode,
      address: propertyName, // Use name as default address
      city: 'Kitengela',
      country: 'Kenya',
      propertyType: 'residential',
      companyId: this.companyId,
    });
    property = await qr.manager.save(property);
    createdProperties.add(property.name);
    return { property, created: true };
  }

  /**
   * Find or create Unit
   */
  private async findOrCreateUnit(
    qr: QueryRunner,
    property: PropertyEntity,
    unitNumber: string,
    row: ParsedRow,
    createdUnits: Set<string>
  ): Promise<{ unit: UnitEntity; created: boolean }> {
    const existingUnit = await qr.manager.findOne(UnitEntity, {
      where: { propertyId: property.id, unitNumber },
    });

    if (existingUnit) {
      this.logger.debug({ unitId: existingUnit.id }, 'Found existing unit');
      return { unit: existingUnit, created: false };
    }

    // Determine unit type from row or default
    const unitType = String(row.unitType || 'one_bedroom').trim();
    const level = this.mapLevel(row.unitLevel);

    const unit = qr.manager.create(UnitEntity, {
      companyId: this.companyId,
      propertyId: property.id,
      unitNumber,
      level,
      unitType,
      bedrooms: row.bedrooms ?? 0,
      bathrooms: row.bathrooms ?? 0,
      status: UnitStatus.AVAILABLE,
    });

    const saved = await qr.manager.save(unit);
    createdUnits.add(`${property.code}:${unitNumber}`);
    return { unit: saved, created: true };
  }

  /**
   * Find or create Tenant
   */
  private async findOrCreateTenant(
    qr: QueryRunner,
    firstName: string,
    lastName: string,
    rawEmail: string,
    phone: string,
    createdTenants: Set<string>
  ): Promise<{ tenant: TenantEntity; created: boolean }> {
    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);

    // Check by name
    const existingTenant = await qr.manager.findOne(TenantEntity, {
      where: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        companyId: this.companyId
      },
    });

    if (existingTenant) {
      this.logger.debug({ tenantId: existingTenant.id }, 'Found existing tenant');
      return { tenant: existingTenant, created: false };
    }

    // Check by email
    if (rawEmail) {
      const normalizedEmail = normalizeEmail(rawEmail);
      const existingByEmail = await qr.manager.findOne(TenantEntity, {
        where: { email: normalizedEmail, companyId: this.companyId },
      });
      if (existingByEmail) {
        return { tenant: existingByEmail, created: false };
      }
    }

    // Create new tenant
    const tenant = qr.manager.create(TenantEntity, {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: rawEmail || this.generateEmail(firstName, lastName),
      phone,
      status: TenantStatus.ACTIVE,
      companyId: this.companyId,
    });

    const saved = await qr.manager.save(tenant);
    createdTenants.add(`${normalizedFirstName} ${normalizedLastName}`);
    return { tenant: saved, created: true };
  }

  /**
   * Create Lease and Charge
   */
  private async createLeaseAndCharge(
    qr: QueryRunner,
    property: PropertyEntity,
    unit: UnitEntity,
    tenant: TenantEntity,
    startDate: Date,
    row: ParsedRow
  ): Promise<{ leaseCreated: boolean; chargeCreated: boolean }> {
    let leaseCreated = false;
    let chargeCreated = false;

    // Check for existing active lease
    const existingLease = await qr.manager.findOne(LeaseEntity, {
      where: {
        tenantId: tenant.id,
        unitId: unit.id,
        status: LeaseStatus.ACTIVE,
      },
    });

    let lease: LeaseEntity;

    if (!existingLease) {
      lease = qr.manager.create(LeaseEntity, {
        tenantId: tenant.id,
        unitId: unit.id,
        propertyId: property.id,
        startDate,
        status: LeaseStatus.ACTIVE,
        companyId: this.companyId,
      });
      lease = await qr.manager.save(lease);
      leaseCreated = true;
    } else {
      lease = existingLease;
    }

    // Create charge
    const baseRent = row.baseRent ?? 0;
    const chargeAmount = baseRent;

    const chargeDescription = 'Monthly rent';
    const dueDate = new Date();
    dueDate.setDate(5); // Default to 5th of month

    const existingCharge = await qr.manager.findOne(ChargeEntity, {
      where: {
        leaseId: lease.id,
        chargeType: 'RENT',
        status: TenantStatus.ACTIVE,
      },
    });

    if (!existingCharge) {
      const charge = qr.manager.create(ChargeEntity, {
        companyId: this.companyId,
        propertyId: property.id,
        unitId: unit.id,
        leaseId: lease.id,
        chargeType: 'RENT',
        description: chargeDescription,
        amount: chargeAmount,
        dueDate: dueDate,
        status: TenantStatus.ACTIVE,
        isRecurring: true,
      });
      await qr.manager.save(charge);
      chargeCreated = true;
    }

    return { leaseCreated, chargeCreated };
  }

  private generateEmail(firstName: string, lastName: string): string {
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    return cleanLast
      ? `${cleanFirst}.${cleanLast}.${uniqueSuffix}@example.com`
      : `${cleanFirst}.${uniqueSuffix}@example.com`;
  }

  private mapLevel(level: string | undefined): UnitLevel {
    const levelMap: Record<string, UnitLevel> = {
      'basement': UnitLevel.BASEMENT,
      'ground': UnitLevel.GROUND,
      'first': UnitLevel.FIRST,
      'second': UnitLevel.SECOND,
      'third': UnitLevel.THIRD,
      'fourth': UnitLevel.FOURTH,
      'fifth': UnitLevel.FIFTH,
      'penthouse': UnitLevel.PENTHOUSE,
    };
    return levelMap[String(level || '').toLowerCase()] ?? UnitLevel.GROUND;
  }
}
```

**Step 2: Update processor registry**

- Modify: `realator_backend/app/src/modules/upload/processors/index.ts` (create if not exists)

```typescript
export * from './base.processor';
export * from './property.processor';
export * from './unit.processor';
export * from './tenant.processor';
export * from './water-unit.processor';
export * from './water-reading.processor';
export * from './upload.processor';
export * from './master-flat.processor'; // NEW
```

**Step 3: Commit**

```bash
cd realator_backend
git add src/modules/upload/processors/master-flat.processor.ts src/modules/upload/processors/index.ts
git commit -m "feat(upload): add master flat processor for bulk import"
```

---

## Task 5: Wire Up Processor in Upload Service

**Files:**
- Modify: `realator_backend/app/src/modules/upload/services/upload-process.service.ts`

**Step 1: Add processor to factory method**

Find the processor selection logic (likely in `getProcessor` method) and add:

```typescript
import { MasterFlatProcessor } from '../processors/master-flat.processor';

// In getProcessor method or similar
case FILE_TYPE_ENUM.MASTER_FLAT:
  return new MasterFlatProcessor(
    uploadUUID,
    companyId,
    this.dataSource,
    this.pubSub,
    this.uploadRepository,
  );
```

**Step 2: Commit**

```bash
cd realator_backend
git add src/modules/upload/services/upload-process.service.ts
git commit -m "feat(upload): wire up master flat processor in upload service"
```

---

## Task 6: Register New Services in Upload Module

**Files:**
- Modify: `realator_backend/app/src/modules/upload/upload.module.ts`

**Step 1: Add imports and providers**

```typescript
// Add to imports
import { MasterFlatCsvParserService } from './services/master-flat-csv-parser.service';

// Add to providers array
providers: [
  // ... existing providers
  MasterFlatCsvParserService,
],

// Add to exports array
exports: [
  // ... existing exports
  MasterFlatCsvParserService,
],
```

**Step 2: Commit**

```bash
cd realator_backend
git add src/modules/upload/upload.module.ts
git commit -m "feat(upload): register master flat parser service in upload module"
```

---

## Task 7: Run GraphQL Code Generation

**Files:** None (command)

**Step 1: Generate GraphQL schema**

```bash
cd realator_backend
yarn generate
```

Expected: GraphQL schema updated with new types

**Step 2: Verify schema**

Check `dist/schema.gql` or similar for new types:
- `RowValidationError`
- `BulkImportSummary`
- `ImportJobProgress`
- `BulkImportFileType.MASTER_FLAT`

**Step 3: Commit generated schema**

```bash
cd realator_backend
git add dist/
git commit -m "chore: regenerate GraphQL schema for master flat import"
```

---

## Task 8: Manual Testing with Sample CSV

**Step 1: Create test CSV file**

- Create: `test-data/master-flat-test.csv`

```csv
propertyName,unitNumber,unitType,bedrooms,bathrooms,customerFirstName,customerLastName,customerPhone,customerEmail,baseRent,rentFrequency,startDate,meterNumber,initialReading,waterPricePerUnit
Kite Estate,hse1,apartment,1,1,John,Doe,+254712345678,john@email.com,11200,monthly,2026-01-10,MTR-001,100,50
Kite Estate,hse2,apartment,1,1,Jane,Smith,+254712345679,jane@email.com,11480,monthly,2026-01-10,,,
Kite Estate,hse3,studio,0,1,,,,,MTR-003,500,50
Kite Estate,hse4,bedsitter,1,0,,,,,
Umma Estate,,,,,,,,
```

**Step 2: Test via GraphQL Playground**

1. Start server: `yarn start:dev`
2. Open GraphQL Playground at `http://localhost:3333/graphql`
3. Run mutation:

```graphql
mutation {
  getBulkUploadUrl(input: {
    fileType: MASTER_FLAT
    fileName: "test.csv"
    mimeType: "text/csv"
    fileSize: 500
  }) {
    uploadUrl
    uploadUUID
    fileUrl
  }
}
```

**Step 3: Verify processing**

```graphql
subscription {
  uploadProgress(uploadUUID: "your-upload-id") {
    status
    processed
    total
    message
  }
}
```

---

## Frontend Tasks (Separate Implementation)

### Task 9: Create Frontend Upload Component

**Files:**
- Create: `frontend-analog-meter-project/src/app/modules/real-estate/components/bulk-import/bulk-import.component.ts`
- Create: `frontend-analog-meter-project/src/app/modules/real-estate/components/bulk-import/bulk-import.component.html`
- Create: `frontend-analog-meter-project/src/app/modules/real-estate/components/bulk-import/bulk-import.component.scss`

**Step 1: Generate component**

```bash
cd frontend-analog-meter-project
ng g component modules/real-estate/components/bulk-import --skip-tests
```

**Step 2: Implement CSV upload logic**

```typescript
// bulk-import.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Apollo, gql } from 'apollo-angular';
import { MatSnackBar } from '@angular/material/snack-bar';

const GET_BULK_UPLOAD_URL = gql`
  mutation GetBulkUploadUrl($input: GetBulkUploadUrlInput!) {
    getBulkUploadUrl(input: $input) {
      uploadUrl
      uploadUUID
      fileUrl
      s3Key
    }
  }
`;

const CONFIRM_BULK_UPLOAD = gql`
  mutation ConfirmBulkUpload($input: ConfirmBulkUploadInput!) {
    confirmBulkUpload(input: $input) {
      uploadId
      uploadUUID
      status
    }
  }
`;

const UPLOAD_PROGRESS = gql`
  subscription UploadProgress($uploadUUID: ID!) {
    uploadProgress(uploadUUID: $uploadUUID) {
      status
      processed
      total
      message
    }
  }
`;

@Component({
  selector: 'app-bulk-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-import.component.html',
  styleUrls: ['./bulk-import.component.scss'],
})
export class BulkImportComponent implements OnInit {
  selectedFile: File | null = null;
  uploading = false;
  uploadProgress = { processed: 0, total: 0, status: 'IDLE', message: '' };
  uploadUUID: string | null = null;

  constructor(
    private apollo: Apollo,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  async uploadFile(): Promise<void> {
    if (!this.selectedFile) {
      this.snackBar.open('Please select a file', 'Close', { duration: 3000 });
      return;
    }

    this.uploading = true;

    try {
      // Step 1: Get presigned URL
      const urlResult = await this.apollo.mutate({
        mutation: GET_BULK_UPLOAD_URL,
        variables: {
          input: {
            fileType: 'MASTER_FLAT',
            fileName: this.selectedFile.name,
            mimeType: this.selectedFile.type,
            fileSize: this.selectedFile.size,
          },
        },
      }).toPromise();

      const { uploadUrl, uploadUUID } = (urlResult as any).data.getBulkUploadUrl;
      this.uploadUUID = uploadUUID;

      // Step 2: Upload to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: this.selectedFile,
        headers: { 'Content-Type': this.selectedFile.type },
      });

      // Step 3: Confirm upload
      await this.apollo.mutate({
        mutation: CONFIRM_BULK_UPLOAD,
        variables: {
          input: {
            uploadUUID,
            s3Key: uploadUUID, // May need adjustment
            fileType: 'MASTER_FLAT',
          },
        },
      }).toPromise();

      // Step 4: Subscribe to progress
      this.subscribeToProgress();

    } catch (error) {
      console.error('Upload failed', error);
      this.snackBar.open('Upload failed', 'Close', { duration: 3000 });
      this.uploading = false;
    }
  }

  private subscribeToProgress(): void {
    this.apollo.subscribe({
      query: UPLOAD_PROGRESS,
      variables: { uploadUUID: this.uploadUUID },
    }).subscribe(({ data }: any) => {
      this.uploadProgress = data.uploadProgress;
      if (data.uploadProgress.status === 'COMPLETED') {
        this.uploading = false;
        this.snackBar.open('Import completed!', 'Close', { duration: 3000 });
      }
    });
  }
}
```

**Step 3: Create template**

```html
<div class="bulk-import-container">
  <h2>Bulk Property Import</h2>
  <p class="instructions">
    Upload a CSV file with properties, units, tenants, and water meters.
    <a href="/assets/master-flat-template.csv">Download template</a>
  </p>

  <div class="upload-section">
    <input
      type="file"
      accept=".csv"
      (change)="onFileSelected($event)"
      [disabled]="uploading"
    />

    <button
      mat-button
      (click)="uploadFile()"
      [disabled]="!selectedFile || uploading"
    >
      {{ uploading ? 'Uploading...' : 'Upload CSV' }}
    </button>
  </div>

  <div *ngIf="uploading" class="progress-section">
    <mat-progress-bar
      mode="determinate"
      [value]="(uploadProgress.processed / uploadProgress.total) * 100"
    ></mat-progress-bar>
    <p>{{ uploadProgress.message }}</p>
    <p>{{ uploadProgress.processed }} / {{ uploadProgress.total }} rows processed</p>
  </div>
</div>
```

**Step 4: Commit**

```bash
cd frontend-analog-meter-project
git add src/app/modules/real-estate/components/bulk-import/
git commit -m "feat(real-estate): add bulk import component for master flat CSV"
```

---

## Summary

**Files Created:**
- `realator_backend/app/src/modules/upload/dto/master-flat-upload.dto.ts`
- `realator_backend/app/src/modules/upload/services/master-flat-csv-parser.service.ts`
- `realator_backend/app/src/modules/upload/services/master-flat-csv-parser.service.spec.ts`
- `realator_backend/app/src/modules/upload/processors/master-flat.processor.ts`
- `frontend-analog-meter-project/src/app/modules/real-estate/components/bulk-import/`

**Files Modified:**
- `realator_backend/app/src/modules/upload/enums/file-type.enum.ts`
- `realator_backend/app/src/modules/upload/dto/bulk-upload-input.dto.ts`
- `realator_backend/app/src/modules/upload/resolvers/bulk-upload.resolver.ts`
- `realator_backend/app/src/modules/upload/services/upload-process.service.ts`
- `realator_backend/app/src/modules/upload/upload.module.ts`

**Estimated Completion:** 2-3 hours for backend, 1-2 hours for frontend
