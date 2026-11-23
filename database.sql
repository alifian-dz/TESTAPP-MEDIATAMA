--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.video_permissions DROP CONSTRAINT IF EXISTS "video_permissions_videoId_fkey";
ALTER TABLE IF EXISTS ONLY public.video_permissions DROP CONSTRAINT IF EXISTS "video_permissions_userId_fkey";
ALTER TABLE IF EXISTS ONLY public.video_permissions DROP CONSTRAINT IF EXISTS "video_permissions_requestId_fkey";
ALTER TABLE IF EXISTS ONLY public.access_requests DROP CONSTRAINT IF EXISTS "access_requests_videoId_fkey";
ALTER TABLE IF EXISTS ONLY public.access_requests DROP CONSTRAINT IF EXISTS "access_requests_userId_fkey";
DROP INDEX IF EXISTS public."videos_storedFileName_key";
DROP INDEX IF EXISTS public."video_permissions_userId_videoId_expiresAt_idx";
DROP INDEX IF EXISTS public."video_permissions_requestId_key";
DROP INDEX IF EXISTS public.users_email_key;
DROP INDEX IF EXISTS public."access_requests_userId_videoId_status_idx";
ALTER TABLE IF EXISTS ONLY public.videos DROP CONSTRAINT IF EXISTS videos_pkey;
ALTER TABLE IF EXISTS ONLY public.video_permissions DROP CONSTRAINT IF EXISTS video_permissions_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.access_requests DROP CONSTRAINT IF EXISTS access_requests_pkey;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
DROP TABLE IF EXISTS public.videos;
DROP TABLE IF EXISTS public.video_permissions;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.access_requests;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TYPE IF EXISTS public."Role";
DROP TYPE IF EXISTS public."RequestStatus";
--
-- Name: RequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'CUSTOMER'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_requests (
    id text NOT NULL,
    "userId" text NOT NULL,
    "videoId" text NOT NULL,
    status public."RequestStatus" DEFAULT 'PENDING'::public."RequestStatus" NOT NULL,
    note text,
    "requestedDurationMinutes" integer,
    "grantedDurationMinutes" integer,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reviewedAt" timestamp(3) without time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."Role" DEFAULT 'CUSTOMER'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: video_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_permissions (
    id text NOT NULL,
    "userId" text NOT NULL,
    "videoId" text NOT NULL,
    "requestId" text,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "durationMinutes" integer DEFAULT 60 NOT NULL,
    "startedAt" timestamp(3) without time zone
);


--
-- Name: videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.videos (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "originalName" text NOT NULL,
    "storedFileName" text NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public._prisma_migrations VALUES ('40b7d4a2-aa95-413b-8243-54f71cfb53b9', '09321608272aa64f4842741c946be4fb72047315010ca53d3948f2107f4286fe', '2026-11-23 16:19:44.191268+07', '20261123091944_init', NULL, NULL, '2026-11-23 16:19:44.166061+07', 1);
INSERT INTO public._prisma_migrations VALUES ('761595a6-8d8b-4466-9b82-105c4d8b6d15', 'e867bb0d31bb7886fa0f8f0814a8ccd1d48e65d690ed1bb04af584dbc9ad4bff', '2026-11-23 16:49:31.348851+07', '20261123094931_add_soft_delete', NULL, NULL, '2026-11-23 16:49:31.346667+07', 1);
INSERT INTO public._prisma_migrations VALUES ('7266855a-5c5d-4f5c-9a72-4399c0c5ab65', '53f86ab66aae5e261972d4a719912be2576469adcc4a31a6bb7cb7641e6c6138', '2026-11-23 17:05:01.274014+07', '20261123100501_add_permission_started_at', NULL, NULL, '2026-11-23 17:05:01.271326+07', 1);


--
-- Data for Name: access_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES ('cmwt21bhh0000s8ps3113xjt6', 'System Administrator', 'admin@mediatama.test', '$2b$10$y8TuYZkT6w/gHWWfQ30v0uyL/c7zHwiCof6RzlJdiT1GHTVeZrLgW', 'ADMIN', '2026-11-23 09:19:44.741', '2026-11-23 09:19:46.558', NULL);
INSERT INTO public.users VALUES ('cmwt21bhl0001s8pst5r5u1zp', 'Customer One', 'customer1@mediatama.test', '$2b$10$vB2wd7vPngPhIW.tfKaxSuIJaDbephXbUHmgLPlM6cy1pdPjCvCTS', 'CUSTOMER', '2026-11-23 09:19:44.745', '2026-11-23 09:19:46.563', NULL);
INSERT INTO public.users VALUES ('cmwt21bhm0002s8ps7gh7gmsc', 'Customer Two', 'customer2@mediatama.test', '$2b$10$vB2wd7vPngPhIW.tfKaxSuIJaDbephXbUHmgLPlM6cy1pdPjCvCTS', 'CUSTOMER', '2026-11-23 09:19:44.746', '2026-11-23 09:19:46.564', NULL);


--
-- Data for Name: video_permissions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: videos; Type: TABLE DATA; Schema: public; Owner: -
--


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: access_requests access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: video_permissions video_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_permissions
    ADD CONSTRAINT video_permissions_pkey PRIMARY KEY (id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: access_requests_userId_videoId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "access_requests_userId_videoId_status_idx" ON public.access_requests USING btree ("userId", "videoId", status);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: video_permissions_requestId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "video_permissions_requestId_key" ON public.video_permissions USING btree ("requestId");


--
-- Name: video_permissions_userId_videoId_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "video_permissions_userId_videoId_expiresAt_idx" ON public.video_permissions USING btree ("userId", "videoId", "expiresAt");


--
-- Name: videos_storedFileName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "videos_storedFileName_key" ON public.videos USING btree ("storedFileName");


--
-- Name: access_requests access_requests_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT "access_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: access_requests access_requests_videoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT "access_requests_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES public.videos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: video_permissions video_permissions_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_permissions
    ADD CONSTRAINT "video_permissions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.access_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: video_permissions video_permissions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_permissions
    ADD CONSTRAINT "video_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: video_permissions video_permissions_videoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_permissions
    ADD CONSTRAINT "video_permissions_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES public.videos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


