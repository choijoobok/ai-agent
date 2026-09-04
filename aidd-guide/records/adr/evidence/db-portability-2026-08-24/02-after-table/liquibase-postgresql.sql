-- *********************************************************************
-- Update Database Script
-- *********************************************************************
-- Change Log: db/changelog/db.changelog-master.xml
-- Ran at: 26. 8. 24. 오후 1:44
-- Against: null@offline:postgresql
-- Liquibase version: 5.0.4
-- *********************************************************************

-- Changeset db/changelog/db.changelog-master.xml::001-id-generator::spike
CREATE TABLE SYS_SEQUENCE (SEQ_NAME VARCHAR(255) NOT NULL, NEXT_VAL BIGINT NOT NULL, CONSTRAINT "SYS_SEQUENCE_pkey" PRIMARY KEY (SEQ_NAME));

COMMENT ON TABLE SYS_SEQUENCE IS 'ID 생성기 — 논리 시퀀스마다 한 행';

-- Changeset db/changelog/db.changelog-master.xml::002-id-generator-seed::spike
INSERT INTO SYS_SEQUENCE (SEQ_NAME, NEXT_VAL) VALUES ('SYS_LO_ACCESS', 1);

-- Changeset db/changelog/db.changelog-master.xml::003-table::spike
CREATE TABLE SYS_LO_ACCESS (ID BIGINT NOT NULL, USER_ID VARCHAR(30), MENU_CD VARCHAR(30), REQUEST_URI VARCHAR(500), PARAMETERS TEXT, CLIENT_IP VARCHAR(45), TRACE_ID CHAR(36), CONSTRAINT "SYS_LO_ACCESS_pkey" PRIMARY KEY (ID));

