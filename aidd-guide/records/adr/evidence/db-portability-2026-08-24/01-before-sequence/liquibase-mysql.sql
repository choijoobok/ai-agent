--  *********************************************************************
--  Update Database Script
--  *********************************************************************
--  Change Log: db/changelog/db.changelog-master.xml
--  Ran at: 26. 8. 24. 오후 1:26
--  Against: null@offline:mysql
--  Liquibase version: 5.0.4
--  *********************************************************************

--  Changeset db/changelog/db.changelog-master.xml::001-sequence::spike
--  Changeset db/changelog/db.changelog-master.xml::002-table::spike
CREATE TABLE SYS_LO_ACCESS (ID BIGINT NOT NULL, USER_ID VARCHAR(30) NULL, MENU_CD VARCHAR(30) NULL, REQUEST_URI VARCHAR(500) NULL, PARAMETERS LONGTEXT NULL, CLIENT_IP VARCHAR(45) NULL, TRACE_ID CHAR(36) NULL, CONSTRAINT PK_SYS_LO_ACCESS PRIMARY KEY (ID));

