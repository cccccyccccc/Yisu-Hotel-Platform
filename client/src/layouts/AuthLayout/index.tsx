import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';

const AuthLayout: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.overlay} />
      </div>
      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏨</span>
            <h1 className={styles.title}>易宿酒店管理平台</h1>
            <p className={styles.subtitle}>Hotel Management System</p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
