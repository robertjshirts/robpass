# System Patterns

This document outlines the system architecture, key technical decisions, design patterns in use, component relationships, and critical implementation paths for the RobPass project.

## Architecture Overview
RobPass is a full-stack application following a client-server architecture.
-   **Frontend**: Next.js application for the user interface.
-   **Backend**: Next.js API routes for authentication, data storage/retrieval, and business logic.
-   **Database**: SQLite for development (as per `README.md` schema), managed by Drizzle ORM.

## Key Technical Decisions
-   **Authentication**: JWT-based session management. Authentication hash derived client-side and verified server-side.
-   **Data Encryption**: AES-256 GCM with unique IVs for sensitive user data (vault items), using a client-derived `Master Key`.
-   **Password Hashing**: PBKDF2 for key derivation (min. 100,000 iterations) and `bcrypt` for server-side authentication hash storage.
-   **API Design**: RESTful API principles.
-   **Testing**: No automated test suite is currently present. A new testing strategy is to be determined.
-   **Zero-Knowledge Principle**: Server never stores or accesses master passwords or unencrypted vault data. All sensitive crypto operations are client-side.
-   **Key & Secret Management**: Master passwords and derived encryption keys reside only in volatile client-side memory and are cleared upon logout. Session tokens in `sessionStorage`.
-   **Data Encoding**: Encrypted data (ciphertext and IVs) are Base64 encoded.
-   **Two-Factor Authentication**: TOTP-based 2FA compliant with RFC 6238, including QR code support and securely generated, single-use, encrypted backup recovery codes.

## Database Schema (from README.md)
### `users` Table:
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,         -- The PBKDF2 salt for this user
    authentication_hash TEXT NOT NULL,   -- Server-side hashed version of client-derived auth hash
    kdf_iterations INTEGER NOT NULL,     -- PBKDF2 iterations count for this user
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
### `vault_items` Table:
```sql
CREATE TABLE IF NOT EXISTS vault_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,          -- Foreign key to users table
    name TEXT NOT NULL,                -- User-provided display name (unencrypted)
    encrypted_data TEXT NOT NULL,      -- Base64 encoded AES-256 GCM ciphertext of sensitive data (username, password, URI)
    iv TEXT NOT NULL,                  -- Base64 encoded IV for the encrypted_data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## User Management & Authentication Flow (from README.md)
### New User Creation:
-   **Client Process:** Generate `UserSalt`, derive `Master Key` (PBKDF2), derive `Authentication Hash` (secondary hash of `Master Key`). Send `username`, `UserSalt`, `Authentication Hash`, `PBKDF2 Iterations` to server.
-   **Server Process:** Store `username`, `UserSalt`, server-side hashed `Authentication Hash`, `PBKDF2 Iterations`.

### User Authentication (Login):
-   **Client Process:** Retrieve `UserSalt` and `PBKDF2 Iterations` from server. Derive `Master Key` (PBKDF2), derive `Authentication Hash` (secondary hash of `Master Key`). Send `Authentication Hash` to server.
-   **Server Process:** Verify received `Authentication Hash` against stored hashed version. Issue session token on success.
-   **Post-Authentication (Client Process):** `Master Key` retained in volatile client-side memory.

### Key Derivation Distinction:
1.  **Master Key Derivation:** `MasterKey = PBKDF2(MasterPassword, UserSalt)`. Used for AES-256 GCM. Client-side only, never transmitted.
2.  **Authentication Hash Derivation:** `AuthenticationHash = Hash(MasterKey)`. Used to prove knowledge of Master Password to server without revealing Master Key. Client-side derived, transmitted for one-time check.

## Vault Management Functionality (from README.md)
-   **Vault Item Creation:** Client JSON-serializes unencrypted data, encrypts with in-memory `Master Key` and unique IV. Server stores `user_id`, `name`, `base64-encoded encrypted data`, `base64-encoded IV`.
-   **Vault Item Viewing & Decryption:** Client retrieves encrypted data, decrypts with in-memory `Master Key` and stored `IV`.
-   **Vault Item Editing & Deletion:** Client decrypts, modifies, re-encrypts (new IV), sends to server. Server updates/deletes.

## Design Patterns in Use
-   **Component-based UI**: React components for modular and reusable UI elements.
-   **Service Layer**: Separation of concerns with dedicated services for database interactions, crypto operations, and business logic.
-   **Error Handling**: Centralized error handling and logging.

## Component Relationships
-   **Frontend Components**: Interact with Next.js API routes.
-   **API Routes**: Utilize database services and crypto utilities.
-   **Database Services**: Interact with the Drizzle ORM and the underlying database.
-   **Auth Middleware**: Protects API routes and ensures authenticated access.

## Critical Implementation Paths
-   **User Registration & Login**: Securely creating and authenticating user accounts.
-   **Vault Item Management**: Encrypting, storing, retrieving, and decrypting sensitive vault data.
-   **Password Generation**: Ensuring strong, random password generation.
-   **Security Auditing**: Regular review of security practices and vulnerability testing.
-   **2FA Implementation**: Securely setting up and verifying TOTP, and managing backup codes.
