create sequence SEQ_LO_ACCESS start with 1 increment by 50 nocache;
create table SYS_LO_ACCESS (id bigint not null, MENU_CD varchar(30), USER_ID varchar(30), TRACE_ID varchar(36), CLIENT_IP varchar(45), REQUEST_URI varchar(500), PARAMETERS tinytext, primary key (id)) engine=InnoDB;
create table SYS_LO_ACCESS_FIXED (id bigint not null, PARAMS_NLONG32 longtext, PARAMS_LEN mediumtext, PARAMS_LONG32 tinytext, primary key (id)) engine=InnoDB;
