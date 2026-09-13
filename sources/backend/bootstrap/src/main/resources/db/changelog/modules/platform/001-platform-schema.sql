--liquibase formatted sql
--changeset baseline:platform-001

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
-- Name: spring_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE spring_session (
    primary_id character(36) NOT NULL,
    session_id character(36) NOT NULL,
    creation_time bigint NOT NULL,
    last_access_time bigint NOT NULL,
    max_inactive_interval integer NOT NULL,
    expiry_time bigint NOT NULL,
    principal_name character varying(100)
);


--
-- Name: spring_session_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE spring_session_attributes (
    session_primary_id character(36) NOT NULL,
    attribute_name character varying(200) NOT NULL,
    attribute_bytes bytea NOT NULL
);


--
-- Name: sys_data_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_data_lock (
    lock_type character varying(50) NOT NULL,
    lock_key character varying(200) NOT NULL,
    expire_dtm timestamp without time zone NOT NULL,
    release_dtm timestamp without time zone,
    node_id character varying(100) NOT NULL,
    user_id character varying(30),
    cre_dtm timestamp without time zone NOT NULL
);


--
-- Name: sys_job_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_job_progress (
    job_id character varying(64) NOT NULL,
    user_id character varying(30) NOT NULL,
    job_stat_cd character varying(20) NOT NULL,
    cur_cnt bigint DEFAULT 0 NOT NULL,
    tot_cnt bigint,
    step_msg character varying(500),
    err_msg text,
    cre_dtm timestamp with time zone NOT NULL,
    mod_dtm timestamp with time zone NOT NULL,
    sub_title character varying(300)
);


--
-- Name: sys_sequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE sys_sequence (
    seq_name character varying(255) NOT NULL,
    next_val bigint NOT NULL
);


--
-- Name: sys_data_lock pk_sys_data_lock; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_data_lock
    ADD CONSTRAINT pk_sys_data_lock PRIMARY KEY (lock_type, lock_key);


--
-- Name: sys_job_progress pk_sys_job_progress; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_job_progress
    ADD CONSTRAINT pk_sys_job_progress PRIMARY KEY (job_id);


--
-- Name: sys_sequence pk_sys_sequence; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY sys_sequence
    ADD CONSTRAINT pk_sys_sequence PRIMARY KEY (seq_name);


--
-- Name: spring_session_attributes spring_session_attributes_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY spring_session_attributes
    ADD CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name);


--
-- Name: spring_session spring_session_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY spring_session
    ADD CONSTRAINT spring_session_pk PRIMARY KEY (primary_id);


--
-- Name: ix_sys_job_progress_01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sys_job_progress_01 ON sys_job_progress USING btree (cre_dtm);


--
-- Name: spring_session_ix1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX spring_session_ix1 ON spring_session USING btree (session_id);


--
-- Name: spring_session_ix2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spring_session_ix2 ON spring_session USING btree (expiry_time);


--
-- Name: spring_session_ix3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spring_session_ix3 ON spring_session USING btree (principal_name);


--
-- Name: spring_session_attributes spring_session_attributes_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY spring_session_attributes
    ADD CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id) REFERENCES spring_session(primary_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--




