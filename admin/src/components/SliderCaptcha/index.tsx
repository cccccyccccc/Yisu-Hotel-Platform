import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Spin } from 'antd';
import { ReloadOutlined, CheckOutlined, CloseOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { generateCaptcha, verifyCaptcha } from '@/api/captcha';
import styles from './SliderCaptcha.module.css';

interface SliderCaptchaProps {
  onSuccess: (captchaToken: string) => void;
  onFail?: () => void;
}

type CaptchaStatus = 'idle' | 'dragging' | 'verifying' | 'success' | 'fail';

const SliderCaptcha: React.FC<SliderCaptchaProps> = ({ onSuccess, onFail }) => {
  const [bgImage, setBgImage] = useState('');
  const [pieceImage, setPieceImage] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [pieceY, setPieceY] = useState(0);
  const [sliderX, setSliderX] = useState(0);
  const [status, setStatus] = useState<CaptchaStatus>('idle');
  const [loading, setLoading] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);

  const maxSlide = 310 - 44; // IMAGE_WIDTH - PIECE_SIZE

  /** 请求验证码 */
  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    setSliderX(0);
    setStatus('idle');
    try {
      const res = await generateCaptcha();
      setBgImage(res.data.bgImage);
      setPieceImage(res.data.pieceImage);
      setCaptchaId(res.data.captchaId);
      setPieceY(res.data.y);
    } catch {
      console.error('加载验证码失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  /** 验证 */
  const handleVerify = useCallback(async (x: number) => {
    setStatus('verifying');
    try {
      const res = await verifyCaptcha(captchaId, Math.round(x));
      if (res.data.success) {
        setStatus('success');
        onSuccess(res.data.captchaToken);
      } else {
        setStatus('fail');
        onFail?.();
        // 1.2秒后重新加载
        setTimeout(() => loadCaptcha(), 1200);
      }
    } catch {
      setStatus('fail');
      setTimeout(() => loadCaptcha(), 1200);
    }
  }, [captchaId, onSuccess, onFail, loadCaptcha]);

  /** 鼠标/触摸事件处理 */
  const onDragStart = useCallback((clientX: number) => {
    if (status === 'success' || status === 'verifying') return;
    dragging.current = true;
    startX.current = clientX - sliderX;
    setStatus('dragging');
  }, [status, sliderX]);

  const onDragMove = useCallback((clientX: number) => {
    if (!dragging.current) return;
    let newX = clientX - startX.current;
    newX = Math.max(0, Math.min(newX, maxSlide));
    setSliderX(newX);
  }, [maxSlide]);

  const onDragEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (sliderX > 10) {
      handleVerify(sliderX);
    } else {
      setSliderX(0);
      setStatus('idle');
    }
  }, [sliderX, handleVerify]);

  // 全局事件绑定
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => onDragMove(e.clientX);
    const handleMouseUp = () => onDragEnd();
    const handleTouchMove = (e: TouchEvent) => onDragMove(e.touches[0].clientX);
    const handleTouchEnd = () => onDragEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onDragMove, onDragEnd]);

  const handleClass = status === 'success'
    ? styles.success
    : status === 'fail' ? styles.fail : '';

  const handleIcon = status === 'success'
    ? <CheckOutlined />
    : status === 'fail'
      ? <CloseOutlined />
      : <ArrowRightOutlined />;

  return (
    <div className={styles.captchaWrapper}>
      {/* 拼图区域 */}
      <div className={styles.captchaBox}>
        {loading && (
          <div className={styles.loadingOverlay}><Spin /></div>
        )}
        {bgImage && <img src={bgImage} className={styles.bgImage} alt="captcha" draggable={false} />}
        {pieceImage && (
          <img
            src={pieceImage}
            className={styles.pieceImage}
            alt="piece"
            draggable={false}
            style={{ left: sliderX, top: pieceY }}
          />
        )}
      </div>

      {/* 滑块轨道 */}
      <div className={styles.sliderTrack} ref={trackRef}>
        <div
          className={`${styles.sliderFill} ${handleClass}`}
          style={{ width: sliderX + 18 }}
        />
        {status === 'idle' && sliderX === 0 && (
          <div className={styles.sliderHint}>
            向右拖动滑块完成验证
          </div>
        )}
        <div
          className={`${styles.sliderHandle} ${handleClass}`}
          style={{ left: sliderX }}
          onMouseDown={(e) => { e.preventDefault(); onDragStart(e.clientX); }}
          onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
        >
          {handleIcon}
        </div>
      </div>

      {/* 状态栏 */}
      <div className={styles.statusBar}>
        <span className={`${styles.statusText} ${handleClass}`}>
          {status === 'success' && '✓ 验证成功'}
          {status === 'fail' && '✗ 验证失败，正在刷新...'}
          {status === 'verifying' && '验证中...'}
          {(status === 'idle' || status === 'dragging') && '拖动滑块完成拼图'}
        </span>
        {status !== 'success' && (
          <button className={styles.refreshBtn} onClick={loadCaptcha} disabled={loading}>
            <ReloadOutlined /> 换一张
          </button>
        )}
      </div>
    </div>
  );
};

export default SliderCaptcha;
