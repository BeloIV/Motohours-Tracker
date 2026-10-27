const { getJwtSecret } = require('../config');

describe('JWT secret', () => {
    const original = process.env.JWT_SECRET;
    afterEach(() => { process.env.JWT_SECRET = original; });

    test.each([
        ['missing', undefined],
        ['empty', ''],
        ['short', 'x'.repeat(31)],
        ['compose default', 'your-super-secret-jwt-key-change-this-in-production'],
        ['old code default', 'your-secret-key-change-in-production'],
    ])('refuses %s secret', (_, value) => {
        if (value === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = value;
        expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
    });

    test('accepts a long random secret', () => {
        process.env.JWT_SECRET = 'a'.repeat(32);
        expect(getJwtSecret()).toBe('a'.repeat(32));
    });
});
