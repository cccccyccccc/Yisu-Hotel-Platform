import request from './request'

export interface CaptchaGenerateResponse {
  captchaId: string
  bgImage: string
  pieceImage: string
  y: number
}

export interface CaptchaVerifyRequest {
  captchaId: string
  x: number
}

export interface CaptchaVerifyResponse {
  success: boolean
  captchaToken?: string
  msg?: string
}

// 生成滑块验证码
export function generateCaptcha(): Promise<CaptchaGenerateResponse> {
  return request<CaptchaGenerateResponse>({
    url: '/captcha/generate',
    method: 'GET'
  })
}

// 验证滑块验证码
export function verifyCaptcha(data: CaptchaVerifyRequest): Promise<CaptchaVerifyResponse> {
  return request<CaptchaVerifyResponse>({
    url: '/captcha/verify',
    method: 'POST',
    data
  })
}

