-- =============================================================================
-- Small Data Center Inventory - Full SQL Server Schema
-- =============================================================================
-- Run this script to create or update the entire database schema.
-- Works for: new database (creates all tables) or existing (adds missing objects).
--
-- Usage:
--   SSMS: Open file, select database (e.g. AssetManagement), Execute (F5).
--   sqlcmd: sqlcmd -S localhost -d AssetManagement -i "server/docs/full-schema.sql" -U sa -P YourPassword
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Equipment inventory
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Assets', N'U') IS NULL
CREATE TABLE dbo.Assets (
  Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  Name NVARCHAR(255) NOT NULL,
  Type NVARCHAR(100) NOT NULL,
  SerialNumber NVARCHAR(255) NOT NULL UNIQUE,
  Status NVARCHAR(50) NOT NULL DEFAULT N'In Service' CHECK (Status IN (N'In Service', N'Spare', N'Maintenance', N'Decommissioned')),
  Vendor NVARCHAR(255) NOT NULL,
  PurchaseDate NVARCHAR(50) NOT NULL,
  WarrantyExpiry NVARCHAR(50) NULL,
  Room NVARCHAR(255) NULL,
  Rack NVARCHAR(100) NULL,
  RackUnit NVARCHAR(50) NULL,
  ManagementIp NVARCHAR(45) NULL,
  InvoicePath NVARCHAR(500) NULL,
  InvoiceNumber NVARCHAR(255) NULL,
  InvoiceId INT NULL,
  AddedAt NVARCHAR(50) NOT NULL DEFAULT CONVERT(NVARCHAR(50), GETDATE(), 126)
);

-- Add data-center placement and management-network fields to existing installs.
IF OBJECT_ID(N'dbo.Assets', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Assets', 'Room') IS NULL ALTER TABLE dbo.Assets ADD Room NVARCHAR(255) NULL;
  IF COL_LENGTH('dbo.Assets', 'Rack') IS NULL ALTER TABLE dbo.Assets ADD Rack NVARCHAR(100) NULL;
  IF COL_LENGTH('dbo.Assets', 'RackUnit') IS NULL ALTER TABLE dbo.Assets ADD RackUnit NVARCHAR(50) NULL;
  IF COL_LENGTH('dbo.Assets', 'ManagementIp') IS NULL ALTER TABLE dbo.Assets ADD ManagementIp NVARCHAR(45) NULL;
END;

IF OBJECT_ID(N'dbo.Repairs', N'U') IS NULL
CREATE TABLE dbo.Repairs (
  Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  AssetId INT NOT NULL REFERENCES dbo.Assets(Id),
  IssueDescription NVARCHAR(MAX) NOT NULL,
  RepairVendor NVARCHAR(255) NULL,
  Cost FLOAT NULL,
  Status NVARCHAR(50) NOT NULL DEFAULT N'Pending' CHECK (Status IN (N'Pending', N'In Progress', N'Completed')),
  StartDate NVARCHAR(50) NOT NULL DEFAULT CONVERT(NVARCHAR(50), GETDATE(), 126),
  CompletedDate NVARCHAR(50) NULL
);

-- Convert legacy assignment-oriented statuses to equipment lifecycle statuses.
DECLARE @statusConstraintName sysname;
DECLARE @dropStatusSql nvarchar(max);
DECLARE statusConstraints CURSOR LOCAL FAST_FORWARD FOR
  SELECT name
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.Assets')
    AND definition LIKE N'%Status%';

OPEN statusConstraints;
FETCH NEXT FROM statusConstraints INTO @statusConstraintName;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @dropStatusSql = N'ALTER TABLE dbo.Assets DROP CONSTRAINT ' + QUOTENAME(@statusConstraintName);
  EXEC sys.sp_executesql @dropStatusSql;
  FETCH NEXT FROM statusConstraints INTO @statusConstraintName;
END;
CLOSE statusConstraints;
DEALLOCATE statusConstraints;

DECLARE @statusDefaultConstraint sysname;
SELECT @statusDefaultConstraint = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
  ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Assets') AND c.name = N'Status';

IF @statusDefaultConstraint IS NOT NULL
BEGIN
  SET @dropStatusSql = N'ALTER TABLE dbo.Assets DROP CONSTRAINT ' + QUOTENAME(@statusDefaultConstraint);
  EXEC sys.sp_executesql @dropStatusSql;
END;

UPDATE dbo.Assets
SET Status = CASE Status
  WHEN N'Available' THEN N'Spare'
  WHEN N'Assigned' THEN N'In Service'
  WHEN N'In Repair' THEN N'Maintenance'
  WHEN N'Retired' THEN N'Decommissioned'
  ELSE Status
END;

ALTER TABLE dbo.Assets
ADD CONSTRAINT CK_Assets_OperationalStatus
CHECK (Status IN (N'In Service', N'Spare', N'Maintenance', N'Decommissioned'));

ALTER TABLE dbo.Assets
ADD CONSTRAINT DF_Assets_Status_DataCenter DEFAULT N'In Service' FOR Status;

-- -----------------------------------------------------------------------------
-- 3. Invoices
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Invoices', N'U') IS NULL
CREATE TABLE dbo.Invoices (
  Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  AssetId INT NOT NULL REFERENCES dbo.Assets(Id),
  InvoiceNumber NVARCHAR(255) NULL,
  OriginalFileName NVARCHAR(500) NOT NULL,
  StoredPath NVARCHAR(500) NOT NULL,
  UploadedAt NVARCHAR(50) NOT NULL DEFAULT CONVERT(NVARCHAR(50), GETDATE(), 126)
);

-- -----------------------------------------------------------------------------
-- 4. Assets.InvoiceId FK (for shared invoices)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Invoices', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.Assets', 'InvoiceId') IS NULL
BEGIN
  ALTER TABLE dbo.Assets ADD InvoiceId INT NULL;
END;

IF OBJECT_ID(N'dbo.Invoices', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.Assets', 'InvoiceId') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.foreign_keys
     WHERE name = N'FK_Assets_InvoiceId_Invoices'
   )
BEGIN
  ALTER TABLE dbo.Assets
  ADD CONSTRAINT FK_Assets_InvoiceId_Invoices
  FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoices(Id);
END;

-- -----------------------------------------------------------------------------
-- 5. Software Licenses
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.SoftwareLicenses', N'U') IS NULL
CREATE TABLE dbo.SoftwareLicenses (
  Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  Name NVARCHAR(255) NOT NULL,
  Vendor NVARCHAR(255) NOT NULL,
  PurchaseDate NVARCHAR(50) NOT NULL,
  ExpiryDate NVARCHAR(50) NOT NULL,
  Cost FLOAT NOT NULL,
  CreatedAt NVARCHAR(50) NOT NULL DEFAULT CONVERT(NVARCHAR(50), GETDATE(), 126)
);

-- -----------------------------------------------------------------------------
-- 6. Admins (admin login)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Admins', N'U') IS NULL
CREATE TABLE dbo.Admins (
  Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  Username NVARCHAR(255) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(255) NOT NULL,
  Role NVARCHAR(20) NOT NULL CONSTRAINT DF_Admins_Role DEFAULT N'Admin',
  CreatedAt NVARCHAR(50) NOT NULL DEFAULT CONVERT(NVARCHAR(50), GETDATE(), 126)
);

IF COL_LENGTH('dbo.Admins', 'Role') IS NULL
  ALTER TABLE dbo.Admins ADD Role NVARCHAR(20) NOT NULL
    CONSTRAINT DF_Admins_Role DEFAULT N'Admin' WITH VALUES;

UPDATE dbo.Admins
SET Role = N'Admin'
WHERE Role IS NULL OR LTRIM(RTRIM(Role)) = N'';

-- =============================================================================
-- End of full schema
-- =============================================================================
