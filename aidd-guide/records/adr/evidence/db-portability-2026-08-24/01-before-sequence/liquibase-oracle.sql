-- *********************************************************************
-- Update Database Script
-- *********************************************************************
-- Change Log: db/changelog/db.changelog-master.xml
-- Ran at: 26. 8. 24. 오후 1:26
-- Against: null@offline:oracle
-- Liquibase version: 5.0.4
-- *********************************************************************

-- Changeset db/changelog/db.changelog-master.xml::001-sequence::spike
CREATE SEQUENCE SEQ_LO_ACCESS START WITH 1 INCREMENT BY 50;

-- Changeset db/changelog/db.changelog-master.xml::002-table::spike
CREATE TABLE SYS_LO_ACCESS (ID NUMBER(38, 0) NOT NULL, USER_ID VARCHAR2(30), MENU_CD VARCHAR2(30), REQUEST_URI VARCHAR2(500), PARAMETERS CLOB, CLIENT_IP VARCHAR2(45), TRACE_ID CHAR(36), CONSTRAINT PK_SYS_LO_ACCESS PRIMARY KEY (ID));

