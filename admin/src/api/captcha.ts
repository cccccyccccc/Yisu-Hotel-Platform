import request from './request';

/** 生成滑块验证码 */
export const generateCaptcha = () =>
  request.get('/api/captcha/generate');

/** 验证滑块位置 */
export const verifyCaptcha = (captchaId: string, x: number) =>
  request.post('/api/captcha/verify', { captchaId, x });
