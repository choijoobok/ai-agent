-- *********************************************************************
-- Update Database Script
-- *********************************************************************
-- Change Log: db/changelog/db.changelog-master.xml
-- Ran at: 26. 8. 24. 오후 1:44
-- Against: null@offline:mssql
-- Liquibase version: 5.0.4
-- *********************************************************************

-- Changeset db/changelog/db.changelog-master.xml::001-id-generator::spike
CREATE TABLE SYS_SEQUENCE (SEQ_NAME varchar(255) NOT NULL, NEXT_VAL bigint NOT NULL, CONSTRAINT PK_SYS_SEQUENCE PRIMARY KEY (SEQ_NAME));
GO

IF EXISTS(  SELECT extended_properties.value FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.SYS_SEQUENCE') AND name = N'MS_DESCRIPTION' AND minor_id = 0 ) BEGIN  EXEC sys.sp_updateextendedproperty @name = N'MS_Description' , @value = N'ID 생성기 — 논리 시퀀스마다 한 행' , @level0type = N'SCHEMA' , @level0name = N'dbo' , @level1type = N'TABLE' , @level1name = N'SYS_SEQUENCE' END  ELSE  BEGIN  EXEC sys.sp_addextendedproperty @name = N'MS_Description' , @value = N'ID 생성기 — 논리 시퀀스마다 한 행' , @level0type = N'SCHEMA' , @level0name = N'dbo' , @level1type = N'TABLE' , @level1name = N'SYS_SEQUENCE' END;
GO

-- Changeset db/changelog/db.changelog-master.xml::002-id-generator-seed::spike
INSERT INTO SYS_SEQUENCE (SEQ_NAME, NEXT_VAL) VALUES ('SYS_LO_ACCESS', 1);
GO

-- Changeset db/changelog/db.changelog-master.xml::003-table::spike
CREATE TABLE SYS_LO_ACCESS (ID bigint NOT NULL, USER_ID varchar(30), MENU_CD varchar(30), REQUEST_URI varchar(500), PARAMETERS nvarchar(MAX), CLIENT_IP varchar(45), TRACE_ID char(36), CONSTRAINT PK_SYS_LO_ACCESS PRIMARY KEY (ID));
GO

