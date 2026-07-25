# Overlap

<img src="./project-logo.png" alt="Overlap logo" width="160" />

**The photo pool that turns a dev event into a graph of who you actually met.**

Live: **https://overlap-murex.vercel.app**

Hacker: Freddy Johan Bautista Baquero ([@FreddyB200](https://github.com/FreddyB200))

## The problem

At dev events the best photos stay trapped on one phone and never reach anyone else, and you meet people you won't remember by the next morning. Both just evaporate.

## The solution

Everyone drops their photos into one shared pool. Everyone taps themselves in the photos they're in ("That's me") to get their own photos back — and that same tap is what feeds the graph. Overlap builds who-overlapped-with-whom from real shared photos and real timestamps, no guessing, no facial recognition. Your recap shows exactly who you crossed paths with, the visual evidence, and a one-tap way to connect on GitHub, LinkedIn or WhatsApp.

An organizer creates an event from `/new` and gets a real QR code to put at the door — anyone who scans it joins that event's pool.

## Stack

React + Vite + TypeScript + Tailwind CSS, deployed on Vercel. Supabase (Postgres + Storage) for data, no traditional auth — identity is a `device_token` in `localStorage`. One Vercel serverless function (`/api/analyze`) calls Claude (vision) to describe each photo's scene; another (`/api/download`) streams a ZIP of your photos on demand.

## Deploying

Vercel can't be granted access to this org repo, so commits here are mirrored to a personal repo ([`FreddyB200/overlap`](https://github.com/FreddyB200/overlap)) on every push, and Vercel deploys from there. Commits stay in sync in both places for judging.
