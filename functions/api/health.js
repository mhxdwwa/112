/**
 * GET /api/health — 健康检查
 */
import { jsonResponse, handleOptions } from '../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestGet = async ({ env }) => {
  return jsonResponse({
    status: 'ok',
    service: 'pet-world-api',
    supabaseConnected: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY),
    timestamp: new Date().toISOString(),
  });
};
