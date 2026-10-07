# Project Scope

## Goal
A scalable e-commerce platform using Redis caching and Docker,
load tested to 10,000+ concurrent users.

## User roles
- Customer: browse, search, cart, checkout, order history
- Admin: manage products, categories, orders

## In scope (MVP)
- Auth (register, login, JWT + refresh tokens)
- Products + categories (CRUD, pagination, filter, search)
- Cart
- Orders (transactions, stock decrement)
- Mock payment (no real gateway)
- Order status: PENDING -> PAID -> SHIPPED -> DELIVERED / CANCELLED

## Out of scope
- Real payments, email sending, reviews, wishlists, image upload

## Tech stack
React, Node.js/Express, PostgreSQL, Redis, Docker Compose,
Nginx, k6, Prometheus/Grafana, GitHub Actions

## Success metrics (fill in real numbers later)
- p95 latency on product list: ___ ms (without Redis) -> ___ ms (with Redis)
- Requests/sec: ___ -> ___
- Error rate at 10k virtual users: ___ %