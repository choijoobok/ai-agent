--liquibase formatted sql
--changeset baseline:system-001-schema

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: sys_api; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_api (
    api_url character varying(200) NOT NULL,
    api_nm character varying(100) NOT NULL,
    api_desc character varying(500),
    action_cd character varying(20) NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_batch_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_batch_history (
    hist_id bigint NOT NULL,
    batch_id character varying(50) NOT NULL,
    exec_type_cd character varying(20) NOT NULL,
    node_id character varying(100) NOT NULL,
    start_dtm timestamp with time zone NOT NULL,
    end_dtm timestamp with time zone,
    elapsed_ms bigint,
    rslt_cd character varying(20) NOT NULL,
    rslt_msg character varying(1000),
    rslt_dtl_msg text,
    err_msg text,
    cancel_req_dtm timestamp with time zone
);


--
-- Name: sys_cache_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_cache_version (
    cache_name character varying(50) NOT NULL,
    version bigint NOT NULL,
    mod_dtm timestamp with time zone
);


--
-- Name: sys_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_code (
    grp_cd character varying(30) NOT NULL,
    dtl_cd character varying(30) NOT NULL,
    dtl_nm character varying(200) NOT NULL,
    dtl_desc character varying(500),
    sys_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    sort_no integer DEFAULT 0 NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_code_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_code_group (
    grp_cd character varying(30) NOT NULL,
    grp_nm character varying(100) NOT NULL,
    grp_desc character varying(500),
    sys_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    sort_no integer DEFAULT 0 NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_code_grp_ref; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_code_grp_ref (
    grp_cd character varying(30) NOT NULL,
    ref_cd character varying(30) NOT NULL,
    ref_nm character varying(100) NOT NULL,
    ref_desc character varying(500),
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_code_ref; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_code_ref (
    grp_cd character varying(30) NOT NULL,
    dtl_cd character varying(30) NOT NULL,
    ref_cd character varying(30) NOT NULL,
    ref_val character varying(200) NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_config (
    cfg_key character varying(100) NOT NULL,
    cfg_val character varying(1000) NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_lo_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_lo_access (
    access_log_seq bigint NOT NULL,
    user_id character varying(30),
    menu_cd character varying(30),
    request_uri character varying(500) NOT NULL,
    http_stat smallint NOT NULL,
    parameters text,
    client_ip character varying(45),
    trace_id character varying(64),
    cre_dtm timestamp with time zone NOT NULL
);


--
-- Name: sys_lo_exception; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_lo_exception (
    exception_log_seq bigint NOT NULL,
    user_id character varying(30),
    menu_cd character varying(30),
    request_uri character varying(500) NOT NULL,
    http_stat smallint NOT NULL,
    err_cd character varying(50),
    err_msg character varying(1000),
    root_cause_stack text,
    client_ip character varying(45),
    trace_id character varying(64),
    cre_dtm timestamp with time zone NOT NULL
);


--
-- Name: sys_lo_login; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_lo_login (
    login_log_seq bigint NOT NULL,
    user_id character varying(30),
    login_rslt_cd character varying(20) NOT NULL,
    client_ip character varying(45),
    user_agent character varying(500),
    trace_id character varying(64),
    cre_dtm timestamp with time zone NOT NULL
);


--
-- Name: sys_menu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_menu (
    menu_cd character varying(30) NOT NULL,
    up_menu_cd character varying(30),
    menu_nm character varying(100) NOT NULL,
    menu_url character varying(200),
    icon_cd character varying(50),
    sort_no integer DEFAULT 0 NOT NULL,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone,
    export_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    src_cd character varying(10) DEFAULT 'USER'::character varying NOT NULL
);


--
-- Name: sys_menu_api; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_menu_api (
    menu_cd character varying(30) NOT NULL,
    api_url character varying(200) NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_message (
    msg_key character varying(200) NOT NULL,
    lang_cd character varying(10) NOT NULL,
    msg_val character varying(2000),
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_message_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_message_key (
    msg_key character varying(200) NOT NULL,
    use_scope character varying(10) NOT NULL,
    msg_desc character varying(500),
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_noti_inbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_noti_inbox (
    noti_id bigint NOT NULL,
    user_id character varying(30) NOT NULL,
    noti_type_cd character varying(30) NOT NULL,
    title character varying(500) NOT NULL,
    content character varying(2000),
    link_menu_cd character varying(30),
    link_param character varying(500),
    read_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    read_dtm timestamp with time zone,
    cre_dtm timestamp with time zone NOT NULL
);


--
-- Name: sys_noti_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_noti_request (
    req_id bigint NOT NULL,
    user_id character varying(30) NOT NULL,
    req_type_cd character varying(30) NOT NULL,
    req_content character varying(2000) NOT NULL,
    req_stat_cd character varying(20) DEFAULT 'RECEIVED'::character varying NOT NULL,
    handler_id character varying(30),
    handle_dtm timestamp with time zone,
    handle_memo character varying(2000),
    cre_dtm timestamp with time zone NOT NULL
);


--
-- Name: sys_notice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_notice (
    notice_id bigint NOT NULL,
    title character varying(500) NOT NULL,
    content text NOT NULL,
    content_type_cd character varying(20) DEFAULT 'TEXT'::character varying NOT NULL,
    notice_from_dtm timestamp with time zone NOT NULL,
    notice_to_dtm timestamp with time zone,
    popup_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    popup_from_dtm timestamp with time zone,
    popup_to_dtm timestamp with time zone,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    sort_no integer DEFAULT 0 NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_role (
    role_id character varying(30) NOT NULL,
    role_nm character varying(100) NOT NULL,
    role_desc character varying(500),
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_role_menu_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_role_menu_auth (
    role_id character varying(30) NOT NULL,
    menu_cd character varying(30) NOT NULL,
    action_cd character varying(20) NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_schedule_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_schedule_batch (
    batch_id character varying(50) NOT NULL,
    batch_nm character varying(100) NOT NULL,
    batch_desc character varying(500) NOT NULL,
    bean_id character varying(100) NOT NULL,
    cron character varying(50) NOT NULL,
    param_json character varying(2000),
    lock_expiry_sec integer NOT NULL,
    lock_min_interval_sec integer NOT NULL,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    sort_no integer DEFAULT 0 NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone,
    timezone character varying(64) DEFAULT 'Asia/Seoul'::character varying NOT NULL
);


--
-- Name: sys_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user (
    user_id character varying(30) NOT NULL,
    user_nm character varying(100) NOT NULL,
    email character varying(255),
    pwd character varying(100) NOT NULL,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    valid_from_dt date,
    valid_to_dt date,
    lock_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    lock_dtm timestamp with time zone,
    login_fail_cnt integer DEFAULT 0 NOT NULL,
    pwd_chg_dtm timestamp with time zone,
    pwd_init_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    last_login_dtm timestamp with time zone,
    dormant_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    locale_cd character varying(10) DEFAULT 'ko'::character varying NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_user_favorite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_favorite (
    user_id character varying(30) NOT NULL,
    menu_cd character varying(30) NOT NULL,
    sort_no integer NOT NULL,
    cre_dtm timestamp with time zone NOT NULL
);


--
-- Name: sys_user_grid_pref; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_grid_pref (
    user_id character varying(30) NOT NULL,
    menu_cd character varying(30) NOT NULL,
    grid_id character varying(30) NOT NULL,
    pref_json text NOT NULL,
    signature character varying(64) NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_user_ip_allow; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_ip_allow (
    user_id character varying(30) NOT NULL,
    ip_cidr character varying(45) NOT NULL,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone,
    valid_from_dt date,
    valid_to_dt date
);


--
-- Name: sys_user_menu_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_menu_auth (
    user_id character varying(30) NOT NULL,
    menu_cd character varying(30) NOT NULL,
    action_cd character varying(20) NOT NULL,
    valid_from_dt date NOT NULL,
    valid_to_dt date NOT NULL,
    grant_rsn character varying(500) NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_user_menu_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_menu_stat (
    user_id character varying(30) NOT NULL,
    menu_cd character varying(30) NOT NULL,
    stat_ym character varying(6) NOT NULL,
    use_cnt integer DEFAULT 0 NOT NULL,
    last_use_dtm timestamp with time zone NOT NULL
);


--
-- Name: sys_user_pwd_hist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_pwd_hist (
    user_id character varying(30) NOT NULL,
    chg_seq integer NOT NULL,
    pwd character varying(100) NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone
);


--
-- Name: sys_user_pwd_reset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_pwd_reset (
    user_id character varying(30) NOT NULL,
    token_hash character varying(100) NOT NULL,
    issue_dtm timestamp with time zone NOT NULL,
    expire_dtm timestamp with time zone NOT NULL,
    try_cnt integer DEFAULT 0 NOT NULL,
    used_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: sys_user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_role (
    user_id character varying(30) NOT NULL,
    role_id character varying(30) NOT NULL,
    valid_from_dt date,
    valid_to_dt date,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_user_search_cond; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_user_search_cond (
    user_id character varying(30) NOT NULL,
    menu_cd character varying(30) NOT NULL,
    cond_nm character varying(100) NOT NULL,
    cond_json text NOT NULL,
    dflt_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    sort_no integer NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: sys_api pk_sys_api; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_api
    ADD CONSTRAINT pk_sys_api PRIMARY KEY (api_url);


--
-- Name: sys_batch_history pk_sys_batch_history; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_batch_history
    ADD CONSTRAINT pk_sys_batch_history PRIMARY KEY (hist_id);


--
-- Name: sys_cache_version pk_sys_cache_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_cache_version
    ADD CONSTRAINT pk_sys_cache_version PRIMARY KEY (cache_name);


--
-- Name: sys_code pk_sys_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_code
    ADD CONSTRAINT pk_sys_code PRIMARY KEY (grp_cd, dtl_cd);


--
-- Name: sys_code_group pk_sys_code_group; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_code_group
    ADD CONSTRAINT pk_sys_code_group PRIMARY KEY (grp_cd);


--
-- Name: sys_code_grp_ref pk_sys_code_grp_ref; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_code_grp_ref
    ADD CONSTRAINT pk_sys_code_grp_ref PRIMARY KEY (grp_cd, ref_cd);


--
-- Name: sys_code_ref pk_sys_code_ref; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_code_ref
    ADD CONSTRAINT pk_sys_code_ref PRIMARY KEY (grp_cd, dtl_cd, ref_cd);


--
-- Name: sys_config pk_sys_config; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_config
    ADD CONSTRAINT pk_sys_config PRIMARY KEY (cfg_key);


--
-- Name: sys_lo_access pk_sys_lo_access; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_lo_access
    ADD CONSTRAINT pk_sys_lo_access PRIMARY KEY (access_log_seq);


--
-- Name: sys_lo_exception pk_sys_lo_exception; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_lo_exception
    ADD CONSTRAINT pk_sys_lo_exception PRIMARY KEY (exception_log_seq);


--
-- Name: sys_lo_login pk_sys_lo_login; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_lo_login
    ADD CONSTRAINT pk_sys_lo_login PRIMARY KEY (login_log_seq);


--
-- Name: sys_menu pk_sys_menu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_menu
    ADD CONSTRAINT pk_sys_menu PRIMARY KEY (menu_cd);


--
-- Name: sys_menu_api pk_sys_menu_api; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_menu_api
    ADD CONSTRAINT pk_sys_menu_api PRIMARY KEY (menu_cd, api_url);


--
-- Name: sys_message pk_sys_message; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_message
    ADD CONSTRAINT pk_sys_message PRIMARY KEY (msg_key, lang_cd);


--
-- Name: sys_message_key pk_sys_message_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_message_key
    ADD CONSTRAINT pk_sys_message_key PRIMARY KEY (msg_key);


--
-- Name: sys_noti_inbox pk_sys_noti_inbox; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_noti_inbox
    ADD CONSTRAINT pk_sys_noti_inbox PRIMARY KEY (noti_id);


--
-- Name: sys_noti_request pk_sys_noti_request; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_noti_request
    ADD CONSTRAINT pk_sys_noti_request PRIMARY KEY (req_id);


--
-- Name: sys_notice pk_sys_notice; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_notice
    ADD CONSTRAINT pk_sys_notice PRIMARY KEY (notice_id);


--
-- Name: sys_role pk_sys_role; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_role
    ADD CONSTRAINT pk_sys_role PRIMARY KEY (role_id);


--
-- Name: sys_role_menu_auth pk_sys_role_menu_auth; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_role_menu_auth
    ADD CONSTRAINT pk_sys_role_menu_auth PRIMARY KEY (role_id, menu_cd, action_cd);


--
-- Name: sys_schedule_batch pk_sys_schedule_batch; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_schedule_batch
    ADD CONSTRAINT pk_sys_schedule_batch PRIMARY KEY (batch_id);


--
-- Name: sys_user pk_sys_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user
    ADD CONSTRAINT pk_sys_user PRIMARY KEY (user_id);


--
-- Name: sys_user_favorite pk_sys_user_favorite; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_favorite
    ADD CONSTRAINT pk_sys_user_favorite PRIMARY KEY (user_id, menu_cd);


--
-- Name: sys_user_grid_pref pk_sys_user_grid_pref; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_grid_pref
    ADD CONSTRAINT pk_sys_user_grid_pref PRIMARY KEY (user_id, menu_cd, grid_id);


--
-- Name: sys_user_ip_allow pk_sys_user_ip_allow; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_ip_allow
    ADD CONSTRAINT pk_sys_user_ip_allow PRIMARY KEY (user_id, ip_cidr);


--
-- Name: sys_user_menu_auth pk_sys_user_menu_auth; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_menu_auth
    ADD CONSTRAINT pk_sys_user_menu_auth PRIMARY KEY (user_id, menu_cd, action_cd);


--
-- Name: sys_user_menu_stat pk_sys_user_menu_stat; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_menu_stat
    ADD CONSTRAINT pk_sys_user_menu_stat PRIMARY KEY (user_id, menu_cd, stat_ym);


--
-- Name: sys_user_pwd_hist pk_sys_user_pwd_hist; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_pwd_hist
    ADD CONSTRAINT pk_sys_user_pwd_hist PRIMARY KEY (user_id, chg_seq);


--
-- Name: sys_user_pwd_reset pk_sys_user_pwd_reset; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_pwd_reset
    ADD CONSTRAINT pk_sys_user_pwd_reset PRIMARY KEY (user_id);


--
-- Name: sys_user_role pk_sys_user_role; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_role
    ADD CONSTRAINT pk_sys_user_role PRIMARY KEY (user_id, role_id);


--
-- Name: sys_user_search_cond pk_sys_user_search_cond; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_search_cond
    ADD CONSTRAINT pk_sys_user_search_cond PRIMARY KEY (user_id, menu_cd, cond_nm);


--
-- Name: sys_menu uk_sys_menu_01; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_menu
    ADD CONSTRAINT uk_sys_menu_01 UNIQUE (menu_url);


--
-- Name: ix_sys_batch_history_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_batch_history_01 ON sys_batch_history USING btree (start_dtm);


--
-- Name: ix_sys_batch_history_02; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_batch_history_02 ON sys_batch_history USING btree (batch_id, start_dtm);


--
-- Name: ix_sys_batch_history_03; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_batch_history_03 ON sys_batch_history USING btree (elapsed_ms);


--
-- Name: ix_sys_code_nm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_code_nm ON sys_code USING btree (dtl_nm);


--
-- Name: ix_sys_lo_access_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_lo_access_01 ON sys_lo_access USING btree (cre_dtm);


--
-- Name: ix_sys_lo_access_02; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_lo_access_02 ON sys_lo_access USING btree (trace_id);


--
-- Name: ix_sys_lo_exception_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_lo_exception_01 ON sys_lo_exception USING btree (cre_dtm);


--
-- Name: ix_sys_lo_exception_02; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_lo_exception_02 ON sys_lo_exception USING btree (trace_id);


--
-- Name: ix_sys_lo_login_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_lo_login_01 ON sys_lo_login USING btree (cre_dtm);


--
-- Name: ix_sys_lo_login_02; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_lo_login_02 ON sys_lo_login USING btree (trace_id);


--
-- Name: ix_sys_lo_login_03; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_lo_login_03 ON sys_lo_login USING btree (user_id, cre_dtm);


--
-- Name: ix_sys_menu_api_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_menu_api_01 ON sys_menu_api USING btree (api_url);


--
-- Name: ix_sys_message_lang; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_message_lang ON sys_message USING btree (lang_cd);


--
-- Name: ix_sys_noti_inbox_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_noti_inbox_01 ON sys_noti_inbox USING btree (user_id, cre_dtm);


--
-- Name: ix_sys_noti_inbox_02; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_noti_inbox_02 ON sys_noti_inbox USING btree (user_id, read_yn);


--
-- Name: ix_sys_noti_inbox_03; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_noti_inbox_03 ON sys_noti_inbox USING btree (cre_dtm);


--
-- Name: ix_sys_noti_request_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_noti_request_01 ON sys_noti_request USING btree (req_stat_cd, cre_dtm);


--
-- Name: ix_sys_noti_request_02; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_noti_request_02 ON sys_noti_request USING btree (user_id, cre_dtm);


--
-- Name: ix_sys_notice_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_notice_01 ON sys_notice USING btree (sort_no, notice_from_dtm);


--
-- Name: ix_sys_notice_02; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_notice_02 ON sys_notice USING btree (notice_from_dtm);


--
-- Name: ix_sys_role_menu_auth_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_role_menu_auth_01 ON sys_role_menu_auth USING btree (menu_cd);


--
-- Name: ix_sys_schedule_batch_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_schedule_batch_01 ON sys_schedule_batch USING btree (sort_no);


--
-- Name: ix_sys_user_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_user_01 ON sys_user USING btree (email);


--
-- Name: ix_sys_user_role_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_user_role_01 ON sys_user_role USING btree (role_id);


--
-- Name: sys_code fk_sys_code_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_code
    ADD CONSTRAINT fk_sys_code_group FOREIGN KEY (grp_cd) REFERENCES sys_code_group(grp_cd);


--
-- Name: sys_code_grp_ref fk_sys_code_grp_ref_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_code_grp_ref
    ADD CONSTRAINT fk_sys_code_grp_ref_group FOREIGN KEY (grp_cd) REFERENCES sys_code_group(grp_cd);


--
-- Name: sys_code_ref fk_sys_code_ref_code; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_code_ref
    ADD CONSTRAINT fk_sys_code_ref_code FOREIGN KEY (grp_cd, dtl_cd) REFERENCES sys_code(grp_cd, dtl_cd);


--
-- Name: sys_code_ref fk_sys_code_ref_def; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_code_ref
    ADD CONSTRAINT fk_sys_code_ref_def FOREIGN KEY (grp_cd, ref_cd) REFERENCES sys_code_grp_ref(grp_cd, ref_cd);


--
-- Name: sys_menu fk_sys_menu_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_menu
    ADD CONSTRAINT fk_sys_menu_01 FOREIGN KEY (up_menu_cd) REFERENCES sys_menu(menu_cd) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: sys_menu_api fk_sys_menu_api_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_menu_api
    ADD CONSTRAINT fk_sys_menu_api_01 FOREIGN KEY (menu_cd) REFERENCES sys_menu(menu_cd);


--
-- Name: sys_menu_api fk_sys_menu_api_02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_menu_api
    ADD CONSTRAINT fk_sys_menu_api_02 FOREIGN KEY (api_url) REFERENCES sys_api(api_url);


--
-- Name: sys_message fk_sys_message_key; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_message
    ADD CONSTRAINT fk_sys_message_key FOREIGN KEY (msg_key) REFERENCES sys_message_key(msg_key);


--
-- Name: sys_noti_inbox fk_sys_noti_inbox_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_noti_inbox
    ADD CONSTRAINT fk_sys_noti_inbox_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_noti_request fk_sys_noti_request_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_noti_request
    ADD CONSTRAINT fk_sys_noti_request_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_role_menu_auth fk_sys_role_menu_auth_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_role_menu_auth
    ADD CONSTRAINT fk_sys_role_menu_auth_01 FOREIGN KEY (role_id) REFERENCES sys_role(role_id);


--
-- Name: sys_role_menu_auth fk_sys_role_menu_auth_02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_role_menu_auth
    ADD CONSTRAINT fk_sys_role_menu_auth_02 FOREIGN KEY (menu_cd) REFERENCES sys_menu(menu_cd);


--
-- Name: sys_user_favorite fk_sys_user_favorite_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_favorite
    ADD CONSTRAINT fk_sys_user_favorite_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_user_favorite fk_sys_user_favorite_02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_favorite
    ADD CONSTRAINT fk_sys_user_favorite_02 FOREIGN KEY (menu_cd) REFERENCES sys_menu(menu_cd);


--
-- Name: sys_user_grid_pref fk_sys_user_grid_pref_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_grid_pref
    ADD CONSTRAINT fk_sys_user_grid_pref_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_user_grid_pref fk_sys_user_grid_pref_02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_grid_pref
    ADD CONSTRAINT fk_sys_user_grid_pref_02 FOREIGN KEY (menu_cd) REFERENCES sys_menu(menu_cd);


--
-- Name: sys_user_ip_allow fk_sys_user_ip_allow_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_ip_allow
    ADD CONSTRAINT fk_sys_user_ip_allow_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_user_menu_auth fk_sys_user_menu_auth_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_menu_auth
    ADD CONSTRAINT fk_sys_user_menu_auth_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_user_menu_auth fk_sys_user_menu_auth_02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_menu_auth
    ADD CONSTRAINT fk_sys_user_menu_auth_02 FOREIGN KEY (menu_cd) REFERENCES sys_menu(menu_cd);


--
-- Name: sys_user_pwd_reset fk_sys_user_pwd_reset_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_pwd_reset
    ADD CONSTRAINT fk_sys_user_pwd_reset_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_user_role fk_sys_user_role_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_role
    ADD CONSTRAINT fk_sys_user_role_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_user_role fk_sys_user_role_02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_role
    ADD CONSTRAINT fk_sys_user_role_02 FOREIGN KEY (role_id) REFERENCES sys_role(role_id);


--
-- Name: sys_user_search_cond fk_sys_user_search_cond_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_search_cond
    ADD CONSTRAINT fk_sys_user_search_cond_01 FOREIGN KEY (user_id) REFERENCES sys_user(user_id);


--
-- Name: sys_user_search_cond fk_sys_user_search_cond_02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_user_search_cond
    ADD CONSTRAINT fk_sys_user_search_cond_02 FOREIGN KEY (menu_cd) REFERENCES sys_menu(menu_cd);


--
-- PostgreSQL database dump complete
--




