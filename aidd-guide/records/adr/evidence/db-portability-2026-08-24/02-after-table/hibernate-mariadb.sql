create sequence SEQ_LO_ACCESS start with 1 increment by 50 nocache;
create table SYS_LO_ACCESS (id bigint not null, MENU_CD varchar(30), USER_ID varchar(30), TRACE_ID varchar(36), CLIENT_IP varchar(45), REQUEST_URI varchar(500), PARAMETERS longtext, primary key (id)) engine=InnoDB;
create table SYS_LO_ACCESS_FIXED (id bigint not null, PARAMS_NLONG32 longtext, PARAMS_LEN mediumtext, PARAMS_LONG32 tinytext, primary key (id)) engine=InnoDB;
create table SYS_SEQUENCE (NEXT_VAL bigint, SEQ_NAME varchar(255) not null, primary key (SEQ_NAME)) engine=InnoDB;
insert into SYS_SEQUENCE(SEQ_NAME, NEXT_VAL) values ('SYS_LO_ACCESS',1);
