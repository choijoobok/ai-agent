--  *********************************************************************
--  Update Database Script
--  *********************************************************************
--  Change Log: db/changelog/db.changelog-master.xml
--  Ran at: 26. 8. 24. 오후 1:44
--  Against: null@offline:mysql
--  Liquibase version: 5.0.4
--  *********************************************************************

--  Changeset db/changelog/db.changelog-master.xml::001-id-generator::spike
CREATE TABLE SYS_SEQUENCE (SEQ_NAME VARCHAR(255) NOT NULL, NEXT_VAL BIGINT NOT NULL, CONSTRAINT PK_SYS_SEQUENCE PRIMARY KEY (SEQ_NAME)) COMMENT='ID 생성기 — 논리 시퀀스마다 한 행';

--  Changeset db/changelog/db.changelog-master.xml::002-id-generator-seed::spike
INSERT INTO SYS_SEQUENCE (SEQ_NAME, NEXT_VAL) VALUES ('SYS_LO_ACCESS', 1);

--  Changeset db/changelog/db.changelog-master.xml::003-table::spike
CREATE TABLE SYS_LO_ACCESS (ID BIGINT NOT NULL, USER_ID VARCHAR(30) NULL, MENU_CD VARCHAR(30) NULL, REQUEST_URI VARCHAR(500) NULL, PARAMETERS LONGTEXT CHARACTER SET utf8 NULL, CLIENT_IP VARCHAR(45) NULL, TRACE_ID CHAR(36) NULL, CONSTRAINT PK_SYS_LO_ACCESS PRIMARY KEY (ID));

