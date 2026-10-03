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

The ChromeOS extension should receive enterprise configuration through managed policy. The visible GitHub Pages dashboard should never be treated as a secret store.
