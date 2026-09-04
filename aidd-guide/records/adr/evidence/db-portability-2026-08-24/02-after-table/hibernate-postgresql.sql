create sequence SEQ_LO_ACCESS start with 1 increment by 50;
create table SYS_LO_ACCESS (id bigint not null, MENU_CD varchar(30), USER_ID varchar(30), TRACE_ID varchar(36), CLIENT_IP varchar(45), REQUEST_URI varchar(500), PARAMETERS text, primary key (id));
create table SYS_LO_ACCESS_FIXED (id bigint not null, PARAMS_LEN varchar(1048576), PARAMS_LONG32 text, PARAMS_NLONG32 text, primary key (id));
create table SYS_SEQUENCE (NEXT_VAL bigint, SEQ_NAME varchar(255) not null, primary key (SEQ_NAME));
insert into SYS_SEQUENCE(SEQ_NAME, NEXT_VAL) values ('SYS_LO_ACCESS',1);
