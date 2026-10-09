# Licensing and Trademark Evaluation

This document explains the legal footing of this project in plain terms. It is not legal advice. When in doubt, talk to a lawyer.

## This project's license

`trafft-mcp` is source-available under the OpenRoots Agent License 2.3 (see [LICENSE](../LICENSE)). It is free at or below USD 20 million annual revenue, and free for any individual or nonprofit. Above that threshold a small revenue share applies, capped per the license text. AI training on the code is a separate Compute tier and requires its own licence. The software is provided without warranty.

## Relationship to Trafft

This project is independent. It is not affiliated with, endorsed by, or sponsored by Trafft. All credit for the Trafft booking platform and its API goes to Trafft. This project is a thin client. It calls the public Trafft REST API using credentials that you, the user, supply from your own Trafft account.

What that means in practice.

- This project ships no Trafft code, no Trafft data, and no Trafft secrets.
- It does not resell, rebrand, or compete with Trafft. It helps Trafft customers use their own accounts through an AI assistant.
- It cannot do anything your own API credentials are not already allowed to do.

## Trademark use

Trafft and the Trafft logo are trademarks of their owner. This project uses the name and logo only to identify the platform it connects to. That is nominative fair use, the same way an accessory maker may say a product "works with" a brand it names.

Guardrails this project follows.

- The logo is shown next to a clear notice that the project is independent and not affiliated.
- The project is not named in a way that implies Trafft built or endorses it.
- The logo is not altered to suggest a partnership.

If the trademark owner asks for a change to how the name or logo appears, the right response is to honor that request.

## The Trafft logo file

The logo at [assets/trafft-logo.svg](../assets/trafft-logo.svg) is the property of the trademark owner and is included for identification only. It is not covered by this project's license. If you fork or redistribute this project, treat the logo as the owner's trademark, not as part of the licensed code.

## Using the API responsibly

When you connect this tool to your Trafft account, you are acting under your own agreement with Trafft. You are responsible for the following.

- Following the Trafft terms of service and acceptable use.
- Keeping your API credentials secret. Put them in `.env`, which is gitignored, and never commit them.
- Handling customer data lawfully. Bookings hold personal data, so data protection rules such as GDPR apply to how you store and process what the API returns.

## No warranty, and the API is beta

The Trafft API is in beta and may change. This project is provided as is, with no guarantee that any endpoint will keep working or that a result is accurate. The built-in auditor exists precisely so you can confirm what works on your own instance at any time.

## Summary

| Item | Status |
|---|---|
| This project's code | Source-available under OpenRoots ORA 2.3, free at or below USD 20M revenue |
| Trafft name and logo | Trademark of the owner, used for identification only |
| Affiliation with Trafft | None |
| Your API credentials | Yours, kept local, never shipped |
| Warranty | None |
