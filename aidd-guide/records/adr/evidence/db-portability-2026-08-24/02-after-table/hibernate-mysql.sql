create table SEQ_LO_ACCESS (next_val bigint) engine=InnoDB;
insert into SEQ_LO_ACCESS ( next_val ) values ( 1 );
create table SYS_LO_ACCESS (id bigint not null, MENU_CD varchar(30), USER_ID varchar(30), TRACE_ID varchar(36), CLIENT_IP varchar(45), REQUEST_URI varchar(500), PARAMETERS longtext character set utf8mb4, primary key (id)) engine=InnoDB;
create table SYS_LO_ACCESS_FIXED (id bigint not null, PARAMS_LEN mediumtext, PARAMS_LONG32 tinytext, PARAMS_NLONG32 longtext character set utf8mb4, primary key (id)) engine=InnoDB;
create table SYS_SEQUENCE (NEXT_VAL bigint, SEQ_NAME varchar(255) not null, primary key (SEQ_NAME)) engine=InnoDB;
insert into SYS_SEQUENCE(SEQ_NAME, NEXT_VAL) values ('SYS_LO_ACCESS',1);
