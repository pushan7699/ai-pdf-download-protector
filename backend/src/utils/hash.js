import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export class HashUtil {
  static async hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
  }

  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  static async hashToken(token) {
    return await bcrypt.hash(token, 10);
  }

  static async compareToken(token, hash) {
    return await bcrypt.compare(token, hash);
  }
}
