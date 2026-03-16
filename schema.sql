-- Foydalanuvchilar
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'student',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Kurslar
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  level VARCHAR(10),
  price INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  teacher_id UUID REFERENCES users(id),
  is_published BOOLEAN DEFAULT false,
  total_lessons INTEGER DEFAULT 0,
  duration_months INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Darslar
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  video_url TEXT,
  video_duration INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  is_free_preview BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ro'yxatdan o'tishlar
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  status VARCHAR(20) DEFAULT 'active',
  enrolled_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- To'lovlar
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  amount INTEGER NOT NULL,
  provider VARCHAR(20),
  transaction_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

-- Dars jarayoni
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  lesson_id UUID REFERENCES lessons(id),
  is_completed BOOLEAN DEFAULT false,
  watch_time INTEGER DEFAULT 0,
  last_watched TIMESTAMP DEFAULT NOW()
);

-- Sharhlar
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
