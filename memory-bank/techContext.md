# Tech Context

This document details the technologies used in the RobPass project, the development setup, technical constraints, dependencies, and tool usage patterns.

## Technologies Used
-   **Frontend Framework**: Next.js (React)
-   **Backend Runtime**: Node.js
-   **Database**: SQLite (development, as per README.md)
-   **ORM**: Drizzle ORM
-   **Authentication**: JSON Web Tokens (JWT) with `jose` library
-   **Password Hashing**: `bcrypt` (for server-side auth hash storage), PBKDF2 (for client-side key derivation)
-   **Cryptography**: Node.js `crypto` module (for AES-256 GCM, PBKDF2, IV generation)
-   **Styling**: Tailwind CSS (confirmed by `postcss.config.mjs` in file list)
-   **Testing**: No automated test tooling is currently present. A new testing strategy is to be determined.
-   **TypeScript**: Used throughout the project for type safety (confirmed by `tsconfig.json`)
-   **TOTP**: For Two-Factor Authentication (RFC 6238 compliance)

## Development Setup
-   **Node.js**: Version 18+ recommended.
-   **Package Manager**: npm (confirmed by `package.json`, `package-lock.json`).
-   **Database Setup**: Local SQLite database file (`local.db-shm`, `local.db-wal`). Drizzle migrations (`drizzle/` directory) to manage schema.
-   **Environment Variables**: `.env` file for sensitive configurations (e.g., JWT secret, database path).

## Technical Constraints
-   **Security**: High priority on data security and protection against common web vulnerabilities. Strict adherence to Zero-Knowledge principle.
-   **Performance**: Application should be responsive and efficient.
-   **Client-Side Cryptography**: All sensitive encryption/decryption and key derivation must occur on the client.
-   **Strong KDF**: PBKDF2 (min. 100,000 iterations) for all key derivations; SHA1 explicitly forbidden.
-   **Strong Encryption**: AES-256 GCM with unique Initialization Vectors (IVs) per encryption.
-   **Secure Storage**: All vault data must be encrypted at rest on the server.
-   **Secure Communication**: All client-server communication must use HTTPS.
-   **Key & Secret Management**: Master passwords and derived encryption keys must reside only in volatile client-side memory during an active session and be cleared upon logout. Authentication tokens (session tokens) should be stored in `sessionStorage`.
-   **Data Encoding**: Encrypted data (ciphertext and IVs) must be Base64 encoded.

## Dependencies (Confirmed/Inferred from `package.json` and `README.md`)
-   `next`, `react`, `react-dom`
-   `drizzle-orm`, `drizzle-kit`
-   `bcrypt`, `jose`
-   `sqlite3` (or other database drivers)
-   `tailwindcss`, `postcss`, `autoprefixer`
-   `typescript` (dev dependency)
-   `eslint`, `prettier` (likely dev dependencies, common in Next.js projects)

## Tool Usage Patterns
-   **Version Control**: Git for source code management, hosted on GitHub (confirmed by `Git Remote URLs`).
-   **IDE**: VS Code with relevant extensions (ESLint, Prettier, Tailwind CSS IntelliSense).
-   **Database Migrations**: `drizzle-kit` commands for schema management.
