# RobPass

## Project Requirements: Secure Password Manager

### I. Core Principles

1.  **Zero-Knowledge:** The server shall never have access to master passwords or unencrypted vault data.
2.  **Client-Side Cryptography:** All sensitive encryption, decryption, and key derivation must occur on the client.
3.  **Strong KDF:** PBKDF2 (min. 100,000 iterations) for all key derivations. SHA1 is explicitly forbidden for cryptographic functions.
4.  **Strong Encryption:** AES-256 GCM with unique Initialization Vectors (IVs) per encryption.
5.  **Secure Storage:** All vault data must be encrypted at rest on the server.
6.  **Secure Communication:** All client-server communication must use HTTPS.
7.  **Key & Secret Management:** Master passwords and derived encryption keys **must reside only in volatile client-side memory** during an active session and be cleared upon logout. Authentication tokens (session tokens) should be stored in `sessionStorage`.
8.  **Data Encoding:** Encrypted data (ciphertext and IVs) must be Base64 encoded for storage and transmission.

### II. Database Schema

1.  **`users` Table:**
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
2.  **`vault_items` Table:**
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

### III. User Management & Authentication Flow

1.  **New User Creation:**
    *   **Client Process:** On initial app load/user selection, attempt to fetch user's salt and iterations. Upon failure (user not found), prompt for account creation.
    *   **Client Process (Account Creation):**
        *   Generate a unique `UserSalt` client-side.
        *   Derive the `Master Key` from the Master Password and `UserSalt` using PBKDF2. This key is then **stored in volatile client-side memory** for the initial session.
        *   Derive the `Authentication Hash` by applying a secondary, one-way hash (e.g., another round of PBKDF2 or SHA-256) to the `Master Key`.
        *   Send the `username`, generated `UserSalt`, derived `Authentication Hash`, and `PBKDF2 Iterations` to the server.
    *   **Server Process (Account Creation):** Store received `username`, `UserSalt`, a server-side hashed version of the `Authentication Hash`, and `PBKDF2 Iterations`.
2.  **User Authentication (Login):**
    *   **Client Process (Login):**
        *   Retrieve user's `UserSalt` and `PBKDF2 Iterations` from the server.
        *   Derive the `Master Key` from the Master Password and `UserSalt` using PBKDF2.
        *   Derive the `Authentication Hash` by applying the same secondary hash to the `Master Key`.
        *   Send the derived `Authentication Hash` to the server.
    *   **Server Process (Login):** Verify the received `Authentication Hash` against its stored, server-side hashed version. Issue a session token on success.
    *   **Post-Authentication (Client Process):** The `Master Key` (already derived) is retained **in volatile client-side memory** for the duration of the active user session.
3.  **Logout:** Client-side: Clear `Master Key` from **volatile memory** and remove session token.

### IV. Key Derivation Distinction

1.  **Step 1: Master Key Derivation:**
    *   **Purpose:** To generate the symmetric encryption key used for AES-256 GCM vault data encryption/decryption.
    *   **Process:** `MasterKey = PBKDF2(MasterPassword, UserSalt)`
    *   **Location:** Always derived and retained **only in volatile client-side memory**. Never transmitted to or stored by the server.
2.  **Step 2: Authentication Hash Derivation:**
    *   **Purpose:** To generate a value that proves knowledge of the Master Password to the server without revealing the Master Key.
    *   **Process:** `AuthenticationHash = Hash(MasterKey)` (e.g., using SHA-256 or another PBKDF2 round).
    *   **Location:** Derived client-side and transmitted to the server for a one-time authentication check.

This two-step process ensures that the value sent to the server (the Authentication Hash) is different from and cannot be used to reverse-engineer the Master Key, thus preserving the zero-knowledge principle.

### V. Vault Management Functionality

1.  **Vault Item Creation:**
    *   Authenticated users must create new vault items.
    *   **Client Process:** Take unencrypted account username (for the stored service), password, and URI. JSON-serialize these fields into a single string. Encrypt this string (AES-256 GCM) using the in-memory `Master Key`, generating a unique IV.
    *   **Server Process:** Store the `user_id`, `name` (unencrypted display name), `base64-encoded encrypted data` (containing the actual username, password, and URI), and `base64-encoded IV`.
2.  **Vault Item Viewing & Decryption:**
    *   Authenticated users must view their vault items.
    *   **Client Process:** Retrieve encrypted `vault_items` from the server. Decrypt `encrypted_data` using the in-memory `Master Key` and the stored `IV`. Parse the decrypted JSON string to display the unencrypted username, password, and URI.
3.  **Vault Item Editing & Deletion:**
    *   Users must edit and delete vault items.
    *   **Client Process (Edit):** Decrypt existing `encrypted_data`, modify plaintext fields (username, password, URI), re-encrypt (generating a new IV), and send to server.
    *   **Server Process (Edit/Delete):** Update or delete the corresponding encrypted item based on `user_id` and item `id`.