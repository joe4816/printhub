# PassKiosk adapter

`adapters/passkiosk.js` is an **offline normalization adapter**.

It does not call PassKiosk and it does not poll the live queue.

Its purpose is to prove that the existing PassKiosk transaction snapshot can be mapped into the generic document model expected by PrintHub renderers.

The adapter currently understands these existing workflow values:

- `PASS`
- `RQST`
- `DET`
- `LUNCH_DET`

It reads the transaction field names already used by the current PassKiosk backend, including Student Name, Grade, From, To, Reason(s), Requested By, Destination, When, At Time, Delivery Period / Room / Teacher, Issued By, Detention Date, Report To, and Directions Snapshot.

The adapter's output is intentionally generic:

```js
{
  brand,
  title,
  subtitle,
  fields: [{ label, value }],
  body,
  footer
}
```

That model can then be handed to the shared media renderer.

This keeps PassKiosk-specific field knowledge at the adapter boundary instead of spreading it through PrintHub core.
