--liquibase formatted sql
--changeset baseline:sample-001-schema

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
-- Name: smpl_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE smpl_order (
    ord_id bigint NOT NULL,
    ord_no character varying(30) NOT NULL,
    ord_nm character varying(200) NOT NULL,
    cust_id character varying(30) NOT NULL,
    cust_nm character varying(200) NOT NULL,
    cust_grd_cd character varying(20),
    ord_stat_cd character varying(20) NOT NULL,
    chnl_cd character varying(20) NOT NULL,
    priority_cd character varying(20) NOT NULL,
    ord_dt date NOT NULL,
    dlvr_ym character varying(6),
    ord_dtm timestamp with time zone NOT NULL,
    ord_qty integer DEFAULT 0 NOT NULL,
    unit_amt numeric(15,2) DEFAULT 0 NOT NULL,
    ord_amt numeric(17,2) DEFAULT 0 NOT NULL,
    vat_amt numeric(17,2) DEFAULT 0 NOT NULL,
    dc_rt numeric(5,2) DEFAULT 0 NOT NULL,
    proc_ms bigint,
    urgent_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    memo text,
    rmk text,
    err_msg text,
    lock_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    src_sys_cd character varying(20),
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: smpl_order_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE smpl_order_item (
    ord_id bigint NOT NULL,
    item_seq integer NOT NULL,
    ord_no character varying(30) NOT NULL,
    item_cd character varying(30) NOT NULL,
    item_nm character varying(200) NOT NULL,
    uom_cd character varying(20) NOT NULL,
    qty numeric(13,3) DEFAULT 0 NOT NULL,
    unit_amt numeric(15,2) DEFAULT 0 NOT NULL,
    amt numeric(17,2) DEFAULT 0 NOT NULL,
    dlvr_dt date,
    item_stat_cd character varying(20) NOT NULL,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    rmk character varying(500),
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: smpl_order_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE smpl_order_tag (
    ord_id bigint NOT NULL,
    tag_seq integer NOT NULL,
    tag_nm character varying(50) NOT NULL,
    tag_type_cd character varying(20) NOT NULL,
    sort_no integer NOT NULL,
    reg_id character varying(50),
    reg_dtm timestamp with time zone,
    mod_id character varying(50),
    mod_dtm timestamp with time zone
);


--
-- Name: smpl_order pk_smpl_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY smpl_order
    ADD CONSTRAINT pk_smpl_order PRIMARY KEY (ord_id);


--
-- Name: smpl_order_item pk_smpl_order_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY smpl_order_item
    ADD CONSTRAINT pk_smpl_order_item PRIMARY KEY (ord_id, item_seq);


--
-- Name: smpl_order_tag pk_smpl_order_tag; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY smpl_order_tag
    ADD CONSTRAINT pk_smpl_order_tag PRIMARY KEY (ord_id, tag_seq);


--
-- Name: smpl_order_item uk_smpl_item_cd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY smpl_order_item
    ADD CONSTRAINT uk_smpl_item_cd UNIQUE (ord_id, item_cd);


--
-- Name: smpl_order uk_smpl_order_no; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY smpl_order
    ADD CONSTRAINT uk_smpl_order_no UNIQUE (ord_no);


--
-- Name: ix_smpl_item_ordno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_smpl_item_ordno ON smpl_order_item USING btree (ord_no, item_cd);


--
-- Name: ix_smpl_order_dtm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_smpl_order_dtm ON smpl_order USING btree (ord_dtm DESC, ord_id DESC);


--
-- Name: ix_smpl_order_stat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_smpl_order_stat ON smpl_order USING btree (ord_stat_cd, ord_dt);


--
-- Name: smpl_order_item fk_smpl_order_item_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY smpl_order_item
    ADD CONSTRAINT fk_smpl_order_item_01 FOREIGN KEY (ord_id) REFERENCES smpl_order(ord_id) ON DELETE RESTRICT;


--
-- Name: smpl_order_tag fk_smpl_order_tag_01; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY smpl_order_tag
    ADD CONSTRAINT fk_smpl_order_tag_01 FOREIGN KEY (ord_id) REFERENCES smpl_order(ord_id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--




