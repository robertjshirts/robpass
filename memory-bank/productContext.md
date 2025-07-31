# Product Context

This document describes the "why" behind the RobPass project, the problems it aims to solve, how it should work from a user's perspective, and the overall user experience goals.

## Problem Solved
In an increasingly digital world, users struggle to manage numerous complex passwords for various online services. Reusing simple passwords leads to significant security vulnerabilities. RobPass aims to provide a secure and convenient solution for managing these credentials.

## How it Should Work (User Flow)
1.  **Registration/Login**: Users can create a new account or log in to an existing one.
2.  **Dashboard**: After logging in, users are presented with a dashboard showing their stored vault items.
3.  **Add/Edit Vault Item**: Users can add new vault items (e.g., website credentials, secure notes) or edit existing ones.
4.  **View Vault Item**: Users can securely view details of a stored item, with sensitive information masked by default and revealed only upon explicit action (e.g., click to reveal).
5.  **Password Generation**: A built-in tool allows users to generate strong, unique passwords.
6.  **Search/Filter**: Users can easily search and filter their vault items.
7.  **Two-Factor Authentication (2FA) Setup**: Users can enable 2FA, which involves deriving a TOTP secret client-side from the Master Key, displaying a QR code, and generating backup codes.
8.  **Two-Factor Authentication (2FA) Verification**: Users input a TOTP code from an authenticator app to confirm setup or during login.
9.  **2FA Recovery**: Users can log in using a single-use backup code.
10. **Logout**: Users can securely log out of their session.

## User Experience Goals
-   **Security**: Users must feel confident that their data is highly secure and protected.
-   **Simplicity**: The interface should be intuitive and easy to navigate, even for non-technical users.
-   **Efficiency**: Core tasks (adding, viewing, searching) should be quick and require minimal steps.
-   **Reliability**: The application should be stable and perform consistently.
-   **Accessibility**: The application should be usable by a wide range of users.
