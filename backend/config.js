// Runtime configuration that must be valid before the server starts.

const KNOWN_DEFAULT_SECRETS = [
    'your-super-secret-jwt-key-change-this-in-production',
    'your-secret-key-change-in-production'
];

function getJwtSecret() {
    const secret = process.env.JWT_SECRET || '';
    if (secret.length < 32 || KNOWN_DEFAULT_SECRETS.includes(secret)) {
        throw new Error('JWT_SECRET must be set to a random value of at least 32 characters (run scripts/set-jwt-secret.sh)');
    }
    return secret;
}

module.exports = { getJwtSecret, KNOWN_DEFAULT_SECRETS };
