# Simulator

The PrintHub routing simulator is a static development lab served from:

`/simulator/`

It does not connect to PassKiosk or any production queue.

## What it proves

The simulator exercises:

- primary-route selection;
- optional second-copy selection;
- one transaction expanding into sibling print jobs;
- grouping jobs by endpoint queue;
- independent job-state transitions;
- retrying one failed copy without duplicating the source transaction;
- media-profile-specific rendering;
- browser print preview of the selected rendered copy.

## Why it exists

The real printing environment has several moving parts:

- source application;
- routing registry;
- endpoint assignment;
- renderer;
- ChromeOS / Windows;
- physical printer.

The simulator lets routing and rendering bugs be found before they can claim or alter live print jobs.
