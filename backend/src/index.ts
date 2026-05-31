import dotenv from 'dotenv';
import { connectDB } from './db/connection';
import { app } from './app';

dotenv.config();

const PORT = process.env.PORT ?? 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
