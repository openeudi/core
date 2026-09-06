# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.8.x   | Yes       |
| < 0.8   | No        |

Only the latest minor receives security updates. While this package is pre-1.0
there are no maintained backport branches: a fix ships in the next release from
`main`, so staying current is a prerequisite for being covered by this policy.

No security advisories have been published for `@openeudi/core` to date, and the
package has not had an independent third-party security audit.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Use GitHub's Private Vulnerability Reporting:

1. Go to the [Security tab](https://github.com/openeudi/core/security) of this repository
2. Click "Report a vulnerability"
3. Fill in the details

### Response Timeline

- **Acknowledge:** Within 72 hours
- **Assessment:** Within 1 week
- **Patch (critical):** Within 30 days
- **Patch (non-critical):** Next scheduled release

### After Resolution

- Security advisory published on GitHub
- Reporter credited (unless they prefer anonymity)
- Fix noted in CHANGELOG.md

## Scope

This policy covers the `@openeudi/core` npm package. For issues in dependencies, please report to the respective maintainers.
