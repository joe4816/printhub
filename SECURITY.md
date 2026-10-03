# Security

PrintHub is a public client repository.

Do not commit:

- API or worker keys;
- passwords;
- Wi-Fi credentials;
- student records;
- Google credentials;
- printer credentials;
- service-account secrets;
- any token that authorizes source polling or status callbacks.

## Endpoint IDs are not authentication

Identifiers such as:

`PH-AP-RECEIPT-01`

may appear in a kiosk URL or local configuration. They are routing identifiers, not secrets.

When production polling is implemented, the backend must authenticate the endpoint and authorize which endpoint queue(s) that credential may claim. It must not trust an arbitrary `endpointId` sent by an unauthenticated client.

## ChromeOS browser endpoint

The public GitHub Pages application contains no worker key.

A secure bridge / managed-secret mechanism must be chosen before production queue polling is enabled.

Printer assignment remains in managed ChromeOS policy rather than GitHub source.

## Windows endpoint

Secrets for a Windows agent should be stored outside the public repository, preferably in an OS-protected local secret or environment / service configuration with appropriate ACLs.

The checked-in Windows config is an example only and must not contain real credentials.
