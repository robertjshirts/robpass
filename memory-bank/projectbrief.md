# Project Brief

This document outlines the core requirements and goals of the project. It serves as the foundational document for all other memory bank files and is the source of truth for the project scope.

## Project Name
RobPass

## Project Goal
To create a secure and user-friendly password manager application.

## Key Features
- User authentication (registration, login, logout)
- Secure storage of vault items (passwords, notes, etc.)
- Encryption and decryption of sensitive data
- Password generation
- User information management
- Robust security measures and testing
- Two-Factor Authentication (TOTP-based) with QR code support and backup recovery codes.

## Core Principles (from README.md)
1.  **Zero-Knowledge:** Server never accesses master passwords or unencrypted vault data.
2.  **Client-Side Cryptography:** All sensitive crypto operations on the client.
3.  **Strong KDF:** PBKDF2 (min. 100,000 iterations) for all key derivations; SHA1 forbidden.
4.  **Strong Encryption:** AES-256 GCM with unique IVs per encryption.
5.  **Secure Storage:** Encrypted vault data at rest on server.
6.  **Secure Communication:** All client-server communication via HTTPS.
7.  **Key & Secret Management:** Master passwords and derived keys in volatile client-client memory; cleared on logout. Session tokens in `sessionStorage`.
8.  **Data Encoding:** Encrypted data (ciphertext and IVs) Base64 encoded.

## Technologies (Initial Assumption)
- Next.js (React) for the frontend
- Node.js for the backend API
- Drizzle ORM for database interaction
- NeonDB Postgres for the database (local development)
- Playwright for end-to-end testing
- bcrypt for password hashing
- jose for JWT handling
- crypto for encryption/decryption
