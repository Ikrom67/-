require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-a-real-secret';

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not configured. Set it in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const makePublicUser = (u) => ({
  id: u.id,
  full_name: u.full_name,
  phone: u.phone,
  email: u.email,
  role: u.role,
  avatar_url: u.avatar_url,
  is_active: u.is_active,
  created_at: u.created_at,
});

const responseError = (res, status, message) => res.status(status).json({ status: 'error', message });

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return responseError(res, 401, 'Authorization header missing or invalid');
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      'SELECT id, full_name, phone, email, role, avatar_url, is_active, created_at FROM users WHERE id=$1',
      [payload.sub]
    );

    if (result.rowCount === 0) {
      return responseError(res, 401, 'User no longer exists');
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('auth error', err.message);
    return responseError(res, 401, 'Invalid or expired token');
  }
};

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'english-maktabi backend is running' });
});

app.get('/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS now');
    return res.json({ status: 'ok', db_time: rows[0].now });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Database connectivity problem');
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { full_name, phone, email, password, role } = req.body;
  if (!full_name || !phone || !password) {
    return responseError(res, 400, 'full_name, phone, and password are required');
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE phone=$1 OR email=$2', [phone, email]);
    if (existing.rowCount > 0) {
      return responseError(res, 400, 'User with this phone or email already exists');
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, phone, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, phone, email, role, avatar_url, is_active, created_at`,
      [full_name, phone, email || null, password_hash, role || 'student']
    );

    const user = result.rows[0];
    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '14d' });
    return res.status(201).json({ status: 'ok', user: makePublicUser(user), token });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not register user');
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return responseError(res, 400, 'phone and password are required');
  }

  try {
    const result = await pool.query('SELECT id, full_name, phone, email, role, avatar_url, is_active, created_at, password_hash FROM users WHERE phone=$1', [phone]);
    if (result.rowCount === 0) {
      return responseError(res, 401, 'Invalid phone or password');
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return responseError(res, 401, 'Invalid phone or password');
    }

    if (!user.is_active) {
      return responseError(res, 403, 'Account is inactive');
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '14d' });
    return res.json({ status: 'ok', user: makePublicUser(user), token });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not login');
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ status: 'ok', user: makePublicUser(req.user) });
});

app.get('/api/courses', async (req, res) => {
  const { level, teacher_id, search, published } = req.query;
  const conditions = [];
  const params = [];

  if (published !== undefined) {
    conditions.push(`c.is_published = $${params.length + 1}`);
    params.push(published === 'true' || published === '1');
  }

  if (level) {
    conditions.push(`c.level ILIKE $${params.length + 1}`);
    params.push(`%${level}%`);
  }
  if (teacher_id) {
    conditions.push(`c.teacher_id = $${params.length + 1}`);
    params.push(teacher_id);
  }
  if (search) {
    conditions.push(`(c.title ILIKE $${params.length + 1} OR c.description ILIKE $${params.length + 2})`);
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT c.*, u.full_name as teacher_name
    FROM courses c
    LEFT JOIN users u ON c.teacher_id = u.id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT 200
  `;

  try {
    const result = await pool.query(query, params);
    res.json({ status: 'ok', courses: result.rows });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not fetch courses');
  }
});

app.get('/api/courses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT c.*, u.full_name AS teacher_name, u.email AS teacher_email
       FROM courses c
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE c.id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return responseError(res, 404, 'Course not found');
    }
    return res.json({ status: 'ok', course: result.rows[0] });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not load course');
  }
});

app.post('/api/courses', authenticate, async (req, res) => {
  const { title, description, level, price, thumbnail_url, duration_months, is_published } = req.body;
  if (!title) {
    return responseError(res, 400, 'Course title is required');
  }

  const teacher_id = req.user.id;
  const role = req.user.role;
  if (!['teacher', 'admin'].includes(role)) {
    return responseError(res, 403, 'Only teachers or admins can create courses');
  }

  try {
    const result = await pool.query(
      `INSERT INTO courses (title, description, level, price, thumbnail_url, teacher_id, duration_months, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description || null, level || null, Number(price) || 0, thumbnail_url || null, teacher_id, Number(duration_months) || 3, !!is_published]
    );
    return res.status(201).json({ status: 'ok', course: result.rows[0] });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not create course');
  }
});

app.put('/api/courses/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { title, description, level, price, thumbnail_url, total_lessons, duration_months, is_published } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM courses WHERE id=$1', [id]);
    if (existing.rowCount === 0) {
      return responseError(res, 404, 'Course not found');
    }
    const course = existing.rows[0];
    if (req.user.role !== 'admin' && req.user.id !== String(course.teacher_id)) {
      return responseError(res, 403, 'Not permitted to update this course');
    }

    const update = await pool.query(
      `UPDATE courses SET title=$1, description=$2, level=$3, price=$4, thumbnail_url=$5, total_lessons=$6, duration_months=$7, is_published=$8
       WHERE id=$9 RETURNING *`,
      [
        title || course.title,
        description !== undefined ? description : course.description,
        level || course.level,
        price !== undefined ? Number(price) : course.price,
        thumbnail_url !== undefined ? thumbnail_url : course.thumbnail_url,
        total_lessons !== undefined ? Number(total_lessons) : course.total_lessons,
        duration_months !== undefined ? Number(duration_months) : course.duration_months,
        is_published !== undefined ? !!is_published : course.is_published,
        id,
      ]
    );

    return res.json({ status: 'ok', course: update.rows[0] });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not update course');
  }
});

app.delete('/api/courses/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM courses WHERE id=$1', [id]);
    if (existing.rowCount === 0) {
      return responseError(res, 404, 'Course not found');
    }
    const course = existing.rows[0];
    if (req.user.role !== 'admin' && req.user.id !== String(course.teacher_id)) {
      return responseError(res, 403, 'Not permitted to delete this course');
    }

    await pool.query('DELETE FROM courses WHERE id=$1', [id]);
    return res.json({ status: 'ok', message: 'Course deleted' });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not delete course');
  }
});

app.get('/api/courses/:courseId/lessons', async (req, res) => {
  const { courseId } = req.params;
  try {
    const lessons = await pool.query('SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_index ASC, created_at ASC', [courseId]);
    return res.json({ status: 'ok', lessons: lessons.rows });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not fetch lessons');
  }
});

app.post('/api/courses/:courseId/lessons', authenticate, async (req, res) => {
  const { courseId } = req.params;
  const { title, description, video_url, video_duration, order_index, is_free_preview } = req.body;

  if (!title) {
    return responseError(res, 400, 'title is required');
  }

  try {
    const courseResult = await pool.query('SELECT * FROM courses WHERE id=$1', [courseId]);
    if (courseResult.rowCount === 0) {
      return responseError(res, 404, 'Course not found');
    }
    const course = courseResult.rows[0];
    if (req.user.role !== 'admin' && req.user.id !== String(course.teacher_id)) {
      return responseError(res, 403, 'Not permitted to create lesson');
    }

    const result = await pool.query(
      `INSERT INTO lessons (course_id, title, description, video_url, video_duration, order_index, is_free_preview)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [courseId, title, description || null, video_url || null, Number(video_duration) || 0, Number(order_index) || 0, !!is_free_preview]
    );

    await pool.query('UPDATE courses SET total_lessons = total_lessons + 1 WHERE id = $1', [courseId]);

    return res.status(201).json({ status: 'ok', lesson: result.rows[0] });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not create lesson');
  }
});

app.post('/api/courses/:courseId/enroll', authenticate, async (req, res) => {
  const { courseId } = req.params;
  try {
    const courseResult = await pool.query('SELECT id FROM courses WHERE id=$1', [courseId]);
    if (courseResult.rowCount === 0) {
      return responseError(res, 404, 'Course not found');
    }

    const existing = await pool.query('SELECT id FROM enrollments WHERE student_id=$1 AND course_id=$2', [req.user.id, courseId]);
    if (existing.rowCount > 0) {
      return responseError(res, 400, 'Already enrolled');
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6);
    const enrollmentResult = await pool.query(
      `INSERT INTO enrollments (student_id, course_id, status, expires_at) VALUES ($1, $2, 'active', $3) RETURNING *`,
      [req.user.id, courseId, expiresAt]
    );

    return res.status(201).json({ status: 'ok', enrollment: enrollmentResult.rows[0] });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not enroll');
  }
});

app.get('/api/me/enrollments', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.title as course_title, c.description as course_description
       FROM enrollments e
       JOIN courses c ON e.course_id=c.id
       WHERE e.student_id=$1
       ORDER BY e.enrolled_at DESC`,
      [req.user.id]
    );
    return res.json({ status: 'ok', enrollments: result.rows });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not load enrollments');
  }
});

app.post('/api/courses/:courseId/reviews', authenticate, async (req, res) => {
  const { courseId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    return responseError(res, 400, 'rating must be between 1 and 5');
  }

  try {
    const courseResult = await pool.query('SELECT id FROM courses WHERE id=$1', [courseId]);
    if (courseResult.rowCount === 0) {
      return responseError(res, 404, 'Course not found');
    }

    const reviewResult = await pool.query(
      `INSERT INTO reviews (student_id, course_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, courseId, Number(rating), comment || null]
    );

    return res.status(201).json({ status: 'ok', review: reviewResult.rows[0] });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not post review');
  }
});

app.get('/api/courses/:courseId/reviews', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.full_name as student_name
       FROM reviews r
       JOIN users u ON r.student_id = u.id
       WHERE r.course_id=$1
       ORDER BY r.created_at DESC`,
      [req.params.courseId]
    );
    return res.json({ status: 'ok', reviews: result.rows });
  } catch (err) {
    console.error(err);
    return responseError(res, 500, 'Could not fetch reviews');
  }
});

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
