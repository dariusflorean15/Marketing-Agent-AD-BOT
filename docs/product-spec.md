# Product Spec

## One-liner

An AI-powered dashboard that pulls Meta Ads and Google Ads performance data, detects weak campaigns with a rule-based scoring engine, and turns the numbers into plain-language recommendations via Claude.

## Problem

Campaign managers stare at two separate ad platforms with different metric names, miss early warning signs (CTR decay, rising CPA), and spend hours writing performance summaries by hand.

## Users

Two collaborators (Darius & Kaloyan) managing ad accounts. Later possibly clients with read-only access.

## Core features (v1)

1. **Data ingestion** — pull campaign metrics from Meta Ads API and Google Ads API (mocked first).
2. **Normalization** — map both platforms into one schema ([[data-schema]]).
3. **Scoring engine** — rule-based 0–100 health score per campaign, verdict: healthy / warning / critical.
4. **Claude analysis** — structured metrics sent to Claude, returns recommendations ([[prompt-system]]).
5. **Dashboard** — shared web UI: overview of campaigns + Chat Analyst page.

## Out of scope (v1)

- Auto-applying changes to ad platforms (write access)
- Multi-tenant auth / client logins
- Historical trend database (start with on-demand fetches)

## Success criteria

- One click → every campaign scored + a concrete recommendation in < 30 s
- Both collaborators see the same data at the same URL
