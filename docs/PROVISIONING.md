# ChromeOS endpoint provisioning helper

The static setup helper is available at:

`/setup/`

It generates the auto-launch URL for a ChromeOS browser endpoint.

Example output:

`https://joe4816.github.io/printhub/?endpoint=PH-FRONT-RECEIPT-01&label=Front%20Office%20Receipt&media=80MM_RECEIPT`

When the main PrintHub page opens with these values, it stores the endpoint identity and default media preference in local storage.

## Security boundary

The setup helper configures identifiers only.

It does not configure:

- endpoint authentication;
- physical printer assignment;
- Google Admin policies;
- silent printing;
- worker keys or other secrets.

An endpoint ID appearing in a URL does not authorize queue access.
