import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

export default async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = { id: session.user.id, email: session.user.email, name: session.user.name };
    next();
  } catch (err) {
    next(err);
  }
}