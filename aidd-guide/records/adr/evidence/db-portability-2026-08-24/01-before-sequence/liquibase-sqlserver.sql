-- *********************************************************************
-- Update Database Script
-- *********************************************************************
-- Change Log: db/changelog/db.changelog-master.xml
-- Ran at: 26. 8. 24. 오후 1:26
-- Against: null@offline:mssql
-- Liquibase version: 5.0.4
-- *********************************************************************

-- Changeset db/changelog/db.changelog-master.xml::001-sequence::spike
CREATE SEQUENCE SEQ_LO_ACCESS START WITH 1 INCREMENT BY 50;
GO

-- Changeset db/changelog/db.changelog-master.xml::002-table::spike
CREATE TABLE SYS_LO_ACCESS (ID bigint NOT NULL, USER_ID varchar(30), MENU_CD varchar(30), REQUEST_URI varchar(500), PARAMETERS varchar(MAX), CLIENT_IP varchar(45), TRACE_ID char(36), CONSTRAINT PK_SYS_LO_ACCESS PRIMARY KEY (ID));
GO

