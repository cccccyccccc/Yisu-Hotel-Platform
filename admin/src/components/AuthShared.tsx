import React, { useState } from 'react';
import { Input } from 'antd';
import { LockOutlined, EyeOutlined, EyeInvisibleOutlined, BankOutlined } from '@ant-design/icons';

/** 认证页面背景 */
export const AuthBackground: React.FC<{
  src: string;
  styles: Record<string, string>;
}> = ({ src, styles }) => (
  <div className={styles.background}>
    <img src={src} alt="Hotel Background" className={styles.bgImage} />
    <div className={styles.overlay} />
  </div>
);

/** Logo 和标题区域 */
export const AuthHeader: React.FC<{
  styles: Record<string, string>;
  extra?: React.ReactNode;
}> = ({ styles, extra }) => (
  <div className={styles.header}>
    <div className={styles.logoBox}>
      <BankOutlined className={styles.logoIcon} />
    </div>
    <h1 className={styles.title}>易宿酒店平台</h1>
    <p className={styles.subtitle}>Yisu Hotel Platform</p>
    {extra}
  </div>
);

/** 密码输入框（带可见切换） */
export const PasswordInput: React.FC<{
  placeholder: string;
  styles: Record<string, string>;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ placeholder, styles, value, onChange }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.inputWrapper}>
      <LockOutlined className={styles.inputIcon} />
      <Input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        className={styles.glassInput}
        bordered={false}
        value={value}
        onChange={onChange}
        autoComplete="new-password"
      />
      <span className={styles.eyeIcon} onClick={() => setVisible(!visible)}>
        {visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
      </span>
    </div>
  );
};
