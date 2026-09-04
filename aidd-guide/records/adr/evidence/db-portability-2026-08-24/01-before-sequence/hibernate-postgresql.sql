create sequence SEQ_LO_ACCESS start with 1 increment by 50;
create table SYS_LO_ACCESS (id bigint not null, MENU_CD varchar(30), USER_ID varchar(30), TRACE_ID varchar(36), CLIENT_IP varchar(45), REQUEST_URI varchar(500), PARAMETERS oid, primary key (id));
create table SYS_LO_ACCESS_FIXED (id bigint not null, PARAMS_LEN varchar(1048576), PARAMS_LONG32 text, PARAMS_NLONG32 text, primary key (id));
