import { UserModel } from '../models/User.js';
import { logger } from './logger.js';
import { config } from '../config/index.js';

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // Create default admin user
    const adminEmail = config.admin.defaultEmail;
    const existingAdmin = await UserModel.findByEmail(adminEmail);

    if (!existingAdmin) {
      const admin = await UserModel.create(
        adminEmail,
        config.admin.defaultPassword,
        'System Administrator',
        'admin'
      );
      logger.info('Default admin user created', { email: admin.email });
    } else {
      logger.info('Admin user already exists');
    }

    // Create test users
    const testUsers = [
      { email: 'user1@example.com', password: 'TestUser123!', name: 'Test User 1' },
      { email: 'user2@example.com', password: 'TestUser123!', name: 'Test User 2' },
    ];

    for (const testUser of testUsers) {
      const existing = await UserModel.findByEmail(testUser.email);
      if (!existing) {
        const user = await UserModel.create(
          testUser.email,
          testUser.password,
          testUser.name,
          'user'
        );
        logger.info('Test user created', { email: user.email });
      }
    }

    logger.info('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
