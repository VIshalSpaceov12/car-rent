import jwt from 'jsonwebtoken';
const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET missing or < 16 chars');
  return s;
};
export const signJwt = (userId: string) => jwt.sign({ userId }, secret(), { expiresIn: '30d' });
export const verifyJwt = (token: string): { userId: string } | null => {
  try { const d = jwt.verify(token, secret()) as { userId: string }; return { userId: d.userId }; }
  catch { return null; }
};
