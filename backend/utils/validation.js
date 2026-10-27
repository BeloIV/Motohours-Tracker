// Request input helpers — reject wrong types with 400 instead of letting them
// reach the database or bcrypt and surface as 500s.

// Positive integer id from a number or a string of digits, else null
function parseId(value) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647) {
        return value;
    }
    if (typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value)) {
        const n = parseInt(value, 10);
        return n <= 2147483647 ? n : null;
    }
    return null;
}

// Trimmed string no longer than maxLength, else null (also for non-strings)
function text(value, maxLength) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) return null;
    return trimmed;
}

// Error message for a new password, or null when it is acceptable.
// bcrypt ignores everything after 72 bytes, so longer passwords are refused.
function passwordProblem(password) {
    if (typeof password !== 'string') return 'Heslo je povinné';
    if (password.length < 10) return 'Heslo musí mať aspoň 10 znakov';
    if (Buffer.byteLength(password, 'utf8') > 72) return 'Heslo je príliš dlhé (max. 72 bajtov)';
    if (/^\d+$/.test(password)) return 'Heslo nemôže obsahovať iba číslice';
    return null;
}

module.exports = { parseId, text, passwordProblem };
