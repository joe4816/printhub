# Automated validation

PrintHub uses Node's built-in test runner. No third-party package install is required.

Run locally:

```bash
npm test
```

The tests currently cover:

- route-registry validation;
- single-copy routing;
- primary + second-copy fan-out;
- duplicate-route rejection;
- missing endpoint binding rejection;
- missing media-profile rejection;
- receipt rendering;
- letter/file-copy rendering;
- HTML escaping in renderer payloads.

GitHub Actions runs the suite on pushes to `main` and on pull requests.

The simulator at `/simulator/` complements the unit tests by exercising queue grouping, independent copy statuses, retry behavior, and rendered previews in a browser.
