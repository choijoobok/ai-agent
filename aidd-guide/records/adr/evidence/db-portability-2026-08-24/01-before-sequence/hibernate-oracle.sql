create sequence SEQ_LO_ACCESS start with 1 increment by 50;
create table SYS_LO_ACCESS (id number(19,0) not null, MENU_CD varchar2(30 char), USER_ID varchar2(30 char), TRACE_ID varchar2(36 char), CLIENT_IP varchar2(45 char), REQUEST_URI varchar2(500 char), PARAMETERS clob, primary key (id));
create table SYS_LO_ACCESS_FIXED (id number(19,0) not null, PARAMS_LEN clob, PARAMS_LONG32 clob, PARAMS_NLONG32 nclob, primary key (id));
