/**
 * API Routes
 * Main router for all API endpoints
 */

import { Router } from 'express';

const router = Router();

// API v1 routes
router.get('/', (req, res) => {
  res.json({
    message: 'OpenSky Suite API Gateway',
    version: 'v1',
    endpoints: {
      auth: '/api/auth',
      mail: '/api/mail',
      drive: '/api/drive',
      docs: '/api/docs',
      calendar: '/api/calendar',
      meet: '/api/meet',
      chat: '/api/chat',
    },
    documentation: '/api/docs',
  });
});

// Auth routes
router.post('/auth/login', (req, res) => {
  // Placeholder - will be implemented in SkyAuth
  res.json({ message: 'Login endpoint - to be implemented' });
});

router.post('/auth/register', (req, res) => {
  // Placeholder - will be implemented in SkyAuth
  res.json({ message: 'Register endpoint - to be implemented' });
});

// Mail routes
router.get('/mail/inbox', (req, res) => {
  res.json({ message: 'Mail inbox - to be implemented' });
});

// Drive routes
router.get('/drive/files', (req, res) => {
  res.json({ message: 'Drive files - to be implemented' });
});

// Docs routes
router.get('/docs', (req, res) => {
  res.json({ message: 'Documents - to be implemented' });
});

export default router;
