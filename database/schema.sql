-- Create Users table: holds username, hashed password, and role
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,  -- store hashed passwords!
    role VARCHAR(10) CHECK (role IN ('student', 'teacher', 'admin')) NOT NULL
);

-- Create Notices table: each notice is linked to a teacher (who added it)
CREATE TABLE notices (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    teacher_id INT REFERENCES users(id) ON DELETE CASCADE
);
