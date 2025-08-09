import { Router, Request, Response } from 'express';
import { validateEmail, validatePassword } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthController } from '../controllers/auth';

export async function createAuthRoutes() {
  const router = Router();
  const authController = new AuthController();

  /**
   * POST /auth/login
   * Handles user login.
   * @body {string} email - The user's email address.
   * @body {string} password - The user's password.
   * @returns A JSON response with a JWT token and user information upon successful login.
   */
  router.post('/login',
    validateEmail,
    validatePassword,
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body;
      const result = await authController.login(email, password, req);

      // Set secure cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.json(result);
    })
  );

  /**
   * POST /auth/setup
   * Creates the first admin user. Only works if no admin exists.
   * @body {string} email - The email address for the admin user.
   * @body {string} password - The password for the admin user.
   * @body {string} [name] - Optional: The name of the admin user.
   * @returns A JSON response indicating successful admin creation.
   */
  router.post('/setup',
    validateEmail,
    validatePassword,
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password, name } = req.body;
      const result = await authController.createFirstAdmin(email, password, name);
      res.json(result);
    })
  );

  /**
   * POST /auth/register
   * Registers a new user.
   * @body {string} email - The email address for the new user.
   * @body {string} password - The password for the new user.
   * @body {string} [name] - Optional: The name of the new user.
   * @returns A JSON response with a JWT token and new user information upon successful registration.
   */
  router.post('/register',
    validateEmail,
    validatePassword,
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password, name } = req.body;
      const result = await authController.register(email, password, name);
      res.json(result);
    })
  );

  /**
   * POST /auth/logout
   * Logs out a user by revoking their JWT token and clearing the token cookie.
   * @returns A JSON response indicating successful logout.
   */
  router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
    const token = req.headers['authorization']?.split(' ')[1] || req.cookies['token'];

    if (token) {
      await authController.logout(token);
    }

    res.clearCookie('token');
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }));

  /**
   * POST /auth/refresh
   * Refreshes an existing JWT token.
   * @returns A JSON response with a new JWT token.
   */
  router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
    const token = req.headers['authorization']?.split(' ')[1] || req.cookies['token'];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const result = await authController.refreshToken(token);

    // Set new secure cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json(result);
  }));

  /**
   * POST /auth/forgot-password
   * Initiates the password reset process for a given email.
   * @body {string} email - The email address for which to request a password reset.
   * @returns A JSON response indicating that a password reset link has been sent (if the email exists).
   */
  router.post('/forgot-password',
    validateEmail,
    asyncHandler(async (req: Request, res: Response) => {
      const { email } = req.body;
      const result = await authController.requestPasswordReset(email);
      res.json(result);
    })
  );

  /**
   * POST /auth/reset-password
   * Resets a user's password using a reset token.
   * @body {string} token - The password reset token.
   * @body {string} password - The new password.
   * @returns A JSON response indicating successful password reset.
   */
  router.post('/reset-password',
    validatePassword,
    asyncHandler(async (req: Request, res: Response) => {
      const { token, password } = req.body;
      const result = await authController.resetPassword(token, password);
      res.json(result);
    })
  );

  return router;
}