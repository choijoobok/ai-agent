-- *********************************************************************
-- Update Database Script
-- *********************************************************************
-- Change Log: db/changelog/db.changelog-master.xml
-- Ran at: 26. 8. 24. 오후 1:26
-- Against: null@offline:postgresql
-- Liquibase version: 5.0.4
-- *********************************************************************

-- Changeset db/changelog/db.changelog-master.xml::001-sequence::spike
CREATE SEQUENCE  IF NOT EXISTS SEQ_LO_ACCESS START WITH 1 INCREMENT BY 50;

-- Changeset db/changelog/db.changelog-master.xml::002-table::spike
CREATE TABLE SYS_LO_ACCESS (ID BIGINT NOT NULL, USER_ID VARCHAR(30), MENU_CD VARCHAR(30), REQUEST_URI VARCHAR(500), PARAMETERS TEXT, CLIENT_IP VARCHAR(45), TRACE_ID CHAR(36), CONSTRAINT "SYS_LO_ACCESS_pkey" PRIMARY KEY (ID));

