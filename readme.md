[![wercker status](https://app.wercker.com/status/fe30b946cc0ec765b7f89d03ae512793/s/master "wercker status")](https://app.wercker.com/project/bykey/fe30b946cc0ec765b7f89d03ae512793)

This is the TCG auth service. It's named AuthX because it's an "exchange" of sorts, consolidating identities from several upstream authorities into a single identity for downstream clients. AuthX uses the OAuth2 framework in both directions, and adds an _authorization_ layer. Authorization control is based on the [simple scopes spec](https://github.com/the-control-group/scopeutils).

## Concepts

AuthX is designed for a scenario in which a **RESOURCE** needs to restrict access to all or part of its functionality. A **CLIENT** app, acting on behalf of a **User** can retreive an OAuth token from AuthX, which can be passed to the **RESOURCE** with any request.

```
╔══════════════════════════════════════════╗
║                  ┌───────────┐           ║
║                  │ AUTHORITY │           ║
║                  └─────┬─────┘           ║
║▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓║
║   ┌────────────┐ ┌─────┴─────┐           ║
║   │ Credential ├─┤ Authority │           ║
║   └───┬────────┘ └───────────┘           ║
║   ┌───┴──┐              Authentication   ║
║░░░│ User │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░║
║   └─┬──┬─┘              ┌──────┐         ║
║     │  └────────────────┤ Role │         ║
║    ┌┴──────┐ ┌────────┐ └──────┘         ║
║    │ Grant ├─┤ Client │                  ║
║    └───────┘ └───┬────┘  Authorization   ║
║▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓║
║              ┌───┴────┐ ┌──────────┐     ║
║              │ CLIENT ├─┤ RESOURCE │     ║
║              └────────┘ └──────────┘     ║
╚══════════════════════════════════════════╝
```

### User

The user is (obviously) the primary component. It consists of a unique ID and profile information in the format of [Portable Contacts](http://portablecontacts.net/draft-spec.html). Information in the profile is **not** verified, and is not directly used by AuthX system for authentication.

### Authority

An authority is a mechanism for authentication, and provides the configuration for corresponding units of code called _strategies_. Several strategies are included by default:

1. **email** - use an email address to verify a visitor's identity (most people call this "reset your password")
2. **password** - verify your identity with a password (which is protected with bcrypt)
3. **google** - connect to one or more Google and Google Apps accounts
4. **onelogin** - connect to one or more OneLogin accounts through SAML

### Credential

Credentials connect users to authorities. A user can typically have multiple authorities of the same authority (multiple emails, for example).

### Client

Clients are downstream applications that uses AuthX for authentication/authorization.

### Grant

A user gives a client permission to act on her behalf via a grant.

### Role

A role bestows its permissions to every user it includes.

## Anatomy of a scope

Scopes are composed of 3 domains, separated by the `:` character:

```
AuthX:role.abc:read
|___| |______| |__|
  |      |       |
realm resource  action

```

Each domain can contain parts, separated by the `.` character. Domain parts can be `/[a-zA-Z0-9_]*/` strings or glob pattern identifiers `*` or `**`:

```
role.abc
role.*
**
```

## AuthX Scopes

AuthX dogfoods. It uses its own authorization system to restrict access to its resources. Below are the scopes used by AuthX internally:

```
AuthX:user:read
AuthX:user:write
AuthX:user.self:read
AuthX:user.self:write

AuthX:role:create
AuthX:role.<role_id>:read
AuthX:role.<role_id>:write
AuthX:role.<role_id>:write.scopes
AuthX:role.<role_id>:write.assignments

AuthX:authority:create
AuthX:authority.<authority_id>:read
AuthX:authority.<authority_id>:read.details
AuthX:authority.<authority_id>:write

AuthX:credential.<authority_id>.user.self:read
AuthX:credential.<authority_id>.user.self:write
AuthX:credential.<authority_id>.user.equal:read
AuthX:credential.<authority_id>.user.equal:write
AuthX:credential.<authority_id>.user.subset:read
AuthX:credential.<authority_id>.user.subset:write
AuthX:credential.<authority_id>.user.superset:read
AuthX:credential.<authority_id>.user.superset:write

AuthX:client:create
AuthX:client.<client_id>:read
AuthX:client.<client_id>:read.secret
AuthX:client.<client_id>:read.nonce
AuthX:client.<client_id>:write
AuthX:client.<client_id>:write.scopes
AuthX:client.<client_id>:write.secret
AuthX:client.<client_id>:write.nonce

AuthX:grant.<client_id>.user.self:read
AuthX:grant.<client_id>.user.self:write
AuthX:grant.<client_id>.user.equal:read
AuthX:grant.<client_id>.user.equal:write
AuthX:grant.<client_id>.user.subset:read
AuthX:grant.<client_id>.user.subset:write
AuthX:grant.<client_id>.user.superset:read
AuthX:grant.<client_id>.user.superset:write
```
