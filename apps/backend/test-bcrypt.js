import bcrypt from 'bcrypt';

const testPassword = 'admin123';
const storedHash = '$2b$10$...'; // Wklej hash z bazy

bcrypt.compare(testPassword, storedHash, (err, result) => {
    console.log('Password match:', result);
    console.log('Error:', err);
});

// Test hashing
bcrypt.hash(testPassword, 10, (err, hash) => {
    console.log('New hash:', hash);
});
